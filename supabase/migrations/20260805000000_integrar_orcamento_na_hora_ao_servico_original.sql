-- "Orçamento na hora" (adendo vendido pelo instalador de dentro de um
-- serviço já em andamento) hoje aprova como uma cotação normal, o que
-- dispara criar_servico_ao_confirmar() e cria um SERVIÇO NOVO e separado —
-- o item vendido nunca ficava junto do serviço de origem, e a cotação nem
-- guardava de qual serviço ela tinha nascido (só sabia o cliente_id).
--
-- Ajusta pra integrar ao serviço original:
--   - item de acessório entra em acessorios_vendidos/ganho_acessorios_*
--     (regra 70/30 já usada em baixar_estoque_ao_aprovar_cotacao, com baixa
--     FIFO real no estoque quando fornecedor = empresa);
--   - item de mão de obra extra (ou "Desconto fechando agora", valor
--     negativo) soma em valor_total e recalcula valor_mao_obra_instalador
--     com o percentual_mao_obra do instalador (50% por padrão) —
--     tudo no mesmo registro de servicos. Nenhum serviço novo é criado.
--
-- Nem criar_orcamento_na_hora, aprovar_orcamento_na_hora nem
-- recusar_orcamento_na_hora estavam versionadas antes desta migration
-- (foram criadas direto no banco) — a definição abaixo reflete o estado
-- real encontrado em produção em 2026-08-05.

-- 1) Vínculo com o serviço de origem, pra achar de volta na hora de aprovar.
alter table public.cotacoes
  add column if not exists servico_origem_id uuid references public.servicos(id);

