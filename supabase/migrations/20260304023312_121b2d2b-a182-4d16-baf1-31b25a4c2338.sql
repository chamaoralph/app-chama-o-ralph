
-- 1) Recriar trigger para usar data_servico_agendada ao invés de CURRENT_DATE
CREATE OR REPLACE FUNCTION public.registrar_no_caixa_ao_aprovar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status <> 'concluido') THEN

    INSERT INTO public.lancamentos_caixa (
      empresa_id, servico_id, tipo, categoria, descricao, valor, data_lancamento, forma_pagamento
    ) VALUES (
      NEW.empresa_id, NEW.id, 'receita', 'Receita de Serviço',
      'Receita do serviço ' || NEW.codigo, NEW.valor_total, (NEW.data_servico_agendada)::date, 'Pix'
    )
    ON CONFLICT (servico_id, tipo, categoria) DO NOTHING;

  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Corrigir dados existentes
UPDATE lancamentos_caixa lc
SET data_lancamento = (s.data_servico_agendada)::date
FROM servicos s
WHERE lc.servico_id = s.id
  AND lc.categoria = 'Receita de Serviço'
  AND lc.data_lancamento != (s.data_servico_agendada)::date;
