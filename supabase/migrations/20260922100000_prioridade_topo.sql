-- ============================================================
-- Prioridade de instaladores — Etapa 4b
-- Marca quem sempre recebe o aviso primeiro, fora do ranking
-- (caso da sócia). Aditivo: por padrão ninguém tem a marcação.
-- ============================================================

ALTER TABLE public.instaladores
  ADD COLUMN IF NOT EXISTS prioridade_topo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.instaladores.prioridade_topo IS
  'Recebe o aviso de serviço novo antes de todos, independente do ranking.';