-- 2) criar_orcamento_na_hora agora grava esse vínculo.
CREATE OR REPLACE FUNCTION public.criar_orcamento_na_hora(p_servico_id uuid, p_itens jsonb, p_valor_total numeric, p_descricao text, p_tipo_servico text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente_id UUID;
  v_empresa_id UUID;
  v_cotacao_id UUID;
BEGIN
  SELECT s.cliente_id, s.empresa_id
    INTO v_cliente_id, v_empresa_id
  FROM public.servicos s
  WHERE s.id = p_servico_id
    AND s.instalador_id = auth.uid();

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Serviço não encontrado ou não atribuído a você.';
  END IF;

  IF p_valor_total IS NULL OR p_valor_total <= 0 THEN
    RAISE EXCEPTION 'O orçamento precisa ter um valor maior que zero.';
  END IF;

  IF p_tipo_servico IS NULL OR array_length(p_tipo_servico, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um item para o orçamento.';
  END IF;

  INSERT INTO public.cotacoes (
    empresa_id, cliente_id, valor_estimado, tipo_servico,
    descricao_servico, itens_extras, origem_lead, status, servico_origem_id
  ) VALUES (
    v_empresa_id, v_cliente_id, p_valor_total, p_tipo_servico,
    p_descricao, COALESCE(p_itens, '[]'::jsonb), 'Orçamento na hora', 'pendente', p_servico_id
  )
  RETURNING id INTO v_cotacao_id;

  RETURN v_cotacao_id;
END;
$function$;

-- 3) aprovar_orcamento_na_hora não passa mais pelo caminho normal de
--    aprovação de cotação (que criaria um serviço novo) — integra direto
--    no serviço de origem e só então marca a cotação como aprovada
--    (histórico/idempotência).
CREATE OR REPLACE FUNCTION public.aprovar_orcamento_na_hora(p_cotacao_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cotacao RECORD;
  v_servico RECORD;
  item JSONB;
  v_quantidade NUMERIC;
  v_valor_venda NUMERIC;
  v_custo_provisorio NUMERIC;
  v_fornecedor TEXT;
  v_custo_real NUMERIC;
  v_lucro NUMERIC;
  v_parte_fornecedor NUMERIC;
  v_parte_outro NUMERIC;
  v_repasse_instalador NUMERIC;
  v_repasse_empresa NUMERIC;
  v_reembolso_instalador_item NUMERIC;
  v_ganho_instalador_item NUMERIC;
  v_reembolso_empresa_item NUMERIC;
  v_ganho_empresa_item NUMERIC;
  v_soma_reembolso_instalador NUMERIC := 0;
  v_soma_reembolso_empresa NUMERIC := 0;
  v_soma_ganho_instalador NUMERIC := 0;
  v_soma_ganho_empresa NUMERIC := 0;
  v_soma_valor_mao_obra NUMERIC := 0;
  v_novos_acessorios JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO v_cotacao FROM public.cotacoes WHERE id = p_cotacao_id;

  IF v_cotacao.id IS NULL THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;

  -- Idempotência: clique duplo (ou retry) não reprocessa baixa de estoque/repasse.
  IF v_cotacao.status = 'aprovada' THEN
    RETURN v_cotacao.servico_origem_id;
  END IF;

  IF v_cotacao.servico_origem_id IS NULL THEN
    RAISE EXCEPTION 'Orçamento sem serviço de origem — não é possível aprovar.';
  END IF;

  SELECT s.*, COALESCE(u.percentual_mao_obra, 50) AS percentual_instalador
    INTO v_servico
  FROM public.servicos s
  LEFT JOIN public.usuarios u ON u.id = s.instalador_id
  WHERE s.id = v_cotacao.servico_origem_id
    AND s.instalador_id = auth.uid();

  IF v_servico.id IS NULL THEN
    RAISE EXCEPTION 'Você não tem permissão sobre este orçamento.';
  END IF;

  IF v_cotacao.itens_extras IS NOT NULL AND jsonb_typeof(v_cotacao.itens_extras) = 'array' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(v_cotacao.itens_extras)
    LOOP
      v_valor_venda := COALESCE((item->>'valor')::numeric, 0);

      IF COALESCE((item->>'eh_acessorio')::boolean, false) IS TRUE THEN
        v_quantidade := COALESCE((item->>'quantidade')::numeric, 1);
        v_custo_provisorio := COALESCE((item->>'custo_unitario')::numeric, 0) * v_quantidade;
        v_fornecedor := item->>'fornecedor';
        v_custo_real := v_custo_provisorio;

        -- Só acessório fornecido pela empresa dá baixa em estoque real (FIFO) —
        -- o fornecido pelo instalador é peça própria dele, sem lote da empresa.
        IF v_fornecedor = 'empresa' AND item->>'catalogo_id' IS NOT NULL THEN
          SELECT custo_total INTO v_custo_real
          FROM public.baixar_estoque_fifo(
            (item->>'catalogo_id')::uuid,
            v_quantidade::int,
            v_servico.id
          );
          v_custo_real := COALESCE(v_custo_real, 0);
        END IF;

        -- Regra 70/30, igual baixar_estoque_ao_aprovar_cotacao().
        v_lucro := GREATEST(0, v_valor_venda - v_custo_real);
        v_parte_fornecedor := ROUND(v_lucro * 0.70, 2);
        v_parte_outro := ROUND(v_lucro - v_parte_fornecedor, 2);

        IF v_fornecedor = 'instalador' THEN
          v_repasse_instalador := ROUND(v_custo_real + v_parte_fornecedor, 2);
          v_repasse_empresa := v_parte_outro;
          v_reembolso_instalador_item := v_custo_real;
          v_ganho_instalador_item := ROUND(v_repasse_instalador - v_custo_real, 2);
          v_reembolso_empresa_item := 0;
          v_ganho_empresa_item := v_repasse_empresa;
        ELSE
          v_repasse_empresa := ROUND(v_custo_real + v_parte_fornecedor, 2);
          v_repasse_instalador := v_parte_outro;
          v_reembolso_instalador_item := 0;
          v_ganho_instalador_item := v_repasse_instalador;
          v_reembolso_empresa_item := v_custo_real;
          v_ganho_empresa_item := ROUND(v_repasse_empresa - v_custo_real, 2);
        END IF;

        v_soma_reembolso_instalador := v_soma_reembolso_instalador + v_reembolso_instalador_item;
        v_soma_reembolso_empresa := v_soma_reembolso_empresa + v_reembolso_empresa_item;
        v_soma_ganho_instalador := v_soma_ganho_instalador + v_ganho_instalador_item;
        v_soma_ganho_empresa := v_soma_ganho_empresa + v_ganho_empresa_item;

        v_novos_acessorios := v_novos_acessorios || jsonb_build_array(jsonb_build_object(
          'catalogo_id', item->>'catalogo_id',
          'nome', item->>'descricao',
          'quantidade', v_quantidade,
          'valor_venda', v_valor_venda,
          'valor_compra', v_custo_real,
          'fornecedor', v_fornecedor,
          'lucro', ROUND(v_valor_venda - v_custo_real, 2),
          'repasse_instalador', v_repasse_instalador,
          'repasse_empresa', v_repasse_empresa,
          'origem', 'orcamento_na_hora'
        ));
      ELSE
        -- item de mão de obra extra (ou "Desconto fechando agora", valor negativo)
        v_soma_valor_mao_obra := v_soma_valor_mao_obra + v_valor_venda;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.servicos
  SET
    valor_total = COALESCE(valor_total, 0) + v_soma_valor_mao_obra,
    valor_mao_obra_instalador = COALESCE(valor_mao_obra_instalador, 0)
      + ROUND(v_soma_valor_mao_obra * (v_servico.percentual_instalador / 100.0), 2),
    valor_reembolso_despesas = COALESCE(valor_reembolso_despesas, 0) + v_soma_reembolso_instalador,
    custo_suporte = COALESCE(custo_suporte, 0) + v_soma_reembolso_empresa,
    ganho_acessorios_instalador = COALESCE(ganho_acessorios_instalador, 0) + v_soma_ganho_instalador,
    ganho_acessorios_empresa = COALESCE(ganho_acessorios_empresa, 0) + v_soma_ganho_empresa,
    acessorios_vendidos = COALESCE(acessorios_vendidos, '[]'::jsonb) || v_novos_acessorios
  WHERE id = v_servico.id;

  -- Marca como aprovada só pra histórico/idempotência — servico_origem_id
  -- preenchido faz criar_servico_ao_confirmar() e
  -- baixar_estoque_ao_aprovar_cotacao() pularem (não criam serviço novo nem
  -- reprocessam acessório/estoque, já foi tudo feito acima).
  UPDATE public.cotacoes SET status = 'aprovada' WHERE id = p_cotacao_id;

  RETURN v_servico.id;
END;
$function$;

-- 4) Guarda nos triggers genéricos de cotação->serviço: quando a cotação tem
--    servico_origem_id preenchido (veio de "Orçamento na hora"), quem já
--    processou tudo foi aprovar_orcamento_na_hora() acima.
CREATE OR REPLACE FUNCTION public.criar_servico_ao_confirmar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    novo_codigo TEXT;
    contador INTEGER;
    valor_mao_obra_calc NUMERIC;
    valor_reembolso_calc NUMERIC;
    valor_total_calc NUMERIC;
    data_hora_agendada TIMESTAMP;
    base_calculo NUMERIC;
    v_soma_acessorios_venda NUMERIC := 0;
    v_reembolso_instalador_acessorios NUMERIC := 0;
    v_reembolso_empresa_acessorios NUMERIC := 0;
    v_ganho_acessorios_instalador NUMERIC := 0;
    v_ganho_acessorios_empresa NUMERIC := 0;
    v_acessorios_vendidos JSONB := '[]'::jsonb;
BEGIN
    IF NEW.status = 'aprovada' AND (OLD.status IS NULL OR OLD.status != 'aprovada') THEN

        IF NEW.servico_origem_id IS NOT NULL THEN
            RETURN NEW;
        END IF;

        IF NEW.valor_estimado IS NULL OR NEW.valor_estimado <= 0 THEN
            RAISE EXCEPTION 'Cotação sem valor estimado. Preencha o tamanho/parede da TV (ou um valor manual) antes de aprovar.';
        END IF;

        SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 10) AS INTEGER)), 0) + 1
        INTO contador
        FROM servicos
        WHERE empresa_id = NEW.empresa_id
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

        novo_codigo := 'SRV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(contador::TEXT, 3, '0');

        IF NEW.data_servico_desejada IS NOT NULL AND NEW.horario_inicio IS NOT NULL THEN
            data_hora_agendada := (NEW.data_servico_desejada::DATE + NEW.horario_inicio::TIME)::TIMESTAMP;
        ELSIF NEW.data_servico_desejada IS NOT NULL THEN
            data_hora_agendada := NEW.data_servico_desejada::TIMESTAMP;
        ELSE
            data_hora_agendada := NOW();
        END IF;

        WITH acessorios AS (
            SELECT
                item->>'catalogo_id' AS catalogo_id,
                item->>'descricao' AS nome,
                COALESCE((item->>'quantidade')::numeric, 1) AS quantidade,
                COALESCE((item->>'valor')::numeric, 0) AS valor_venda,
                COALESCE((item->>'custo_unitario')::numeric, 0) * COALESCE((item->>'quantidade')::numeric, 1) AS valor_compra,
                item->>'fornecedor' AS fornecedor,
                COALESCE((item->>'repasse_instalador')::numeric, 0) AS repasse_instalador,
                COALESCE((item->>'repasse_empresa')::numeric, 0) AS repasse_empresa
            FROM jsonb_array_elements(COALESCE(NEW.itens_extras, '[]'::jsonb)) AS item
            WHERE COALESCE((item->>'eh_acessorio')::boolean, false) IS TRUE
        ),
        decompostos AS (
            SELECT
                *,
                ROUND(valor_venda - valor_compra, 2) AS lucro,
                CASE WHEN fornecedor = 'instalador' THEN valor_compra ELSE 0 END AS reembolso_instalador,
                CASE WHEN fornecedor = 'instalador' THEN ROUND(repasse_instalador - valor_compra, 2) ELSE repasse_instalador END AS ganho_instalador,
                CASE WHEN fornecedor = 'instalador' THEN 0 ELSE valor_compra END AS reembolso_empresa,
                CASE WHEN fornecedor = 'instalador' THEN repasse_empresa ELSE ROUND(repasse_empresa - valor_compra, 2) END AS ganho_empresa
            FROM acessorios
        )
        SELECT
            COALESCE(SUM(valor_venda), 0),
            COALESCE(SUM(reembolso_instalador), 0),
            COALESCE(SUM(reembolso_empresa), 0),
            COALESCE(SUM(ganho_instalador), 0),
            COALESCE(SUM(ganho_empresa), 0),
            COALESCE(jsonb_agg(jsonb_build_object(
                'catalogo_id', catalogo_id,
                'nome', nome,
                'quantidade', quantidade,
                'valor_venda', valor_venda,
                'valor_compra', valor_compra,
                'fornecedor', fornecedor,
                'lucro', lucro,
                'repasse_instalador', repasse_instalador,
                'repasse_empresa', repasse_empresa,
                'origem', 'cotacao'
            )), '[]'::jsonb)
        INTO
            v_soma_acessorios_venda,
            v_reembolso_instalador_acessorios,
            v_reembolso_empresa_acessorios,
            v_ganho_acessorios_instalador,
            v_ganho_acessorios_empresa,
            v_acessorios_vendidos
        FROM decompostos;

        IF NEW.origem_suporte = 'empresa' THEN
            base_calculo := COALESCE(NEW.valor_estimado, 0) - COALESCE(NEW.custo_suporte, 0) - v_soma_acessorios_venda;
        ELSE
            base_calculo := COALESCE(NEW.valor_estimado, 0) - v_soma_acessorios_venda;
        END IF;

        valor_mao_obra_calc := base_calculo * 0.50;

        IF NEW.origem_suporte = 'instalador' THEN
            valor_reembolso_calc := COALESCE(NEW.valor_material, 0) + COALESCE(NEW.custo_suporte, 0) + v_reembolso_instalador_acessorios;
        ELSE
            valor_reembolso_calc := v_reembolso_instalador_acessorios;
        END IF;

        IF NEW.origem_suporte = 'instalador' THEN
            valor_total_calc := COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0) + COALESCE(NEW.custo_suporte, 0) - v_soma_acessorios_venda;
        ELSE
            valor_total_calc := COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0) - v_soma_acessorios_venda;
        END IF;

        INSERT INTO servicos (
            codigo, empresa_id, cotacao_id, cliente_id,
            data_servico_agendada, tipo_servico, descricao,
            endereco_completo, valor_total, valor_mao_obra_instalador,
            valor_reembolso_despesas, origem_suporte, custo_suporte, status,
            ganho_acessorios_instalador, ganho_acessorios_empresa, acessorios_vendidos
        )
        SELECT
            novo_codigo, NEW.empresa_id, NEW.id, NEW.cliente_id,
            data_hora_agendada, NEW.tipo_servico, NEW.descricao_servico,
            COALESCE(c.endereco_completo, 'Endereço não informado'),
            valor_total_calc, valor_mao_obra_calc,
            valor_reembolso_calc, NEW.origem_suporte,
            COALESCE(NEW.custo_suporte, 0) + v_reembolso_empresa_acessorios, 'disponivel',
            v_ganho_acessorios_instalador, v_ganho_acessorios_empresa, v_acessorios_vendidos
        FROM clientes c
        WHERE c.id = NEW.cliente_id;

    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.baixar_estoque_ao_aprovar_cotacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_servico_id UUID;
  item         JSONB;
  v_quantidade NUMERIC;
  v_valor_venda NUMERIC;
  v_custo_provisorio NUMERIC;
  v_fornecedor TEXT;
  v_repasse_instalador NUMERIC;
  v_repasse_empresa NUMERIC;
  v_custo_real NUMERIC;
  v_lucro NUMERIC;
  v_parte_fornecedor NUMERIC;
  v_parte_outro NUMERIC;
  v_reembolso_instalador_item NUMERIC;
  v_ganho_instalador_item NUMERIC;
  v_reembolso_empresa_item NUMERIC;
  v_ganho_empresa_item NUMERIC;
  v_soma_reembolso_instalador NUMERIC := 0;
  v_soma_reembolso_empresa NUMERIC := 0;
  v_soma_ganho_instalador NUMERIC := 0;
  v_soma_ganho_empresa NUMERIC := 0;
  v_acessorios_vendidos JSONB := '[]'::jsonb;
  v_tem_acessorio BOOLEAN := FALSE;
  v_reembolso_base NUMERIC;
  v_custo_suporte_base NUMERIC;
