-- Trava de idempotência pra baixa do saldo PRÓPRIO do instalador (Suportes /
-- movimentacoes_suportes) referente aos acessórios "Extras" vendidos por ele
-- na finalização com fornecedor='instalador'. Mesmo padrão de
-- estoque_suporte_instalador_baixado (migration 20260803120000): setado uma
-- única vez quando a baixa acontece de fato (na aprovação final do admin),
-- nunca resetado.
alter table public.servicos
  add column if not exists estoque_extras_instalador_baixado boolean not null default false;
