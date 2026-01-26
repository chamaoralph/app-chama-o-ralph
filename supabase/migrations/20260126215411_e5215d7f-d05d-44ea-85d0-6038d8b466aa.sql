-- 1. Criar tabela de movimentações de suportes
CREATE TABLE public.movimentacoes_suportes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  instalador_id UUID NOT NULL REFERENCES public.usuarios(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  tipo_movimento TEXT NOT NULL CHECK (tipo_movimento IN ('entrega', 'devolucao', 'uso')),
  servico_id UUID REFERENCES public.servicos(id),
  data_movimento DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Adicionar campos em cotacoes
ALTER TABLE public.cotacoes 
ADD COLUMN origem_suporte TEXT CHECK (origem_suporte IN ('empresa', 'instalador', 'cliente')),
ADD COLUMN custo_suporte NUMERIC DEFAULT 0;

-- 3. Adicionar campos em servicos
ALTER TABLE public.servicos 
ADD COLUMN origem_suporte TEXT CHECK (origem_suporte IN ('empresa', 'instalador', 'cliente')),
ADD COLUMN custo_suporte NUMERIC DEFAULT 0;

-- 4. Habilitar RLS
ALTER TABLE public.movimentacoes_suportes ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para movimentacoes_suportes
CREATE POLICY "Admins podem gerenciar movimentações de suportes"
ON public.movimentacoes_suportes
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

CREATE POLICY "Instaladores podem ver suas movimentações"
ON public.movimentacoes_suportes
FOR SELECT
USING (instalador_id = auth.uid());

-- 6. Atualizar trigger criar_servico_ao_confirmar para incluir suporte
CREATE OR REPLACE FUNCTION public.criar_servico_ao_confirmar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    novo_codigo TEXT;
    contador INTEGER;
    valor_mao_obra_calc NUMERIC;
    valor_reembolso_calc NUMERIC;
    valor_total_calc NUMERIC;
    data_hora_agendada TIMESTAMP;
BEGIN
    -- Só executar quando status mudar para "aprovada"
    IF NEW.status = 'aprovada' AND (OLD.status IS NULL OR OLD.status != 'aprovada') THEN
        
        -- Gerar código único do serviço (SRV-2025-001)
        SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 10) AS INTEGER)), 0) + 1
        INTO contador
        FROM servicos
        WHERE empresa_id = NEW.empresa_id
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
        
        novo_codigo := 'SRV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(contador::TEXT, 3, '0');
        
        -- Calcular data/hora agendada combinando data + horário de início
        IF NEW.data_servico_desejada IS NOT NULL AND NEW.horario_inicio IS NOT NULL THEN
            data_hora_agendada := (NEW.data_servico_desejada::DATE + NEW.horario_inicio::TIME)::TIMESTAMP;
        ELSIF NEW.data_servico_desejada IS NOT NULL THEN
            data_hora_agendada := NEW.data_servico_desejada::TIMESTAMP;
        ELSE
            data_hora_agendada := NOW();
        END IF;
        
        -- Calcular valores:
        -- valor_estimado = valor da mão de obra
        -- valor_material = valor do material
        -- custo_suporte = valor do suporte (se empresa fornece, fica com empresa; se instalador compra, vira reembolso)
        
        -- Mão de obra do instalador: 50% da mão de obra (será recalculado pelo trigger de aceitação)
        valor_mao_obra_calc := COALESCE(NEW.valor_estimado, 0) * 0.50;
        
        -- Reembolso: material + suporte (se instalador comprar)
        IF NEW.origem_suporte = 'instalador' THEN
            valor_reembolso_calc := COALESCE(NEW.valor_material, 0) + COALESCE(NEW.custo_suporte, 0);
        ELSE
            valor_reembolso_calc := COALESCE(NEW.valor_material, 0);
        END IF;
        
        -- Valor total: mão de obra + material + suporte (se empresa fornece)
        IF NEW.origem_suporte = 'empresa' THEN
            valor_total_calc := COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0) + COALESCE(NEW.custo_suporte, 0);
        ELSIF NEW.origem_suporte = 'instalador' THEN
            valor_total_calc := COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0) + COALESCE(NEW.custo_suporte, 0);
        ELSE
            valor_total_calc := COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0);
        END IF;
        
        -- Criar serviço com status 'disponivel'
        INSERT INTO servicos (
            codigo,
            empresa_id,
            cotacao_id,
            cliente_id,
            data_servico_agendada,
            tipo_servico,
            descricao,
            endereco_completo,
            valor_total,
            valor_mao_obra_instalador,
            valor_reembolso_despesas,
            origem_suporte,
            custo_suporte,
            status
        )
        SELECT 
            novo_codigo,
            NEW.empresa_id,
            NEW.id,
            NEW.cliente_id,
            data_hora_agendada,
            NEW.tipo_servico,
            NEW.descricao_servico,
            COALESCE(c.endereco_completo, 'Endereço não informado'),
            valor_total_calc,
            valor_mao_obra_calc,
            valor_reembolso_calc,
            NEW.origem_suporte,
            COALESCE(NEW.custo_suporte, 0),
            'disponivel'
        FROM clientes c
        WHERE c.id = NEW.cliente_id;
        
    END IF;
    
    RETURN NEW;