BEGIN
  IF NEW.status = 'aprovada' AND (OLD.status IS NULL OR OLD.status <> 'aprovada') THEN

    IF NEW.servico_origem_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT id INTO v_servico_id
    FROM public.servicos
    WHERE cotacao_id = NEW.id
    ORDER BY created_at DESC
    LIMIT 1;

    IF NEW.itens_extras IS NOT NULL AND jsonb_typeof(NEW.itens_extras) = 'array' THEN
      FOR item IN SELECT * FROM jsonb_array_elements(NEW.itens_extras)
      LOOP
        IF (item->>'eh_acessorio')::boolean IS TRUE THEN
          v_tem_acessorio := TRUE;
          v_quantidade := COALESCE((item->>'quantidade')::numeric, 1);
          v_valor_venda := COALESCE((item->>'valor')::numeric, 0);
          v_custo_provisorio := COALESCE((item->>'custo_unitario')::numeric, 0) * v_quantidade;
          v_fornecedor := item->>'fornecedor';
          v_custo_real := v_custo_provisorio;

          -- Só acessório fornecido pela empresa dá baixa em estoque (o
          -- instalador-fornecido é peça própria dele, sem lote da empresa).
          IF v_fornecedor = 'empresa' AND item->>'catalogo_id' IS NOT NULL THEN
            SELECT custo_total INTO v_custo_real
            FROM public.baixar_estoque_fifo(
              (item->>'catalogo_id')::uuid,
              v_quantidade::int,
              v_servico_id
            );
            v_custo_real := COALESCE(v_custo_real, 0);
          END IF;

          -- Regra 70/30 (mesma fórmula de calcularRepasseAcessorio), agora
          -- com o custo REAL (FIFO) quando fornecedor = empresa.
          v_lucro := GREATEST(0, v_valor_venda - v_custo_real);
          v_parte_fornecedor := ROUND(v_lucro * 0.70, 2);
          v_parte_outro := ROUND(v_lucro - v_parte_fornecedor, 2);

          IF v_fornecedor = 'instalador' THEN
            v_repasse_instalador := ROUND(v_custo_real + v_parte_fornecedor, 2);
            v_repasse_empresa := v_parte_outro;
            v_reembolso_instalador_item := v_custo_real;
            v_ganho_instalador_item := ROUND(v_repasse_instalador - v_custo_real, 2);
            v_reembolso_empresa_item := 0;
            v_ganho_empresa_item := v_repasse_empresa;
          ELSE
            v_repasse_empresa := ROUND(v_custo_real + v_parte_fornecedor, 2);
            v_repasse_instalador := v_parte_outro;
            v_reembolso_instalador_item := 0;
            v_ganho_instalador_item := v_repasse_instalador;
            v_reembolso_empresa_item := v_custo_real;
            v_ganho_empresa_item := ROUND(v_repasse_empresa - v_custo_real, 2);
          END IF;

          v_soma_reembolso_instalador := v_soma_reembolso_instalador + v_reembolso_instalador_item;
          v_soma_reembolso_empresa := v_soma_reembolso_empresa + v_reembolso_empresa_item;
          v_soma_ganho_instalador := v_soma_ganho_instalador + v_ganho_instalador_item;
          v_soma_ganho_empresa := v_soma_ganho_empresa + v_ganho_empresa_item;

          v_acessorios_vendidos := v_acessorios_vendidos || jsonb_build_array(jsonb_build_object(
            'catalogo_id', item->>'catalogo_id',
            'nome', item->>'descricao',
            'quantidade', v_quantidade,
            'valor_venda', v_valor_venda,
            'valor_compra', v_custo_real,
            'fornecedor', v_fornecedor,
            'lucro', ROUND(v_valor_venda - v_custo_real, 2),
            'repasse_instalador', v_repasse_instalador,
            'repasse_empresa', v_repasse_empresa,
            'origem', 'cotacao'
          ));
        END IF;
      END LOOP;
    END IF;

    IF v_servico_id IS NOT NULL AND v_tem_acessorio THEN
      v_reembolso_base := CASE WHEN NEW.origem_suporte = 'instalador'
        THEN COALESCE(NEW.valor_material, 0) + COALESCE(NEW.custo_suporte, 0)
        ELSE 0 END;
      v_custo_suporte_base := COALESCE(NEW.custo_suporte, 0);

      UPDATE public.servicos
      SET
        valor_reembolso_despesas = v_reembolso_base + v_soma_reembolso_instalador,
        custo_suporte = v_custo_suporte_base + v_soma_reembolso_empresa,
        ganho_acessorios_instalador = v_soma_ganho_instalador,
        ganho_acessorios_empresa = v_soma_ganho_empresa,
        acessorios_vendidos = v_acessorios_vendidos
      WHERE id = v_servico_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;
