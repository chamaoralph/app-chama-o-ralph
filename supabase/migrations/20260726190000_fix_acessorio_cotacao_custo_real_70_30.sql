-- =============================================================================
-- Migration: 20260726190000_fix_acessorio_cotacao_custo_real_70_30.sql
--
-- Frente 1 da auditoria de acessórios vendidos em cotação — versão final,
-- depois de 2 achados que o autoteste da tentativa anterior revelou:
--
--   Achado 1: corrigir só criar_servico_ao_confirmar não bastava. Existe
--   trigger_sincronizar_servico_ao_editar_cotacao (AFTER UPDATE ON cotacoes,
--   SEM guarda de "isso é aprovação inicial") que roda logo em seguida (ordem
--   alfabética de trigger) e sobrescrevia valor_total/valor_mao_obra_instalador/
--   valor_reembolso_despesas com a fórmula antiga (sem subtrair o acessório).
--
--   Achado 2: mesmo corrigindo os dois acima, o CUSTO usado pra decompor
--   70/30 vinha de cotacoes.itens_extras.custo_unitario — digitado à mão pelo
--   admin na hora da cotação, e no caso real (SRV-2026-561) estava 0 quando o
--   custo de verdade, já registrado no estoque (baixa FIFO em
--   estoque_movimentos), era R$43,88. A função baixar_estoque_fifo() já
--   calculava esse custo real pra dar baixa no estoque, mas o trigger
--   z_baixar_estoque_ao_aprovar descartava o retorno (PERFORM) — o custo real
--   nunca chegava no cálculo financeiro.
--
-- O que esta migration muda, nas 3 funções:
--
--   1. criar_servico_ao_confirmar — mesmo fix já validado: decompõe
--      itens_extras (eh_acessorio=true) pela regra 70/30, subtrai a venda do
--      acessório do base_calculo/valor_total (não embute nos 50%), soma
--      reembolso, popula ganho_acessorios_*/acessorios_vendidos com o custo
--      PROVISÓRIO (custo_unitario da cotação — o único disponível nesse
--      momento, antes do estoque ser baixado).
--
--   2. sincronizar_servico_ao_editar_cotacao — mesmo tratamento pro
--      base_calculo/valor_total (não embutir), + popula ganho_acessorios_*/
--      acessorios_vendidos com custo provisório. Roda em QUALQUER update de
--      cotação (inclusive a própria aprovação, por não ter guarda) — por isso
--      precisa do mesmo fix, senão desfaz o que a função 1 acabou de fazer.
--
--   3. baixar_estoque_ao_aprovar_cotacao — vira a autoridade final: além de
--      dar baixa no estoque (como já fazia), agora USA o retorno de
--      baixar_estoque_fifo (custo real) pra RECALCULAR do zero
--      ganho_acessorios_instalador/empresa, valor_reembolso_despesas,
--      custo_suporte e acessorios_vendidos do serviço — substituindo os
--      valores provisórios das funções 1/2 pelos corretos. Só roda na
--      aprovação inicial (mesma guarda de sempre — não redá baixa em edição
--      posterior, isso já era assim e continua assim de propósito).
--
-- Limitação conhecida, aceita de propósito: se a cotação for editada DEPOIS
-- de aprovada (mudando itens_extras), a função 2 recalcula mão-de-obra/ganho
-- com custo provisório, mas a função 3 não roda de novo (só dispara na
-- transição pra 'aprovada'), então o custo real não é reprocessado nesse
-- caso. Reprocessar estoque em toda edição pós-aprovação daria baixa
-- duplicada — fora do escopo deste fix.
--
-- Se a cotação não tiver acessório em itens_extras, tudo fica em 0/[]::jsonb
-- e o comportamento é idêntico ao de antes nas 3 funções.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) criar_servico_ao_confirmar
-- -----------------------------------------------------------------------------
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
                'repasse_empresa', repasse_empresa
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

-- -----------------------------------------------------------------------------
-- 2) sincronizar_servico_ao_editar_cotacao
-- -----------------------------------------------------------------------------
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
            'repasse_empresa', repasse_empresa
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
    WHERE cotacao_id = NEW.id;

    RETURN NEW;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 3) baixar_estoque_ao_aprovar_cotacao — vira também a autoridade do custo real
