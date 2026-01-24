-- 1. Atualizar o trigger para recalcular comissão quando instalador MUDAR (não apenas na primeira atribuição)
CREATE OR REPLACE FUNCTION public.atualizar_valor_ao_aceitar_servico()
RETURNS TRIGGER AS $$
DECLARE
  percentual NUMERIC;
  valor_mao_obra_original NUMERIC;
BEGIN
  -- Se instalador foi definido OU MUDOU para outro instalador
  IF NEW.instalador_id IS NOT NULL 
     AND NEW.instalador_id IS DISTINCT FROM OLD.instalador_id THEN
    
    -- Buscar percentual do NOVO instalador
    SELECT COALESCE(u.percentual_mao_obra, 50) INTO percentual
    FROM usuarios u
    WHERE u.id = NEW.instalador_id;
    
    -- Buscar valor original da mão de obra (da cotação)
    SELECT COALESCE(c.valor_estimado, 0) INTO valor_mao_obra_original
    FROM cotacoes c
    WHERE c.id = NEW.cotacao_id;
    
    -- Recalcular valor do instalador com o percentual do NOVO instalador
    NEW.valor_mao_obra_instalador := valor_mao_obra_original * (percentual / 100.0);
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;