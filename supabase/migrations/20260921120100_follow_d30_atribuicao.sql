-- =============================================================================
-- Migration: 20260921120100_follow_d30_atribuicao.sql
--
-- Atribuição automática "Follow D+30": cotacoes.origem_lead NÃO tem CHECK
-- constraint nem é enum (confirmado via pg_constraint / information_schema
-- antes de escrever esta migration) — por isso o valor 'Follow D+30' pode
-- ser gravado livremente, sem precisar alterar nenhuma constraint.
--
-- Trigger AFTER INSERT em cotacoes: se o cliente da cotação tiver alguma
-- avaliação com upsell_enviado_em nos últimos 60 dias, guarda o origem_lead
-- original em origem_lead_anterior e marca origem_lead = 'Follow D+30'.
-- Todo o corpo roda dentro de BEGIN...EXCEPTION WHEN OTHERS THEN NULL; para
-- nunca impedir a criação da cotação.
-- =============================================================================

alter table public.cotacoes
  add column origem_lead_anterior text null;

create or replace function public.atribuir_origem_follow_d30()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.avaliacoes a
    where a.cliente_id = new.cliente_id
      and a.upsell_enviado_em is not null
      and a.upsell_enviado_em >= now() - interval '60 days'
  ) then
    update public.cotacoes
    set origem_lead_anterior = new.origem_lead,
        origem_lead = 'Follow D+30'
    where id = new.id;
  end if;

  return null;
exception
  when others then
    return null;
end;
$$;

drop trigger if exists trg_atribuir_origem_follow_d30 on public.cotacoes;

create trigger trg_atribuir_origem_follow_d30
  after insert on public.cotacoes
  for each row
  execute function public.atribuir_origem_follow_d30();
