-- 1. Corrigir o valor do serviço SRV-2026-004
UPDATE servicos 
SET valor_total = 710.00,
    valor_mao_obra_instalador = 0
WHERE id = '9962a9c9-7a4d-42e5-b03c-05af98de256d';

-- 2. Criar função de sincronização automática
CREATE OR REPLACE FUNCTION sincronizar_servico_ao_editar_cotacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    percentual_instalador NUMERIC;
    novo_valor_mao_obra NUMERIC;
BEGIN
    -- Só executar se valores foram alterados
    IF OLD.valor_estimado IS DISTINCT FROM NEW.valor_estimado 
       OR OLD.valor_material IS DISTINCT FROM NEW.valor_material THEN
        
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
        
        -- Atualizar serviço vinculado
        UPDATE servicos
        SET 
            valor_total = COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0),
            valor_mao_obra_instalador = novo_valor_mao_obra,
            valor_reembolso_despesas = COALESCE(NEW.valor_material, 0)
        WHERE cotacao_id = NEW.id;
        
    END IF;
    
    RETURN NEW;
END;
$$;

-- 3. Criar trigger que dispara após atualização de cotação
CREATE TRIGGER trigger_sincronizar_servico_ao_editar_cotacao
AFTER UPDATE ON cotacoes
FOR EACH ROW
EXECUTE FUNCTION sincronizar_servico_ao_editar_cotacao();