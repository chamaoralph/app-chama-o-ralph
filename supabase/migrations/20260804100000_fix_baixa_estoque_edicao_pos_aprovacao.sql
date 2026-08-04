-- Bug: acessório fornecido pela empresa adicionado a uma cotação DEPOIS que
-- ela já estava aprovada nunca dava baixa em estoque. A baixa FIFO só
-- acontecia em baixar_estoque_ao_aprovar_cotacao(), disparada só na transição
-- pendente -> aprovada. sincronizar_servico_ao_editar_cotacao() (dispara em
-- qualquer UPDATE de cotações) recalculava valores/ganhos a partir de
-- NEW.itens_extras mas nunca chamava baixar_estoque_fifo — então um acessório
-- editado/adicionado numa cotação já aprovada era cobrado do cliente e
-- contabilizado no ganho, mas a peça nunca saía do estoque central.
--
-- Achado investigando falta de "Cabo HDMI" no estoque físico (SRV-2026-497).
--
-- Correção: quando a cotação editada JÁ estava aprovada antes e continua
-- aprovada (edição pós-aprovação, não a aprovação em si — essa continua só
-- pela trigger de aprovação, evitando baixa duplicada), compara a quantidade
-- de cada acessório fornecido pela empresa entre OLD e NEW itens_extras por
-- catalogo_id; se a quantidade aumentou, dá baixa FIFO só da diferença.
-- Reduções/remoções de item não são tratadas aqui (não devolve estoque
-- automaticamente) — caso raro, fora do escopo deste fix.

CREATE OR REPLACE FUNCTION public.sincronizar_servico_ao_editar_cotacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    percentual_instalador NUMERIC;
    novo_valor_mao_obra NUMERIC;
    nova_data_hora_agendada TIMESTAMP;
    novo_valor_reembolso NUMERIC;
    novo_valor_total NUMERIC;
    base_calculo NUMERIC;
    v_soma_acessorios_venda NUMERIC := 0;
    v_reembolso_instalador_acessorios NUMERIC := 0;
    v_reembolso_empresa_acessorios NUMERIC := 0;
    v_ganho_acessorios_instalador NUMERIC := 0;
    v_ganho_acessorios_empresa NUMERIC := 0;
    v_acessorios_vendidos JSONB := '[]'::jsonb;
    v_servico_id UUID;
    v_delta RECORD;
BEGIN
    IF NEW.data_servico_desejada IS NOT NULL AND NEW.horario_inicio IS NOT NULL THEN
        nova_data_hora_agendada := (NEW.data_servico_desejada::DATE + NEW.horario_inicio::TIME)::TIMESTAMP;
    ELSIF NEW.data_servico_desejada IS NOT NULL THEN
        nova_data_hora_agendada := NEW.data_servico_desejada::TIMESTAMP;
    ELSE
        nova_data_hora_agendada := NULL;
    END IF;

    SELECT COALESCE(u.percentual_mao_obra, 50)
    INTO percentual_instalador
    FROM servicos s
    LEFT JOIN usuarios u ON u.id = s.instalador_id
    WHERE s.cotacao_id = NEW.id;

    IF percentual_instalador IS NULL THEN
        percentual_instalador := 50;
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

    novo_valor_mao_obra := base_calculo * (percentual_instalador / 100.0);

    IF NEW.origem_suporte = 'instalador' THEN
        novo_valor_reembolso := COALESCE(NEW.valor_material, 0) + COALESCE(NEW.custo_suporte, 0) + v_reembolso_instalador_acessorios;
    ELSE
        novo_valor_reembolso := v_reembolso_instalador_acessorios;
    END IF;

    IF NEW.origem_suporte = 'instalador' THEN
        novo_valor_total := COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0) + COALESCE(NEW.custo_suporte, 0) - v_soma_acessorios_venda;
    ELSE
        novo_valor_total := COALESCE(NEW.valor_estimado, 0) + COALESCE(NEW.valor_material, 0) - v_soma_acessorios_venda;
    END IF;

    UPDATE servicos
    SET
        valor_total = novo_valor_total,
        valor_mao_obra_instalador = novo_valor_mao_obra,
        valor_reembolso_despesas = novo_valor_reembolso,
        data_servico_agendada = COALESCE(nova_data_hora_agendada, data_servico_agendada),
        tipo_servico = COALESCE(NEW.tipo_servico, tipo_servico),
        descricao = COALESCE(NEW.descricao_servico, descricao),
        origem_suporte = NEW.origem_suporte,
        custo_suporte = COALESCE(NEW.custo_suporte, 0) + v_reembolso_empresa_acessorios,
        ganho_acessorios_instalador = v_ganho_acessorios_instalador,
        ganho_acessorios_empresa = v_ganho_acessorios_empresa,
        acessorios_vendidos = v_acessorios_vendidos
    WHERE cotacao_id = NEW.id
    RETURNING id INTO v_servico_id;

    -- Baixa incremental: só quando a cotação já estava aprovada antes E continua
    -- aprovada agora (edição pós-aprovação). A transição pendente->aprovada
    -- continua 100% coberta por baixar_estoque_ao_aprovar_cotacao().
    IF v_servico_id IS NOT NULL AND OLD.status = 'aprovada' AND NEW.status = 'aprovada' THEN
        FOR v_delta IN
            SELECT
                COALESCE(n.catalogo_id, o.catalogo_id) AS catalogo_id,
                COALESCE(n.qtd, 0) - COALESCE(o.qtd, 0) AS delta
            FROM (
                SELECT (e->>'catalogo_id') AS catalogo_id, SUM(COALESCE((e->>'quantidade')::numeric, 1)) AS qtd
                FROM jsonb_array_elements(COALESCE(NEW.itens_extras, '[]'::jsonb)) e
                WHERE COALESCE((e->>'eh_acessorio')::boolean, false) IS TRUE
                  AND e->>'fornecedor' = 'empresa'
                  AND e->>'catalogo_id' IS NOT NULL
                GROUP BY e->>'catalogo_id'
            ) n
            FULL OUTER JOIN (
                SELECT (e->>'catalogo_id') AS catalogo_id, SUM(COALESCE((e->>'quantidade')::numeric, 1)) AS qtd
                FROM jsonb_array_elements(COALESCE(OLD.itens_extras, '[]'::jsonb)) e
                WHERE COALESCE((e->>'eh_acessorio')::boolean, false) IS TRUE
                  AND e->>'fornecedor' = 'empresa'
                  AND e->>'catalogo_id' IS NOT NULL
                GROUP BY e->>'catalogo_id'
            ) o ON o.catalogo_id = n.catalogo_id
        LOOP
            IF v_delta.delta > 0 THEN
                PERFORM public.baixar_estoque_fifo(v_delta.catalogo_id::uuid, v_delta.delta::int, v_servico_id);
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$function$;
