-- =============================================================================
-- Migration: 20260921130000_upsell_versao.sql
--
-- Registra qual versão de texto do upsell cada cliente recebeu.
--   - avaliacoes.upsell_versao (preenchida pela fila-upsell "marcar_enviados",
--     opcional — se não vier "versao" no body, fica null como hoje)
--   - vw_upsell_resultados passa a incluir upsell_versao
-- =============================================================================

alter table public.avaliacoes
  add column upsell_versao smallint null;

create or replace view public.vw_upsell_resultados
with (security_invoker = true) as
select
  a.id as avaliacao_id,
  a.empresa_id,
  a.cliente_id,
  c.nome as cliente_nome,
  c.telefone as cliente_telefone,
  a.nota,
  a.upsell_enviado_em,
  extract(day from (now() - a.upsell_enviado_em))::int as dias_desde_envio,
  a.upsell_reacao,
  a.upsell_reacao_em,
  c.nao_perturbe,
  cot.id as cotacao_gerada_id,
  cot.created_at as cotacao_gerada_em,
  cot.valor_estimado as cotacao_gerada_valor,
  cot.status as cotacao_gerada_status,
  a.upsell_versao
from public.avaliacoes a
join public.clientes c on c.id = a.cliente_id
left join lateral (
  select cq.id, cq.created_at, cq.valor_estimado, cq.status
  from public.cotacoes cq
  where cq.cliente_id = a.cliente_id
    and cq.created_at > a.upsell_enviado_em
    and cq.created_at <= a.upsell_enviado_em + interval '60 days'
  order by cq.created_at asc
  limit 1
) cot on true
where a.upsell_enviado_em is not null;
