-- =============================================================================
-- Migration: 20260723020000_acessorios_vendidos_e_metricas.sql
-- Substitui os rascunhos 20260723000000_add_metricas_acessorios.sql e
-- 20260723010000_add_acessorios_vendidos.sql (nunca aplicados em produção —
-- confirmado via `supabase migration list` antes desta consolidação).
--
-- Motivo da fusão: a ordem original tinha um bug — a migration das functions
-- (000000) rodava ANTES da migration que cria a coluna acessorios_vendidos
-- (010000), mas o bloco de validação (DO $$) da primeira já lia essa coluna,
-- o que teria quebrado o push com "column does not exist". Consolidado aqui,
-- em ordem correta, dentro de uma única transação explícita: se qualquer
-- validação falhar, TUDO desfaz (coluna, migração de dado, functions).
--
-- Conteúdo, na ordem:
--   1. ADD COLUMN acessorios_vendidos (idempotente)
--   2. Migração de dado: linhas de servicos_extras com a chave 'catalogo_id'
--      (formato novo, ex. SRV-2026-558) saem de servicos_extras e entram em
--      acessorios_vendidos, ganhando "quantidade": 1. Linhas sem catalogo_id
--      (formato antigo/avulso: descricao, tipo, valor_mao_obra, valor_material
--      — ex. SRV-2026-309/339/297/310, já faturados) ficam intocadas.
--      servicos_extras permanece CONGELADA depois disso: nenhum código lê/escreve.
--   3. Validação: nenhuma linha com catalogo_id sobrou em servicos_extras.
--   4. Validação: SRV-2026-558 tem exatamente 1 item em acessorios_vendidos
--      com valor_venda = 40.
--   5. Functions de métricas (metricas_acessorios, metricas_acessorios_por_instalador)
--      — mesma lógica já revisada: duas fontes (cotacoes.itens_extras e
--      servicos.acessorios_vendidos), lucro líquido descontando custo de quem
--      forneceu, taxa de anexo, ranking por instalador (só origem finalização).
--   6. Validação: invariante lucro_empresa + lucro_instalador = valor - custo_total
--      (diferença <= 0,01) e nenhum item com fornecedor fora de
--      ('empresa','instalador') — escopado à empresa a5006ac5-230b-4687-bb88-
--      e49ebc7811a2 de propósito, pra não derrubar a migration com dado ruim de
--      outro tenant. Roda depois da migração de dado, então já cobre o item
--      migrado do SRV-2026-558.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) Coluna nova (idempotente)
-- -----------------------------------------------------------------------------

alter table public.servicos
  add column if not exists acessorios_vendidos jsonb not null default '[]'::jsonb;

-- -----------------------------------------------------------------------------
-- 2) Migração de dado: catalogo_id => formato novo => vai para acessorios_vendidos
-- -----------------------------------------------------------------------------

with extras_split as (
  select
    s.id,
    coalesce(
      jsonb_agg(item || jsonb_build_object('quantidade', 1)) filter (where item ? 'catalogo_id'),
      '[]'::jsonb
    ) as novos,
    coalesce(
      jsonb_agg(item) filter (where not (item ? 'catalogo_id')),
      '[]'::jsonb
    ) as antigos
  from public.servicos s
  cross join lateral jsonb_array_elements(s.servicos_extras) as item
  group by s.id
)
update public.servicos s
set
  acessorios_vendidos = s.acessorios_vendidos || es.novos,
  servicos_extras = es.antigos
from extras_split es
where es.id = s.id
  and jsonb_array_length(es.novos) > 0;

-- -----------------------------------------------------------------------------
-- 3) Validação (a): nenhuma linha com catalogo_id pode sobrar em servicos_extras
-- -----------------------------------------------------------------------------

do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.servicos s
  cross join lateral jsonb_array_elements(s.servicos_extras) as item
  where item ? 'catalogo_id';

  if v_count > 0 then
    raise exception 'migracao acessorios_vendidos: % linha(s) com catalogo_id ainda em servicos_extras', v_count;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4) Validação (b): SRV-2026-558 migrado corretamente (1 item, valor_venda=40)
-- -----------------------------------------------------------------------------

do $$
declare
  v_len   int;
  v_valor numeric;
