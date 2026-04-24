ALTER TABLE public.cotacoes DROP CONSTRAINT IF EXISTS cotacoes_status_check;
ALTER TABLE public.cotacoes ADD CONSTRAINT cotacoes_status_check
  CHECK (status = ANY (ARRAY['pendente'::text, 'termo_pendente'::text, 'aprovada'::text, 'perdida'::text, 'sem_resposta'::text, 'nao_gerou'::text]));