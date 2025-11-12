-- Recriar a função com search_path definido para segurança
CREATE OR REPLACE FUNCTION criar_servico_ao_confirmar()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    novo_codigo TEXT;
    contador INTEGER;
BEGIN
    -- Só executar quando status mudar para "confirmada"
    IF NEW.status = 'confirmada' AND (OLD.status IS NULL OR OLD.status != 'confirmada') THEN
        
        -- Gerar código único do serviço (SRV-2025-001)
        SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 10) AS INTEGER)), 0) + 1
        INTO contador
        FROM servicos
        WHERE empresa_id = NEW.empresa_id
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
        
        novo_codigo := 'SRV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(contador::TEXT, 3, '0');
        
        -- Criar serviço
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
            status
        )
        SELECT 
            novo_codigo,
            NEW.empresa_id,
            NEW.id,
            NEW.cliente_id,
            NEW.data_servico_desejada::TIMESTAMP,
            NEW.tipo_servico,
            NEW.descricao_servico,
            c.endereco_completo,
            NEW.valor_estimado,
            NEW.valor_estimado * 0.50,
            'aguardando_distribuicao'
        FROM clientes c
        WHERE c.id = NEW.cliente_id;
        
    END IF;
    
    RETURN NEW;
END;
$$;