begin
  select jsonb_array_length(acessorios_vendidos) into v_len
  from public.servicos where codigo = 'SRV-2026-558';

  if v_len is distinct from 1 then
    raise exception 'SRV-2026-558: esperado exatamente 1 item em acessorios_vendidos, encontrado %', coalesce(v_len, 0);
  end if;

  select (acessorios_vendidos -> 0 ->> 'valor_venda')::numeric into v_valor
  from public.servicos where codigo = 'SRV-2026-558';

  if v_valor is distinct from 40 then
    raise exception 'SRV-2026-558: esperado valor_venda = 40, encontrado %', v_valor;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5) Métricas de venda de acessórios (aba Acompanhamento do Marketing)
--
-- Duas fontes de acessório, sem sobreposição entre si:
--   1. cotacoes.itens_extras        -> acessório incluído no orçamento original
--   2. servicos.acessorios_vendidos -> acessório vendido na finalização
--
-- Lucro líquido por item (NÃO é o repasse bruto — repasse embute a devolução
-- do custo pra quem forneceu):
--   custo_total    = custo_unitario * quantidade
--   lucro_empresa    = repasse_empresa    - (custo_total SE fornecedor='empresa'    SENÃO 0)
--   lucro_instalador = repasse_instalador - (custo_total SE fornecedor='instalador' SENÃO 0)
--   invariante: lucro_empresa + lucro_instalador = valor - custo_total
--
-- Filtro de acessório (cotação): COALESCE((item->>'eh_acessorio')::boolean, false)
-- — itens normais da cotação não têm essa chave.
--
-- Filtro de data: (data_conclusao AT TIME ZONE 'America/Sao_Paulo')::date — a
-- coluna está em UTC; sem essa conversão serviços do fim do dia caem no dia
-- seguinte (bug conhecido do projeto, evitado aqui de propósito).
-- -----------------------------------------------------------------------------

