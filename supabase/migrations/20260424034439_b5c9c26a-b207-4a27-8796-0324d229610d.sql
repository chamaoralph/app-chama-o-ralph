ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS tv_tamanho text,
  ADD COLUMN IF NOT EXISTS tv_parede text,
  ADD COLUMN IF NOT EXISTS tv_cobertura text;