-- Bug: registrar_no_caixa_ao_aprovar() só lançava receita de mão de obra
-- (valor_mao_obra_instalador * 2) — o lucro da empresa na venda de
-- acessórios (ganho_acessorios_empresa, fatia 70/30 calculada em
-- calcularRepasseAcessorio) nunca virava lançamento de receita, então nunca
-- aparecia no Caixa (/admin/caixa). Reportado pelo usuário em 2026-08-13,
-- ver memória do projeto (project_estoque_acessorios_origem_estoque.md).

CREATE OR REPLACE FUNCTION public.registrar_no_caixa_ao_aprovar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_receita numeric;
  v_ganho_acessorios numeric;
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status <> 'concluido') THEN

    IF COALESCE(NEW.valor_mao_obra_instalador, 0) = 0 THEN
      v_receita := COALESCE(NEW.valor_total, 0);
    ELSE
      v_receita := COALESCE(NEW.valor_mao_obra_instalador, 0) * 2;
    END IF;

    -- Receita de mão de obra
    INSERT INTO public.lancamentos_caixa (
      empresa_id, servico_id, tipo, categoria, descricao, valor, data_lancamento, forma_pagamento
    ) VALUES (
      NEW.empresa_id, NEW.id, 'receita', 'Receita de Serviço',
      'Receita do serviço ' || NEW.codigo,
      v_receita,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'Pix'
    )
    ON CONFLICT (servico_id, tipo, categoria) DO NOTHING;

    -- Lucro da empresa na venda de acessórios (fatia 70/30) — antes não
    -- entrava no caixa de jeito nenhum.
    v_ganho_acessorios := COALESCE(NEW.ganho_acessorios_empresa, 0);
    IF v_ganho_acessorios > 0 THEN
      INSERT INTO public.lancamentos_caixa (
        empresa_id, servico_id, tipo, categoria, descricao, valor, data_lancamento, forma_pagamento
      ) VALUES (
        NEW.empresa_id, NEW.id, 'receita', 'Lucro Acessórios',
        'Lucro em acessórios do serviço ' || NEW.codigo,
        v_ganho_acessorios,
        (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'Pix'
      )
      ON CONFLICT (servico_id, tipo, categoria) DO NOTHING;
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: serviços já concluídos com ganho_acessorios_empresa > 0 que
-- ficaram sem esse lançamento (13 casos, R$415,24 no total em 2026-08-13).
INSERT INTO public.lancamentos_caixa (empresa_id, servico_id, tipo, categoria, descricao, valor, data_lancamento, forma_pagamento)
SELECT
  s.empresa_id, s.id, 'receita', 'Lucro Acessórios',
  'Lucro em acessórios do serviço ' || s.codigo,
  s.ganho_acessorios_empresa,
  COALESCE(s.data_conclusao, (s.updated_at AT TIME ZONE 'America/Sao_Paulo')::date),
  'Pix'
FROM public.servicos s
WHERE s.status = 'concluido'
  AND COALESCE(s.ganho_acessorios_empresa, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.lancamentos_caixa lc
    WHERE lc.servico_id = s.id AND lc.categoria = 'Lucro Acessórios'
  );
