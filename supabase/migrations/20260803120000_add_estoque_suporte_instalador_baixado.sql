-- Trava de idempotência para a baixa automática de suporte(s) do instalador em
-- movimentacoes_suportes (tipo_movimento='uso'), disparada na aprovação do
-- serviço (Aprovacoes.tsx -> confirmarAprovacao). Mesmo padrão de
-- estoque_suporte_garantia_baixado (migration 20260728140000): setado uma
-- única vez quando a baixa acontece de fato, nunca resetado (nem ao
-- desaprovar/reaprovar).
alter table public.servicos
  add column if not exists estoque_suporte_instalador_baixado boolean not null default false;
