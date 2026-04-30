ALTER TABLE public.tipos_servico
ADD COLUMN IF NOT EXISTS exige_termo BOOLEAN NOT NULL DEFAULT false;

UPDATE public.tipos_servico
SET exige_termo = true
WHERE nome ILIKE '%tv%';