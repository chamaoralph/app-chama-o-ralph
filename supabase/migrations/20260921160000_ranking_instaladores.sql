-- ============================================================
-- Prioridade de instaladores — Etapa 2: cálculo do ranking (v5)
--
-- JANELA: últimos 1000 serviços CONCLUÍDOS de cada instalador.
-- PONTOS dentro da janela (dias no fuso America/Sao_Paulo):
--   +2  RECORRÊNCIA: cada dia posterior em que o cliente voltou a
--       contratar. Crédito: instalador do PRIMEIRO atendimento do
--       cliente (esse primeiro atendimento precisa estar na janela).
--   +2  UPSELL: serviço com valor_total acima do valor_estimado da
--       cotação (+ margem mínima, ajustável em c_upsell_min).
--   -1  cada serviço marcado com cliente_reclamou
--   -1  cada avaliação respondida com nota 1 a 3
-- ÍNDICE = pontos a cada 100 serviços da janela.
-- ORDEM: quem tem 20+ serviços na janela, por índice; depois quem
--        ainda não tem 20, por pontos. Desempates: pontos, volume, nome.
-- ============================================================

-- O retorno mudou (novas colunas); mudar o retorno exige DROP.
DROP FUNCTION IF EXISTS public.ranking_instaladores(uuid);

CREATE FUNCTION public.ranking_instaladores(p_empresa_id uuid)
RETURNS TABLE (
  posicao               integer,
  instalador_id         uuid,
  nome                  text,
  servicos_considerados integer,   -- concluídos dentro da janela
  recorrencias          integer,
  upsells               integer,
  reclamacoes           integer,
  notas_ruins           integer,
  pontos                integer,
  indice                numeric,   -- pontos a cada 100 serviços
  elegivel              boolean    -- tem o mínimo de serviços
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  c_janela     CONSTANT integer := 1000;  -- últimos N concluídos por instalador
  c_minimo     CONSTANT integer := 20;    -- mínimo para disputar pelo índice
  c_upsell_min CONSTANT numeric := 30;    -- aumento mínimo em R$ para contar upsell
BEGIN
  -- App: só admin da própria empresa. Edge Function (service-role): liberado.
  IF auth.uid() IS NOT NULL AND NOT (
       has_role(auth.uid(), 'admin'::app_role)
       AND p_empresa_id IN (SELECT u.empresa_id FROM usuarios u WHERE u.id = auth.uid())
     ) THEN
    RAISE EXCEPTION 'Sem permissão para ver o ranking desta empresa';
  END IF;

  RETURN QUERY
  WITH
  todos AS (
    SELECT s.id, s.cliente_id, s.instalador_id, s.created_at, s.status,
           (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia
    FROM servicos s
    WHERE s.empresa_id = p_empresa_id
  ),
  janela AS (   -- últimos c_janela concluídos de cada instalador
    SELECT x.id, x.instalador_id
    FROM (
      SELECT t.id, t.instalador_id,
             ROW_NUMBER() OVER (PARTITION BY t.instalador_id
                                ORDER BY t.created_at DESC) AS rn
      FROM todos t
      WHERE t.status = 'concluido' AND t.instalador_id IS NOT NULL
    ) x
    WHERE x.rn <= c_janela
  ),
  volume AS (
    SELECT j.instalador_id, COUNT(*)::int AS qtd
    FROM janela j GROUP BY j.instalador_id
  ),
  -- ---------- RECORRÊNCIA ----------
  primeiro AS (
    SELECT DISTINCT ON (t.cliente_id) t.id, t.cliente_id, t.instalador_id, t.dia
    FROM todos t
    WHERE t.instalador_id IS NOT NULL AND t.cliente_id IS NOT NULL
    ORDER BY t.cliente_id, t.created_at
  ),
  rec AS (
    SELECT p.instalador_id,
           COUNT(DISTINCT p.cliente_id::text || '|' || t.dia::text)::int AS qtd
    FROM primeiro p
    JOIN janela j ON j.id = p.id                              -- 1º atendimento na janela
    JOIN todos t  ON t.cliente_id = p.cliente_id AND t.dia > p.dia
    GROUP BY p.instalador_id
  ),
  -- ---------- UPSELL (valor final acima do estimado) ----------
  ups AS (
    SELECT j.instalador_id, COUNT(*)::int AS qtd
    FROM janela j
    JOIN servicos s ON s.id = j.id
    JOIN cotacoes c ON c.id = s.cotacao_id
    WHERE s.valor_total > c.valor_estimado + c_upsell_min
    GROUP BY j.instalador_id
  ),
  -- ---------- NEGATIVOS ----------
  recl AS (
    SELECT j.instalador_id, COUNT(*)::int AS qtd
    FROM janela j
    JOIN servicos s ON s.id = j.id
    WHERE s.cliente_reclamou = true
    GROUP BY j.instalador_id
  ),
  ruins AS (
    SELECT j.instalador_id, COUNT(*)::int AS qtd
    FROM janela j
    JOIN avaliacoes a ON a.servico_id = j.id
    WHERE a.status = 'respondida' AND a.nota BETWEEN 1 AND 3
    GROUP BY j.instalador_id
  ),
  -- ---------- CONSOLIDAÇÃO ----------
  base AS (
    SELECT i.id                    AS instalador_id,
           u.nome::text            AS nome,
           COALESCE(vol.qtd, 0)    AS servicos_considerados,
           COALESCE(rec.qtd, 0)    AS recorrencias,
           COALESCE(ups.qtd, 0)    AS upsells,
           COALESCE(recl.qtd, 0)   AS reclamacoes,
           COALESCE(ruins.qtd, 0)  AS notas_ruins
    FROM instaladores i
    JOIN usuarios u ON u.id = i.id
    LEFT JOIN volume vol ON vol.instalador_id   = i.id
    LEFT JOIN rec        ON rec.instalador_id   = i.id
    LEFT JOIN ups        ON ups.instalador_id   = i.id
    LEFT JOIN recl       ON recl.instalador_id  = i.id
    LEFT JOIN ruins      ON ruins.instalador_id = i.id
    WHERE u.empresa_id = p_empresa_id
      AND i.ativo = true
  ),
  calc AS (
    SELECT b.*,
           (b.recorrencias * 2 + b.upsells * 2 - b.reclamacoes - b.notas_ruins) AS pts,
           b.servicos_considerados >= c_minimo AS eleg
    FROM base b
  )
  SELECT
    (ROW_NUMBER() OVER (
       ORDER BY c.eleg DESC,
                CASE WHEN c.servicos_considerados > 0
                     THEN c.pts * 100.0 / c.servicos_considerados ELSE 0 END DESC,
                c.pts DESC,
                c.servicos_considerados DESC,
                c.nome
    ))::int,
    c.instalador_id,
    c.nome,
    c.servicos_considerados,
    c.recorrencias,
    c.upsells,
    c.reclamacoes,
    c.notas_ruins,
    c.pts::int,
    CASE WHEN c.servicos_considerados > 0
         THEN ROUND(c.pts * 100.0 / c.servicos_considerados, 1) ELSE 0 END,
    c.eleg
  FROM calc c
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.ranking_instaladores(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ranking_instaladores(uuid) TO authenticated, service_role;
