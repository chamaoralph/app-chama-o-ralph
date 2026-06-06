-- Corrigir trigger: receita = valor_mao_obra_instalador * 2, sem reembolsos
CREATE OR REPLACE FUNCTION public.registrar_no_caixa_ao_aprovar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status <> 'concluido') THEN

    -- Receita bruta de mão de obra (50% empresa + 50% instalador)
    INSERT INTO public.lancamentos_caixa (
      empresa_id, servico_id, tipo, categoria, descricao, valor, data_lancamento, forma_pagamento
    ) VALUES (
      NEW.empresa_id, NEW.id, 'receita', 'Receita de Serviço',
      'Receita do serviço ' || NEW.codigo,
      COALESCE(NEW.valor_mao_obra_instalador, 0) * 2,
      CURRENT_DATE, 'Pix'
    )
    ON CONFLICT (servico_id, tipo, categoria) DO NOTHING;

    -- Pagamento ao instalador
    INSERT INTO public.lancamentos_caixa (
      empresa_id, servico_id, tipo, categoria, descricao, valor, data_lancamento, forma_pagamento
    ) VALUES (
      NEW.empresa_id, NEW.id, 'despesa', 'Pagamento Instalador',
      'Pagamento instalador - ' || NEW.codigo,
      COALESCE(NEW.valor_mao_obra_instalador, 0),
      CURRENT_DATE, 'Pix'
    )
    ON CONFLICT (servico_id, tipo, categoria) DO NOTHING;

  END IF;

  RETURN NEW;
END;
$function$;

-- Corrigir lançamentos de receita já existentes: valor_total → valor_mao_obra_instalador * 2
UPDATE public.lancamentos_caixa lc
SET valor = COALESCE(s.valor_mao_obra_instalador, 0) * 2
FROM public.servicos s
WHERE lc.servico_id = s.id
  AND lc.tipo = 'receita'
  AND lc.categoria = 'Receita de Serviço';

-- Remover lançamentos de reembolso (não devem constar no caixa)
DELETE FROM public.lancamentos_caixa
WHERE categoria = 'Reembolso Materiais';