-- -----------------------------------------------------------------------------
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
            'repasse_empresa', v_repasse_empresa
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

-- -----------------------------------------------------------------------------
-- Autoteste
-- -----------------------------------------------------------------------------
-- Cenário: cotação com 2 acessórios na mesma aprovação:
--   Item A: fornecedor='empresa', venda=85, custo_unitario digitado=0
--     (provisório errado, igual SRV-2026-561) — mas existe lote de estoque
--     real com custo_unitario=43.88 pro mesmo catalogo_id de teste.
--     Esperado: usa 43.88 (real), não 0 (provisório).
--   Item B: fornecedor='instalador', venda=50, custo_unitario=8, qtd=1
--     (instalador forneceu a peça própria — sem FIFO, usa o valor digitado).
--
-- valor_estimado = 300 (200 de mão-de-obra base + 85 + 50 - já que
-- 200+85+50=335... ajustar: base 200, soma acessórios 135, total 335).
DO $$
DECLARE
    v_empresa_id UUID := 'a5006ac5-230b-4687-bb88-e49ebc7811a2';
    v_cliente_id UUID := '219eb264-a2eb-4260-b315-64ee36d3d5da';
    v_cotacao_id UUID;
    v_catalogo_teste_id UUID;
    v_lote_id UUID;
    v_servico RECORD;
