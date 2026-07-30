-- Ajuste manual de saldo de estoque (correção de inventário, perda, quebra),
-- sem precisar vincular a um serviço. Registra o motivo em estoque_movimentos.

ALTER TABLE public.estoque_movimentos
  ADD COLUMN observacoes TEXT;

ALTER TABLE public.estoque_movimentos
  DROP CONSTRAINT estoque_movimentos_tipo_check;

ALTER TABLE public.estoque_movimentos
  ADD CONSTRAINT estoque_movimentos_tipo_check
  CHECK (tipo = ANY (ARRAY['baixa'::text, 'devolucao'::text, 'ajuste_entrada'::text, 'ajuste_saida'::text]));

CREATE OR REPLACE FUNCTION public.ajustar_estoque_manual(
  p_catalogo_id UUID,
  p_quantidade INTEGER,
  p_motivo TEXT
)
RETURNS TABLE(custo_total NUMERIC, qtd_atendida INTEGER, qtd_faltante INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa    UUID;
  v_permitido  BOOLEAN;
  v_custo_ref  NUMERIC;
  v_lote_id    UUID;
  v_restante   INTEGER;
  v_custo      NUMERIC := 0;
  v_atendida   INTEGER := 0;
  v_usar       INTEGER;
  lote         RECORD;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade = 0 THEN
    RAISE EXCEPTION 'Quantidade do ajuste não pode ser zero.';
  END IF;

  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Informe o motivo do ajuste.';
  END IF;

  SELECT empresa_id INTO v_empresa FROM public.catalogo_servicos WHERE id = p_catalogo_id;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Acessório não encontrado.';
  END IF;

  v_permitido :=
    has_role(auth.uid(), 'admin'::app_role)
    AND v_empresa IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid());

  IF NOT v_permitido THEN
    RAISE EXCEPTION 'Você não tem permissão para ajustar este estoque.';
  END IF;

  IF p_quantidade > 0 THEN
    -- entrada: cria um lote novo, usando o menor custo disponível como referência
    -- (ou 0 se não houver nenhum lote ainda para esse acessório)
    SELECT menor_custo_disponivel INTO v_custo_ref
    FROM public.estoque_saldo
    WHERE catalogo_id = p_catalogo_id AND empresa_id = v_empresa;
    v_custo_ref := COALESCE(v_custo_ref, 0);

    INSERT INTO public.estoque_lotes (
      empresa_id, catalogo_id, quantidade, qtd_restante, custo_unitario,
      data_compra, observacoes
    ) VALUES (
      v_empresa, p_catalogo_id, p_quantidade, p_quantidade, v_custo_ref,
      CURRENT_DATE, 'Ajuste manual: ' || p_motivo
    )
    RETURNING id INTO v_lote_id;

    INSERT INTO public.estoque_movimentos (
      empresa_id, lote_id, catalogo_id, servico_id, tipo,
      quantidade, custo_unitario, custo_total, observacoes
    ) VALUES (
      v_empresa, v_lote_id, p_catalogo_id, NULL, 'ajuste_entrada',
      p_quantidade, v_custo_ref, ROUND(p_quantidade * v_custo_ref, 2), p_motivo
    );

    RETURN QUERY SELECT ROUND(p_quantidade * v_custo_ref, 2), p_quantidade, 0;
    RETURN;
  END IF;

  -- saída: consome os lotes existentes em ordem FIFO, igual baixar_estoque_fifo,
  -- mas sem vínculo com serviço e registrando o motivo.
  v_restante := ABS(p_quantidade);

  FOR lote IN
    SELECT id, qtd_restante, custo_unitario
    FROM public.estoque_lotes
    WHERE catalogo_id = p_catalogo_id AND qtd_restante > 0
    ORDER BY data_compra ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0;

    v_usar := LEAST(v_restante, lote.qtd_restante);

    UPDATE public.estoque_lotes
    SET qtd_restante = qtd_restante - v_usar
    WHERE id = lote.id;

    INSERT INTO public.estoque_movimentos (
      empresa_id, lote_id, catalogo_id, servico_id, tipo,
      quantidade, custo_unitario, custo_total, observacoes
    ) VALUES (
      v_empresa, lote.id, p_catalogo_id, NULL, 'ajuste_saida',
      v_usar, lote.custo_unitario, ROUND(v_usar * lote.custo_unitario, 2), p_motivo
    );

    v_custo    := v_custo + (v_usar * lote.custo_unitario);
    v_atendida := v_atendida + v_usar;
    v_restante := v_restante - v_usar;
  END LOOP;

  RETURN QUERY SELECT ROUND(v_custo, 2), v_atendida, v_restante;
END;
$function$;
