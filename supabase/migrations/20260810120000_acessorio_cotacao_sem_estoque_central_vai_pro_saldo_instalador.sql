-- =============================================================================
-- Migration: 20260810120000_acessorio_cotacao_sem_estoque_central_vai_pro_saldo_instalador.sql
--
-- Motivação: acessório com fornecedor='empresa' numa cotação só podia ser
-- adicionado se o estoque CENTRAL (estoque_saldo) tivesse unidade — mesmo
-- quando a peça existe fisicamente com algum instalador (entregue via
-- /admin/suportes, que já debita o central na entrega). Isso bloqueava o
-- admin de lançar o acessório na cotação sempre que as unidades já tinham
-- sido todas distribuídas.
--
-- Peça em mãos de um instalador continua sendo estoque DA EMPRESA (ele não
-- pagou por ela) — só está descentralizada. Então:
--   - o front (Nova.tsx/Lista.tsx) para de bloquear adicionar o item por
--     estoque central zerado;
--   - aqui no banco, as duas funções que fazem a baixa real (aprovação
--     inicial e edição pós-aprovação) passam a: se o estoque central cobrir
--     a quantidade, baixa dali (FIFO, como sempre). Se não cobrir, NÃO baixa
--     nada agora (a cotação nasce/fica 'disponível' sem instalador atribuído
--     ainda, não dá pra saber de qual saldo tirar) — marca o item com
--     origem_estoque='instalador' e usa o custo de catálogo como referência.
--   - Aprovacoes.tsx (não faz parte desta migration) já sabe debitar do
--     saldo de quem finalizou o serviço quando encontra origem_estoque=
--     'instalador' em acessorios_vendidos, na aprovação final.
--
-- O repasse financeiro (70/30) continua SEMPRE como se a empresa tivesse
-- fornecido nesses casos (fornecedor permanece 'empresa') — origem_estoque
-- só diz de qual saldo físico a peça sai, não quem fica com o lucro. O
-- fornecedor='instalador' clássico (autodeclarado pelo admin nos botões
-- Empresa/Instalador da tela de edição — peça que o instalador comprou com
-- o próprio dinheiro) continua com o split antigo a favor dele, intocado.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) baixar_estoque_ao_aprovar_cotacao — aprovação inicial da cotação
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
  v_origem_estoque TEXT;
  v_saldo_central NUMERIC;
  v_custo_catalogo NUMERIC;
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
          v_origem_estoque := v_fornecedor;

          IF v_fornecedor = 'empresa' AND item->>'catalogo_id' IS NOT NULL THEN
            SELECT saldo INTO v_saldo_central
            FROM public.estoque_saldo
            WHERE catalogo_id = (item->>'catalogo_id')::uuid;
            v_saldo_central := COALESCE(v_saldo_central, 0);

            IF v_saldo_central >= v_quantidade THEN
              -- Estoque central cobre: baixa FIFO real, como sempre.
              SELECT custo_total INTO v_custo_real
              FROM public.baixar_estoque_fifo(
                (item->>'catalogo_id')::uuid,
                v_quantidade::int,
                v_servico_id
              );
              v_custo_real := COALESCE(v_custo_real, 0);
              v_origem_estoque := 'empresa';
            ELSE
              -- Estoque central não cobre: a peça só existe hoje distribuída
              -- com algum instalador. Serviço ainda nasce 'disponivel' (sem
              -- instalador atribuído) — não dá pra saber de qual saldo tirar
              -- agora, então não baixa nada aqui. Fica pendente
              -- (origem_estoque='instalador'), pra Aprovacoes.tsx debitar do
              -- saldo de quem finalizar o serviço. Custo de referência: o do
              -- catálogo (aproxima o que a empresa realmente pagou), não o
              -- 0 que o FIFO devolveria por falta de lote.
              SELECT custo INTO v_custo_catalogo
              FROM public.catalogo_servicos
              WHERE id = (item->>'catalogo_id')::uuid;
              v_custo_real := COALESCE(v_custo_catalogo, 0) * v_quantidade;
              v_origem_estoque := 'instalador';
            END IF;
          END IF;

          -- Regra 70/30 (mesma fórmula de calcularRepasseAcessorio). O split
          -- segue sempre o `fornecedor` (financeiro) — origem_estoque não
          -- influencia aqui, só marca de qual saldo físico a peça saiu/sairá.
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
            'origem_estoque', v_origem_estoque,
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
-- 2) sincronizar_servico_ao_editar_cotacao — edição (inclusive pós-aprovação)
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
    v_servico_id UUID;
    v_delta RECORD;
    v_saldo_central NUMERIC;
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
            COALESCE((item->>'repasse_empresa')::numeric, 0) AS repasse_empresa,
            -- Se fornecedor='empresa' mas o estoque central não cobre a
            -- quantidade pedida, a peça vem do saldo de algum instalador
            -- (entregue pela empresa) — marca pra Aprovacoes.tsx debitar do
            -- saldo de quem finalizar o serviço, na aprovação final. Não
            -- muda o repasse financeiro (continua `fornecedor`).
            CASE
              WHEN item->>'fornecedor' = 'empresa' AND item->>'catalogo_id' IS NOT NULL
                   AND COALESCE(
                     (SELECT es.saldo FROM public.estoque_saldo es WHERE es.catalogo_id = (item->>'catalogo_id')::uuid),
                     0
                   ) < COALESCE((item->>'quantidade')::numeric, 1)
              THEN 'instalador'
              ELSE item->>'fornecedor'
            END AS origem_estoque
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
            'origem_estoque', origem_estoque,
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
                SELECT COALESCE(saldo, 0) INTO v_saldo_central
                FROM public.estoque_saldo
                WHERE catalogo_id = v_delta.catalogo_id::uuid;

                -- Só baixa do central se ele realmente cobrir o incremento
                -- pedido; senão fica pendente (origem_estoque já marcado
                -- 'instalador' acima), sem tocar em estoque_lotes/movimentos.
                IF COALESCE(v_saldo_central, 0) >= v_delta.delta THEN
                    PERFORM public.baixar_estoque_fifo(v_delta.catalogo_id::uuid, v_delta.delta::int, v_servico_id);
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$function$;

COMMIT;
