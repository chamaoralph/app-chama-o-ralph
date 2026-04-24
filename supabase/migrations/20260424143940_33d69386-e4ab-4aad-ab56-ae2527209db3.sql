ALTER TABLE public.termos_aceite
  ADD COLUMN IF NOT EXISTS desconto_completa numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_colaborativa numeric NOT NULL DEFAULT 0;