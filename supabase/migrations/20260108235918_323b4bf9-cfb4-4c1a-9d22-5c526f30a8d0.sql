-- Adicionar coluna percentual_mao_obra na tabela usuarios
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS percentual_mao_obra INTEGER DEFAULT 50;

-- Atualizar instaladores existentes para 50% padrão
UPDATE usuarios 
SET percentual_mao_obra = 50 
WHERE tipo = 'instalador' AND percentual_mao_obra IS NULL;

-- Criar trigger para recalcular valor quando instalador aceitar serviço
CREATE OR REPLACE FUNCTION atualizar_valor_ao_aceitar_servico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  percentual NUMERIC;
  valor_mao_obra_original NUMERIC;
BEGIN
  -- Se instalador foi definido (aceitou o serviço)
  IF NEW.instalador_id IS NOT NULL AND OLD.instalador_id IS NULL THEN
    
    -- Buscar percentual do instalador
    SELECT COALESCE(u.percentual_mao_obra, 50) INTO percentual
    FROM usuarios u
    WHERE u.id = NEW.instalador_id;
    
    -- Buscar valor original da mão de obra (da cotação)
    SELECT COALESCE(c.valor_estimado, 0) INTO valor_mao_obra_original
    FROM cotacoes c
    WHERE c.id = NEW.cotacao_id;
    
    -- Recalcular valor do instalador com seu percentual
    NEW.valor_mao_obra_instalador := valor_mao_obra_original * (percentual / 100.0);
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_atualizar_valor_ao_aceitar ON servicos;
CREATE TRIGGER trigger_atualizar_valor_ao_aceitar
BEFORE UPDATE ON servicos
FOR EACH ROW
EXECUTE FUNCTION atualizar_valor_ao_aceitar_servico();