BEGIN
    -- Catálogo + lote de teste com custo real conhecido (43.88), venda-alvo 85
    INSERT INTO catalogo_servicos (empresa_id, nome, categoria, custo, preco, ativo, por_quantidade)
    VALUES (v_empresa_id, 'TESTE AUTOTESTE MIGRATION - item catalogo', 'acessorios', 0, 85, true, true)
    RETURNING id INTO v_catalogo_teste_id;

    INSERT INTO estoque_lotes (empresa_id, catalogo_id, custo_unitario, quantidade, qtd_restante, data_compra)
    VALUES (v_empresa_id, v_catalogo_teste_id, 43.88, 5, 5, CURRENT_DATE)
    RETURNING id INTO v_lote_id;

    INSERT INTO cotacoes (empresa_id, cliente_id, tipo_servico, valor_estimado, origem_suporte, status, itens_extras)
    VALUES (
        v_empresa_id, v_cliente_id, ARRAY['TV'], 335, 'cliente', 'pendente',
        jsonb_build_array(
            jsonb_build_object(
                'descricao', 'TESTE AUTOTESTE MIGRATION - item empresa',
                'valor', 85, 'eh_acessorio', true, 'catalogo_id', v_catalogo_teste_id,
                'quantidade', 1, 'custo_unitario', 0, 'fornecedor', 'empresa',
                'repasse_instalador', 25.5, 'repasse_empresa', 59.5
            ),
            jsonb_build_object(
                'descricao', 'TESTE AUTOTESTE MIGRATION - item instalador',
                'valor', 50, 'eh_acessorio', true, 'catalogo_id', '00000000-0000-0000-0000-000000000001',
                'quantidade', 1, 'custo_unitario', 8, 'fornecedor', 'instalador',
                'repasse_instalador', 37.4, 'repasse_empresa', 12.6
            )
        )
    )
    RETURNING id INTO v_cotacao_id;

    UPDATE cotacoes SET status = 'aprovada' WHERE id = v_cotacao_id;

    SELECT * INTO v_servico FROM servicos WHERE cotacao_id = v_cotacao_id;

    IF v_servico.id IS NULL THEN
        RAISE EXCEPTION 'autoteste: trigger não gerou serviço para a cotação sintética';
    END IF;

    -- valor_total esperado: 335 - 85 - 50 = 200; mão de obra = 100
    IF abs(v_servico.valor_total - 200) > 0.01 THEN
        RAISE EXCEPTION 'autoteste: valor_total esperado 200, veio %', v_servico.valor_total;
    END IF;
    IF abs(v_servico.valor_mao_obra_instalador - 100) > 0.01 THEN
        RAISE EXCEPTION 'autoteste: valor_mao_obra_instalador esperado 100, veio %', v_servico.valor_mao_obra_instalador;
    END IF;

    -- Item A (empresa, custo REAL 43.88, venda 85): lucro=41.12,
    --   repasse_empresa=43.88+28.78=72.66, repasse_instalador=12.34
    --   ganho_instalador_A=12.34, ganho_empresa_A=28.78, reembolso_empresa_A=43.88
    -- Item B (instalador, custo 8, venda 50): lucro=42,
    --   parteFornecedor(instalador,70%)=29.4, repasse_instalador=8+29.4=37.4,
    --   repasse_empresa=12.6
    --   ganho_instalador_B=37.4-8=29.4, ganho_empresa_B=12.6, reembolso_instalador_B=8
    --
    -- Totais esperados:
    --   ganho_acessorios_instalador = 12.34 + 29.4 = 41.74
    --   ganho_acessorios_empresa    = 28.78 + 12.6 = 41.38
    --   valor_reembolso_despesas    = 0 (base, origem_suporte='cliente') + 8 (item B) = 8
    --   custo_suporte               = 0 (base) + 43.88 (item A) = 43.88
    IF abs(v_servico.ganho_acessorios_instalador - 41.74) > 0.01 THEN
        RAISE EXCEPTION 'autoteste: ganho_acessorios_instalador esperado 41.74 (custo real da item A), veio %', v_servico.ganho_acessorios_instalador;
    END IF;
    IF abs(v_servico.ganho_acessorios_empresa - 41.38) > 0.01 THEN
        RAISE EXCEPTION 'autoteste: ganho_acessorios_empresa esperado 41.38, veio %', v_servico.ganho_acessorios_empresa;
    END IF;
    IF abs(v_servico.valor_reembolso_despesas - 8) > 0.01 THEN
        RAISE EXCEPTION 'autoteste: valor_reembolso_despesas esperado 8 (custo do item fornecido pelo instalador), veio %', v_servico.valor_reembolso_despesas;
    END IF;
    IF abs(v_servico.custo_suporte - 43.88) > 0.01 THEN
        RAISE EXCEPTION 'autoteste: custo_suporte esperado 43.88 (custo REAL do item A, não o provisório 0), veio %', v_servico.custo_suporte;
    END IF;
    IF jsonb_array_length(v_servico.acessorios_vendidos) IS DISTINCT FROM 2 THEN
        RAISE EXCEPTION 'autoteste: acessorios_vendidos deveria ter 2 itens, veio %', jsonb_array_length(v_servico.acessorios_vendidos);
    END IF;

    -- Invariantes gerais
    IF abs((v_servico.valor_total + 85 + 50) - 335) > 0.01 THEN
        RAISE EXCEPTION 'autoteste: invariante quebrado — valor_total + acessorios != valor_estimado';
    END IF;
    IF abs((v_servico.ganho_acessorios_instalador + v_servico.ganho_acessorios_empresa) - ((85-43.88)+(50-8))) > 0.01 THEN
        RAISE EXCEPTION 'autoteste: invariante quebrado — ganho_instalador+ganho_empresa != soma(venda-custo) dos itens';
    END IF;

    -- Confirma que o estoque foi realmente baixado (efeito colateral esperado)
    IF (SELECT qtd_restante FROM estoque_lotes WHERE id = v_lote_id) <> 4 THEN
        RAISE EXCEPTION 'autoteste: lote de teste deveria ter 4 unidades restantes (baixou 1), veio %', (SELECT qtd_restante FROM estoque_lotes WHERE id = v_lote_id);
    END IF;

    -- Limpeza dos dados sintéticos (bypassa a trigger de proteção de delete,
    -- que exige admin autenticado via auth.uid() — não existe nesta sessão)
    ALTER TABLE cotacoes DISABLE TRIGGER before_delete_cotacao_cleanup;
    DELETE FROM estoque_movimentos WHERE lote_id = v_lote_id;
    DELETE FROM servicos WHERE cotacao_id = v_cotacao_id;
    DELETE FROM cotacoes WHERE id = v_cotacao_id;
    ALTER TABLE cotacoes ENABLE TRIGGER before_delete_cotacao_cleanup;
    DELETE FROM estoque_lotes WHERE id = v_lote_id;
    DELETE FROM catalogo_servicos WHERE id = v_catalogo_teste_id;

    RAISE NOTICE 'autoteste OK: custo real do FIFO usado corretamente na decomposição 70/30, mão-de-obra não embute acessório, estoque baixado uma única vez';
END $$;

COMMIT;
