-- candidatos_recibo_ids agora também guarda candidatos "virtuais" (recibo ainda não gerado,
-- identificados como 'faltante:<instalador_id>:<data>') junto com recibos reais (uuid) —
-- precisa ser texto pra caber os dois formatos.
alter table public.extrato_conciliacao
  alter column candidatos_recibo_ids type text[];

comment on column public.extrato_conciliacao.candidatos_recibo_ids is
  'IDs de recibos candidatos: um uuid real (recibo já existe, pendente) ou "faltante:<instalador_id>:<data>" (recibo ainda não gerado — confirmar cria e já marca como pago).';
