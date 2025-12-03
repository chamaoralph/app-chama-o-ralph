-- Atualizar o trigger para criar serviço quando status = 'aprovada'
CREATE OR REPLACE FUNCTION public.criar_servico_ao_confirmar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    novo_codigo TEXT;
    contador INTEGER;
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
        
        -- Criar serviço com status 'disponivel' para aparecer disponível aos instaladores
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
            COALESCE(NEW.data_servico_desejada::TIMESTAMP, NOW()),
            NEW.tipo_servico,
            NEW.descricao_servico,
            COALESCE(c.endereco_completo, 'Endereço não informado'),
            COALESCE(NEW.valor_estimado, 0),
            COALESCE(NEW.valor_estimado, 0) * 0.50,
            'disponivel'
        FROM clientes c
        WHERE c.id = NEW.cliente_id;
        
    END IF;
    
    RETURN NEW;
END;
$function$;