create or replace function public.metricas_acessorios(
  p_empresa_id uuid,
  p_data_inicio date,
  p_data_fim date
)
returns table (
  total_servicos                int,
  servicos_com_acessorio        int,
  taxa_anexo_pct                numeric(5,2),
  total_linhas                  int,  -- COUNT de linhas de acessório, as duas fontes
  itens_por_servico_anexado     numeric(5,2),
  receita_acessorios            numeric(10,2),
  custo_acessorios              numeric(10,2),
  lucro_acessorios_empresa      numeric(10,2),
  lucro_acessorios_instalador   numeric(10,2),
  itens_fornecidos_empresa      int,
  itens_fornecidos_instalador   int,
  pct_fornecido_empresa         numeric(5,2),
  unidades_via_cotacao          int,  -- SUM(quantidade), fonte cotacao
  unidades_via_finalizacao      int,  -- SUM(quantidade), fonte finalizacao
  lucro_empresa_via_cotacao     numeric(10,2),
  lucro_empresa_via_finalizacao numeric(10,2)
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with servicos_periodo as (
    select s.id, s.cotacao_id, s.acessorios_vendidos
    from servicos s
    where s.empresa_id = p_empresa_id
      and s.status = 'concluido'
      and (s.data_conclusao at time zone 'America/Sao_Paulo')::date between p_data_inicio and p_data_fim
  ),
  itens_cotacao as (
    select
      sp.id as servico_id,
      'cotacao'::text as origem,
      coalesce((item->>'quantidade')::numeric, 1) as quantidade,
      coalesce((item->>'valor')::numeric, 0) as valor,
      coalesce((item->>'custo_unitario')::numeric, 0) * coalesce((item->>'quantidade')::numeric, 1) as custo_total,
      item->>'fornecedor' as fornecedor,
      coalesce((item->>'repasse_instalador')::numeric, 0) as repasse_instalador,
      coalesce((item->>'repasse_empresa')::numeric, 0) as repasse_empresa
    from servicos_periodo sp
    join cotacoes c on c.id = sp.cotacao_id
    cross join lateral jsonb_array_elements(coalesce(c.itens_extras, '[]'::jsonb)) as item
    where coalesce((item->>'eh_acessorio')::boolean, false) is true
  ),
  itens_finalizacao as (
    select
      sp.id as servico_id,
      'finalizacao'::text as origem,
      coalesce((item->>'quantidade')::numeric, 1) as quantidade,
      coalesce((item->>'valor_venda')::numeric, 0) as valor,
      coalesce((item->>'valor_compra')::numeric, 0) as custo_total,
      item->>'fornecedor' as fornecedor,
      coalesce((item->>'repasse_instalador')::numeric, 0) as repasse_instalador,
      coalesce((item->>'repasse_empresa')::numeric, 0) as repasse_empresa
    from servicos_periodo sp
    cross join lateral jsonb_array_elements(coalesce(sp.acessorios_vendidos, '[]'::jsonb)) as item
  ),
  itens_calc as (
    select
      *,
      case when fornecedor = 'empresa' then repasse_empresa - custo_total else repasse_empresa end as lucro_empresa,
      case when fornecedor = 'instalador' then repasse_instalador - custo_total else repasse_instalador end as lucro_instalador
    from (
      select * from itens_cotacao
      union all
      select * from itens_finalizacao
    ) t
  ),
  agregados as (
    select
      count(*) as total_linhas,
      count(distinct servico_id) as servicos_com_acessorio,
      coalesce(sum(valor), 0) as receita_acessorios,
      coalesce(sum(custo_total), 0) as custo_acessorios,
      coalesce(sum(lucro_empresa), 0) as lucro_acessorios_empresa,
      coalesce(sum(lucro_instalador), 0) as lucro_acessorios_instalador,
      coalesce(sum(quantidade) filter (where fornecedor = 'empresa'), 0) as itens_fornecidos_empresa,
      coalesce(sum(quantidade) filter (where fornecedor = 'instalador'), 0) as itens_fornecidos_instalador,
      coalesce(sum(quantidade) filter (where origem = 'cotacao'), 0) as unidades_via_cotacao,
      coalesce(sum(quantidade) filter (where origem = 'finalizacao'), 0) as unidades_via_finalizacao,
      coalesce(sum(lucro_empresa) filter (where origem = 'cotacao'), 0) as lucro_empresa_via_cotacao,
      coalesce(sum(lucro_empresa) filter (where origem = 'finalizacao'), 0) as lucro_empresa_via_finalizacao
    from itens_calc
  ),
  total as (
    select count(*) as total_servicos from servicos_periodo
  )
  select
    total.total_servicos::int,
    agregados.servicos_com_acessorio::int,
    round(case when total.total_servicos > 0
      then agregados.servicos_com_acessorio::numeric / total.total_servicos * 100
      else 0 end, 2)::numeric(5,2),
    agregados.total_linhas::int,
    round(case when agregados.servicos_com_acessorio > 0
      then agregados.total_linhas / agregados.servicos_com_acessorio::numeric
      else 0 end, 2)::numeric(5,2),
    agregados.receita_acessorios::numeric(10,2),
    agregados.custo_acessorios::numeric(10,2),
    agregados.lucro_acessorios_empresa::numeric(10,2),
    agregados.lucro_acessorios_instalador::numeric(10,2),
    agregados.itens_fornecidos_empresa::int,
    agregados.itens_fornecidos_instalador::int,
    round(case when (agregados.itens_fornecidos_empresa + agregados.itens_fornecidos_instalador) > 0
      then agregados.itens_fornecidos_empresa::numeric / (agregados.itens_fornecidos_empresa + agregados.itens_fornecidos_instalador) * 100
      else 0 end, 2)::numeric(5,2),
    agregados.unidades_via_cotacao::int,
    agregados.unidades_via_finalizacao::int,
    agregados.lucro_empresa_via_cotacao::numeric(10,2),
    agregados.lucro_empresa_via_finalizacao::numeric(10,2)
  from total, agregados;
end;
$$;

grant execute on function public.metricas_acessorios(uuid, date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Ranking por instalador — SOMENTE origem 'finalizacao' (o que o instalador
-- efetivamente vendeu na casa do cliente; acessório de cotação não é "venda
-- dele", é o admin/orçamento que decidiu incluir).
-- -----------------------------------------------------------------------------

create or replace function public.metricas_acessorios_por_instalador(
  p_empresa_id uuid,
  p_data_inicio date,
  p_data_fim date
)
returns table (
  instalador_id       uuid,
  instalador_nome     text,
  servicos_concluidos int,
  servicos_com_acessorio int,
  taxa_anexo_pct      numeric(5,2),
  lucro_gerado_empresa numeric(10,2),
  itens_vendidos      int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with servicos_periodo as (
    select s.id, s.instalador_id, s.acessorios_vendidos
    from servicos s
    where s.empresa_id = p_empresa_id
      and s.status = 'concluido'
      and s.instalador_id is not null
      and (s.data_conclusao at time zone 'America/Sao_Paulo')::date between p_data_inicio and p_data_fim
  ),
  itens_finalizacao as (
    select
      sp.id as servico_id,
      sp.instalador_id,
      coalesce((item->>'quantidade')::numeric, 1) as quantidade,
      item->>'fornecedor' as fornecedor,
      coalesce((item->>'valor_compra')::numeric, 0) as custo_total,
      coalesce((item->>'repasse_empresa')::numeric, 0) as repasse_empresa
    from servicos_periodo sp
    cross join lateral jsonb_array_elements(coalesce(sp.acessorios_vendidos, '[]'::jsonb)) as item
  ),
  itens_calc as (
    select
      servico_id, instalador_id, quantidade,
      case when fornecedor = 'empresa' then repasse_empresa - custo_total else repasse_empresa end as lucro_empresa
    from itens_finalizacao
  )
  select
    sp.instalador_id,
    coalesce(u.nome, '(sem nome)') as instalador_nome,
    count(distinct sp.id)::int as servicos_concluidos,
    count(distinct ic.servico_id)::int as servicos_com_acessorio,
    round(case when count(distinct sp.id) > 0
      then count(distinct ic.servico_id)::numeric / count(distinct sp.id) * 100
      else 0 end, 2)::numeric(5,2) as taxa_anexo_pct,
    coalesce(sum(ic.lucro_empresa), 0)::numeric(10,2) as lucro_gerado_empresa,
    coalesce(sum(ic.quantidade), 0)::int as itens_vendidos
  from servicos_periodo sp
  left join usuarios u on u.id = sp.instalador_id
  left join itens_calc ic on ic.servico_id = sp.id
  group by sp.instalador_id, u.nome
  order by taxa_anexo_pct desc;
end;
$$;

grant execute on function public.metricas_acessorios_por_instalador(uuid, date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- 6) Validação (c)+(d): invariante lucro_empresa + lucro_instalador = valor -
-- custo_total (diferença <= 0,01) e nenhum item com fornecedor fora de
-- ('empresa','instalador'). Escopado por empresa_id de propósito — dado ruim
-- de outro tenant não deve derrubar esta migration. Roda DEPOIS da migração de
-- dado (passo 2), então já cobre o item movido do SRV-2026-558.
-- -----------------------------------------------------------------------------

do $$
declare
  v_diferenca numeric;
  v_itens_invalidos int;
begin
  with itens_cotacao as (
    select
      coalesce((item->>'valor')::numeric, 0) as valor,
      coalesce((item->>'custo_unitario')::numeric, 0) * coalesce((item->>'quantidade')::numeric, 1) as custo_total,
      item->>'fornecedor' as fornecedor,
      coalesce((item->>'repasse_instalador')::numeric, 0) as repasse_instalador,
      coalesce((item->>'repasse_empresa')::numeric, 0) as repasse_empresa
    from cotacoes c
    cross join lateral jsonb_array_elements(coalesce(c.itens_extras, '[]'::jsonb)) as item
    where c.empresa_id = 'a5006ac5-230b-4687-bb88-e49ebc7811a2'
      and coalesce((item->>'eh_acessorio')::boolean, false) is true
  ),
  itens_finalizacao as (
    select
      coalesce((item->>'valor_venda')::numeric, 0) as valor,
      coalesce((item->>'valor_compra')::numeric, 0) as custo_total,
      item->>'fornecedor' as fornecedor,
      coalesce((item->>'repasse_instalador')::numeric, 0) as repasse_instalador,
      coalesce((item->>'repasse_empresa')::numeric, 0) as repasse_empresa
    from servicos s
    cross join lateral jsonb_array_elements(coalesce(s.acessorios_vendidos, '[]'::jsonb)) as item
    where s.empresa_id = 'a5006ac5-230b-4687-bb88-e49ebc7811a2'
  ),
  itens_calc as (
    select
      valor, custo_total, fornecedor,
      case when fornecedor = 'empresa' then repasse_empresa - custo_total else repasse_empresa end as lucro_empresa,
      case when fornecedor = 'instalador' then repasse_instalador - custo_total else repasse_instalador end as lucro_instalador
    from (select * from itens_cotacao union all select * from itens_finalizacao) t
  )
  select
    abs((coalesce(sum(lucro_empresa), 0) + coalesce(sum(lucro_instalador), 0)) - (coalesce(sum(valor), 0) - coalesce(sum(custo_total), 0))),
    count(*) filter (where fornecedor is null or fornecedor not in ('empresa', 'instalador'))
  into v_diferenca, v_itens_invalidos
  from itens_calc;

  if v_diferenca > 0.01 or v_itens_invalidos > 0 then
    raise exception 'metricas_acessorios: invariante lucro quebrado — diferenca=%, itens_com_fornecedor_invalido=%', v_diferenca, v_itens_invalidos;
  end if;
end;
$$;

commit;
