-- =============================================================================
-- Migration: 20260921120000_upsell_painel_etapa1.sql
--
-- Etapa 1 do painel de Upsell (Chama o Ralph):
--   1. avaliacoes.upsell_reacao / upsell_reacao_em
--   2. clientes.nao_perturbe
--   3. RPC marcar_reacao_upsell (admin da empresa dona da avaliação)
--   4. view vw_upsell_resultados (security_invoker)
--
-- Não mexe em avaliacoes.status, na CHECK constraint dela, nem em nenhum
-- trigger existente. avaliacoes.upsell_enviado_em e a edge function
-- fila-upsell já existem em produção (deployadas fora do repo) — só lidas
-- aqui, não alteradas por esta migration.
-- =============================================================================

alter table public.avaliacoes
  add column upsell_reacao text null
    constraint avaliacoes_upsell_reacao_check
    check (upsell_reacao in ('sem_resposta','respondeu','orcamento','fechou','opt_out')),
  add column upsell_reacao_em timestamptz null;

alter table public.clientes
  add column nao_perturbe boolean not null default false;

-- -----------------------------------------------------------------------------
-- RPC: marcar_reacao_upsell
-- Só admin da empresa dona da avaliação pode chamar (mesmo padrão de RLS do
-- projeto: has_role(auth.uid(),'admin') + empresa_id via usuarios.empresa_id).
-- -----------------------------------------------------------------------------
create or replace function public.marcar_reacao_upsell(p_avaliacao_id uuid, p_reacao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_cliente_id uuid;
begin
  if p_reacao not in ('sem_resposta','respondeu','orcamento','fechou','opt_out') then
    raise exception 'reacao invalida: %', p_reacao;
  end if;

  select empresa_id, cliente_id into v_empresa_id, v_cliente_id
  from public.avaliacoes
  where id = p_avaliacao_id;

  if v_empresa_id is null then
    raise exception 'avaliacao nao encontrada';
  end if;

  if not (
    public.has_role(auth.uid(), 'admin'::app_role)
    and v_empresa_id in (select usuarios.empresa_id from public.usuarios where usuarios.id = auth.uid())
  ) then
    raise exception 'acesso negado';
  end if;

  update public.avaliacoes
  set upsell_reacao = p_reacao,
      upsell_reacao_em = now()
  where id = p_avaliacao_id;

  if p_reacao = 'opt_out' then
    update public.clientes
    set nao_perturbe = true
    where id = v_cliente_id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- View: vw_upsell_resultados
-- security_invoker respeita a RLS de quem consulta (não do dono da view).
-- "Cotação gerada" = primeira cotação do mesmo cliente (cotacoes.cliente_id)
-- criada depois de upsell_enviado_em e em até 60 dias.
-- -----------------------------------------------------------------------------
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
  cot.status as cotacao_gerada_status
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
