-- Atualizar função para criar APENAS receita quando serviço é concluído
-- Pagamentos do instalador serão criados apenas pelo trigger do recibo
CREATE OR REPLACE FUNCTION public.registrar_no_caixa_ao_aprovar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status <> 'concluido') THEN

    -- APENAS Receita do serviço
    INSERT INTO public.lancamentos_caixa (
      empresa_id, servico_id, tipo, categoria, descricao, valor, data_lancamento, forma_pagamento
    ) VALUES (
      NEW.empresa_id, NEW.id, 'receita', 'Receita de Serviço',
      'Receita do serviço ' || NEW.codigo, NEW.valor_total, CURRENT_DATE, 'Pix'
    )
    ON CONFLICT (servico_id, tipo, categoria) DO NOTHING;

    -- REMOVIDO: Pagamento ao instalador (será criado quando o recibo for marcado como pago)
    -- REMOVIDO: Reembolso de materiais (será criado quando o recibo for marcado como pago)

  END IF;

  RETURN NEW;
END;
$function$;

-- Limpar lançamentos duplicados existentes (criados pelo trigger antigo)
DELETE FROM lancamentos_caixa 
WHERE categoria = 'Pagamento Instalador' 
  AND servico_id IS NOT NULL;

DELETE FROM lancamentos_caixa 
WHERE categoria = 'Reembolso Materiais' 
  AND servico_id IS NOT NULL;