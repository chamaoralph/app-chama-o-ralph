-- Atualizar função para sincronizar TODOS os campos relevantes (data, hora, valores, tipo, descrição)
CREATE OR REPLACE FUNCTION public.sincronizar_servico_ao_editar_cotacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    percentual_instalador NUMERIC;
    novo_valor_mao_obra NUMERIC;
    nova_data_hora_agendada TIMESTAMP;
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
    
    -- Atualizar serviço vinculado com TODOS os campos relevantes
    UPDATE servicos
    SET 
        -- Campos financeiros
        valor_total = COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0),
        valor_mao_obra_instalador = novo_valor_mao_obra,
        valor_reembolso_despesas = COALESCE(NEW.valor_material, 0),
        -- Campos de agendamento
        data_servico_agendada = COALESCE(nova_data_hora_agendada, data_servico_agendada),
        -- Campos descritivos
        tipo_servico = COALESCE(NEW.tipo_servico, tipo_servico),
        descricao = COALESCE(NEW.descricao_servico, descricao)
    WHERE cotacao_id = NEW.id;
    
    RETURN NEW;
END;
$$;

-- Corrigir o caso do Matheus imediatamente
UPDATE servicos 
SET data_servico_agendada = '2026-01-09 12:30:00'
WHERE id = '29cc43b3-1696-49c6-b624-97b6f8489be8';