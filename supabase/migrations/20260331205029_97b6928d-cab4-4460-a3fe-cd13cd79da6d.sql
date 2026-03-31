CREATE OR REPLACE FUNCTION public.handle_delete_cotacao_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_statuses_bloqueados text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.empresa_id = OLD.empresa_id
      AND u.tipo = 'admin'
  ) THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta cotação.';
  END IF;

  SELECT string_agg(DISTINCT COALESCE(s.status, 'sem_status'), ', ')
  INTO v_statuses_bloqueados
  FROM public.servicos s
  WHERE s.cotacao_id = OLD.id
    AND s.empresa_id = OLD.empresa_id
    AND COALESCE(s.status, '') NOT IN ('disponivel', 'solicitado', 'cancelado');

  IF v_statuses_bloqueados IS NOT NULL THEN
    RAISE EXCEPTION 'Esta cotação já gerou um serviço com status "%". Remova ou reverta o serviço antes de excluir a cotação.', v_statuses_bloqueados;
  END IF;

  DELETE FROM public.movimentacoes_suportes
  WHERE servico_id IN (
    SELECT s.id
    FROM public.servicos s
    WHERE s.cotacao_id = OLD.id
      AND s.empresa_id = OLD.empresa_id
  );

  DELETE FROM public.lancamentos_caixa
  WHERE servico_id IN (
    SELECT s.id
    FROM public.servicos s
    WHERE s.cotacao_id = OLD.id
      AND s.empresa_id = OLD.empresa_id
  );

  DELETE FROM public.servicos
  WHERE cotacao_id = OLD.id
    AND empresa_id = OLD.empresa_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS before_delete_cotacao_cleanup ON public.cotacoes;

CREATE TRIGGER before_delete_cotacao_cleanup
BEFORE DELETE ON public.cotacoes
FOR EACH ROW
EXECUTE FUNCTION public.handle_delete_cotacao_cleanup();