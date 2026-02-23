
-- Corrigir trigger criar_servico_ao_confirmar: quando empresa fornece, reembolso = 0
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
    IF NEW.status = 'aprovada' AND (OLD.status IS NULL OR OLD.status != 'aprovada') THEN
        
        SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 10) AS INTEGER)), 0) + 1
        INTO contador
        FROM servicos
        WHERE empresa_id = NEW.empresa_id
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
        
        novo_codigo := 'SRV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(contador::TEXT, 3, '0');
        
        IF NEW.data_servico_desejada IS NOT NULL AND NEW.horario_inicio IS NOT NULL THEN
            data_hora_agendada := (NEW.data_servico_desejada::DATE + NEW.horario_inicio::TIME)::TIMESTAMP;
        ELSIF NEW.data_servico_desejada IS NOT NULL THEN
            data_hora_agendada := NEW.data_servico_desejada::TIMESTAMP;
        ELSE
            data_hora_agendada := NOW();
        END IF;
        
        -- Mão de obra do instalador: 50% (será recalculado pelo trigger de aceitação)
        valor_mao_obra_calc := COALESCE(NEW.valor_estimado, 0) * 0.50;
        
        -- CORREÇÃO: Reembolso depende da origem do suporte
        IF NEW.origem_suporte = 'instalador' THEN
            -- Instalador comprou: reembolsa material + custo_suporte
            valor_reembolso_calc := COALESCE(NEW.valor_material, 0) + COALESCE(NEW.custo_suporte, 0);
        ELSE
            -- Empresa fornece ou sem suporte: SEM reembolso de material
            valor_reembolso_calc := 0;
        END IF;
        
        -- Valor total inclui tudo
        IF NEW.origem_suporte IN ('empresa', 'instalador') THEN
            valor_total_calc := COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0) + COALESCE(NEW.custo_suporte, 0);
        ELSE
            valor_total_calc := COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0);
        END IF;
        
        INSERT INTO servicos (
            codigo, empresa_id, cotacao_id, cliente_id,
            data_servico_agendada, tipo_servico, descricao,
            endereco_completo, valor_total, valor_mao_obra_instalador,
            valor_reembolso_despesas, origem_suporte, custo_suporte, status
        )
        SELECT 
            novo_codigo, NEW.empresa_id, NEW.id, NEW.cliente_id,
            data_hora_agendada, NEW.tipo_servico, NEW.descricao_servico,
            COALESCE(c.endereco_completo, 'Endereço não informado'),
            valor_total_calc, valor_mao_obra_calc,
            valor_reembolso_calc, NEW.origem_suporte,
            COALESCE(NEW.custo_suporte, 0), 'disponivel'
        FROM clientes c
        WHERE c.id = NEW.cliente_id;
        
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Corrigir trigger sincronizar_servico_ao_editar_cotacao: quando empresa fornece, reembolso = 0
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
    IF NEW.data_servico_desejada IS NOT NULL AND NEW.horario_inicio IS NOT NULL THEN
        nova_data_hora_agendada := (NEW.data_servico_desejada::DATE + NEW.horario_inicio::TIME)::TIMESTAMP;
    ELSIF NEW.data_servico_desejada IS NOT NULL THEN
        nova_data_hora_agendada := NEW.data_servico_desejada::TIMESTAMP;
    ELSE
        nova_data_hora_agendada := NULL;
    END IF;
    
    SELECT COALESCE(u.percentual_mao_obra, 50) 
    INTO percentual_instalador
    FROM servicos s
    LEFT JOIN usuarios u ON u.id = s.instalador_id
    WHERE s.cotacao_id = NEW.id;
    
    IF percentual_instalador IS NULL THEN
        percentual_instalador := 50;
    END IF;
    
    novo_valor_mao_obra := COALESCE(NEW.valor_estimado, 0) * (percentual_instalador / 100.0);
    
    -- CORREÇÃO: Reembolso depende da origem do suporte
    IF NEW.origem_suporte = 'instalador' THEN
        novo_valor_reembolso := COALESCE(NEW.valor_material, 0) + COALESCE(NEW.custo_suporte, 0);
    ELSE
        -- Empresa fornece ou sem suporte: SEM reembolso
        novo_valor_reembolso := 0;
    END IF;
    
    IF NEW.origem_suporte IN ('empresa', 'instalador') THEN
        novo_valor_total := COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0) + COALESCE(NEW.custo_suporte, 0);
    ELSE
        novo_valor_total := COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0);
    END IF;
    
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
