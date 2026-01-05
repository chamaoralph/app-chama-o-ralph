-- Add alert fields to clients table for problematic client marking
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS observacao_alerta TEXT,
ADD COLUMN IF NOT EXISTS tipo_alerta TEXT CHECK (tipo_alerta IN ('problematico', 'atencao', NULL));