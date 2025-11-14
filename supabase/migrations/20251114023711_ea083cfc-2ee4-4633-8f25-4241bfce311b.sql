-- 1) Padronizar categorias antigas relacionadas à receita
UPDATE public.lancamentos_caixa
SET categoria = 'Receita de Serviço'
WHERE categoria IN ('Serviço', 'Receita do Serviço', 'Receita de Servico');

-- 2) Deduplicar lançamentos automáticos, mantendo apenas o primeiro por (servico_id, tipo, categoria)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY servico_id, tipo, categoria
      ORDER BY created_at, id
    ) AS rn
  FROM public.lancamentos_caixa
  WHERE categoria IN ('Receita de Serviço','Pagamento Instalador','Reembolso Materiais')
),

to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.lancamentos_caixa lc
USING to_delete d
WHERE lc.id = d.id;

-- 3) Atualizar a função para usar ON CONFLICT (defesa contra duplicação)
CREATE OR REPLACE FUNCTION public.registrar_no_caixa_ao_aprovar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status <> 'concluido') THEN

    -- Receita do serviço
    INSERT INTO public.lancamentos_caixa (
      empresa_id, servico_id, tipo, categoria, descricao, valor, data_lancamento, forma_pagamento
    ) VALUES (
      NEW.empresa_id, NEW.id, 'receita', 'Receita de Serviço',
      'Receita do serviço ' || NEW.codigo, NEW.valor_total, CURRENT_DATE, 'Pix'
    )
    ON CONFLICT (servico_id, tipo, categoria) DO NOTHING;

    -- Pagamento ao instalador
    INSERT INTO public.lancamentos_caixa (
      empresa_id, servico_id, tipo, categoria, descricao, valor, data_lancamento, forma_pagamento
    ) VALUES (
      NEW.empresa_id, NEW.id, 'despesa', 'Pagamento Instalador',
      'Pagamento instalador - ' || NEW.codigo, NEW.valor_mao_obra_instalador, CURRENT_DATE, 'Pix'
    )
    ON CONFLICT (servico_id, tipo, categoria) DO NOTHING;

    -- Reembolso de materiais (se houver)
    IF NEW.valor_reembolso_despesas > 0 THEN
      INSERT INTO public.lancamentos_caixa (
        empresa_id, servico_id, tipo, categoria, descricao, valor, data_lancamento, forma_pagamento
      ) VALUES (
        NEW.empresa_id, NEW.id, 'despesa', 'Reembolso Materiais',
        'Reembolso materiais - ' || NEW.codigo, NEW.valor_reembolso_despesas, CURRENT_DATE, 'Pix'
      )
      ON CONFLICT (servico_id, tipo, categoria) DO NOTHING;
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Garantir que só exista um trigger de registro no caixa (AFTER UPDATE)
DROP TRIGGER IF EXISTS trigger_registrar_caixa ON public.servicos;
DROP TRIGGER IF EXISTS trigger_registrar_no_caixa_ao_aprovar ON public.servicos;

CREATE TRIGGER trigger_registrar_no_caixa_ao_aprovar
AFTER UPDATE ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.registrar_no_caixa_ao_aprovar();

-- 5) Índice único parcial para evitar duplicações futuras
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'ux_lancamentos_unicos'
      AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX ux_lancamentos_unicos
    ON public.lancamentos_caixa (servico_id, tipo, categoria)
    WHERE categoria IN ('Receita de Serviço','Pagamento Instalador','Reembolso Materiais');
  END IF;
END$$;