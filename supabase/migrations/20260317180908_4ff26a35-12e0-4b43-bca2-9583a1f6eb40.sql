
CREATE TABLE public.conversoes_offline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  gclid TEXT,
  conversion_name TEXT NOT NULL,
  conversion_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  conversion_value NUMERIC DEFAULT 0,
  conversion_currency TEXT DEFAULT 'BRL',
  external_attribution_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conversoes_offline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver conversoes_offline"
ON public.conversoes_offline FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

CREATE POLICY "Bloquear acesso anonimo conversoes_offline"
ON public.conversoes_offline FOR ALL TO anon
USING (false);
