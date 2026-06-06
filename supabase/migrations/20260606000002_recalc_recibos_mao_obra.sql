-- Recalcula valor_mao_obra e valor_total em todos os recibos
-- usando a soma de valor_mao_obra_instalador dos serviços vinculados
UPDATE public.recibos_diarios rd
SET
  valor_mao_obra = (
    SELECT COALESCE(SUM(s.valor_mao_obra_instalador), 0)
    FROM public.servicos s
    WHERE s.id = ANY(rd.servicos_ids)
  ),
  valor_total = (
    SELECT COALESCE(SUM(s.valor_mao_obra_instalador), 0)
    FROM public.servicos s
    WHERE s.id = ANY(rd.servicos_ids)
  );
