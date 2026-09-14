-- Conciliação automática de recibos via extrato bancário (OFX).
-- Registra cada transação do extrato já processada (idempotência: evita dar baixa duas
-- vezes se o mesmo período for importado de novo) e serve como fila de revisão pros
-- casos em que o nome do remetente não bate com confiança suficiente pra baixa automática.

create table if not exists public.extrato_conciliacao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  fitid text not null,
  data_transacao date not null,
  valor numeric(10,2) not null,
  nome_remetente text not null,
  resultado text not null check (resultado in ('automatico', 'revisao', 'sem_correspondencia')),
  recibo_id uuid references public.recibos_diarios(id),
  candidatos_recibo_ids uuid[],
  status_revisao text check (status_revisao in ('pendente', 'confirmado', 'ignorado')),
  created_at timestamptz not null default now(),
  unique (empresa_id, fitid)
);

comment on table public.extrato_conciliacao is
  'Cada linha é uma transação de crédito de um extrato OFX importado. resultado=automatico já deu baixa no recibo (ver recibo_id); resultado=revisao aguarda confirmação manual entre os candidatos_recibo_ids; resultado=sem_correspondencia é só histórico pra não reprocessar.';

alter table public.recibos_diarios
  add column if not exists extrato_fitid text;

comment on column public.recibos_diarios.extrato_fitid is
  'FITID da transação do extrato bancário que deu baixa automática neste recibo (rastreabilidade/auditoria). Null quando a baixa foi manual.';

alter table public.extrato_conciliacao enable row level security;

create policy "Admins podem ver conciliação da empresa"
  on public.extrato_conciliacao for select
  using (
    has_role(auth.uid(), 'admin'::app_role)
    and empresa_id in (select usuarios.empresa_id from usuarios where usuarios.id = auth.uid())
  );

create policy "Admins podem criar conciliação da empresa"
  on public.extrato_conciliacao for insert
  with check (
    has_role(auth.uid(), 'admin'::app_role)
    and empresa_id in (select usuarios.empresa_id from usuarios where usuarios.id = auth.uid())
  );

create policy "Admins podem atualizar conciliação da empresa"
  on public.extrato_conciliacao for update
  using (
    has_role(auth.uid(), 'admin'::app_role)
    and empresa_id in (select usuarios.empresa_id from usuarios where usuarios.id = auth.uid())
  );

create policy "Admins podem deletar conciliação da empresa"
  on public.extrato_conciliacao for delete
  using (
    has_role(auth.uid(), 'admin'::app_role)
    and empresa_id in (select usuarios.empresa_id from usuarios where usuarios.id = auth.uid())
  );
