ALTER TABLE public.cotacoes ADD COLUMN IF NOT EXISTS tvs_itens jsonb;
ALTER TABLE public.termos_aceite ADD COLUMN IF NOT EXISTS tvs_itens jsonb;