END;
$function$;

-- 7. Atualizar trigger de sincronização de cotação para serviço
CREATE OR REPLACE FUNCTION public.sincronizar_servico_ao_editar_cotacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    percentual_instalador NUMERIC;
    novo_valor_mao_obra NUMERIC;
    nova_data_hora_agendada TIMESTAMP;
    novo_valor_reembolso NUMERIC;
    novo_valor_total NUMERIC;
BEGIN
    -- Calcular nova data/hora agendada se data ou horário mudaram
    IF NEW.data_servico_desejada IS NOT NULL AND NEW.horario_inicio IS NOT NULL THEN
        nova_data_hora_agendada := (NEW.data_servico_desejada::DATE + NEW.horario_inicio::TIME)::TIMESTAMP;
    ELSIF NEW.data_servico_desejada IS NOT NULL THEN
        nova_data_hora_agendada := NEW.data_servico_desejada::TIMESTAMP;
    ELSE
        nova_data_hora_agendada := NULL;
    END IF;
    
    -- Buscar percentual do instalador atribuído (se houver)
    SELECT COALESCE(u.percentual_mao_obra, 50) 
    INTO percentual_instalador
    FROM servicos s
    LEFT JOIN usuarios u ON u.id = s.instalador_id
    WHERE s.cotacao_id = NEW.id;
    
    -- Se não tem instalador, usa 50% como padrão
    IF percentual_instalador IS NULL THEN
        percentual_instalador := 50;
    END IF;
    
    -- Calcular novo valor de mão de obra
    novo_valor_mao_obra := COALESCE(NEW.valor_estimado, 0) * (percentual_instalador / 100.0);
    
    -- Calcular reembolso baseado na origem do suporte
    IF NEW.origem_suporte = 'instalador' THEN
        novo_valor_reembolso := COALESCE(NEW.valor_material, 0) + COALESCE(NEW.custo_suporte, 0);
    ELSE
        novo_valor_reembolso := COALESCE(NEW.valor_material, 0);
    END IF;
    
    -- Calcular valor total
    IF NEW.origem_suporte IN ('empresa', 'instalador') THEN
        novo_valor_total := COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0) + COALESCE(NEW.custo_suporte, 0);
    ELSE
        novo_valor_total := COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0);
    END IF;
    
    -- Atualizar serviço vinculado
    UPDATE servicos
    SET 
        valor_total = novo_valor_total,
        valor_mao_obra_instalador = novo_valor_mao_obra,
        valor_reembolso_despesas = novo_valor_reembolso,
        data_servico_agendada = COALESCE(nova_data_hora_agendada, data_servico_agendada),
        tipo_servico = COALESCE(NEW.tipo_servico, tipo_servico),
        descricao = COALESCE(NEW.descricao_servico, descricao),
        origem_suporte = NEW.origem_suporte,
        custo_suporte = COALESCE(NEW.custo_suporte, 0)
    WHERE cotacao_id = NEW.id;
    
    RETURN NEW;
END;
$function$;