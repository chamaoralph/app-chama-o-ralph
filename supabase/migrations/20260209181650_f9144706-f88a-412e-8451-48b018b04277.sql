
CREATE TABLE public.google_ads_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) NOT NULL,
  data date NOT NULL,
  cost_micros bigint DEFAULT 0,
  clicks integer DEFAULT 0,
  impressions integer DEFAULT 0,
  conversions numeric DEFAULT 0,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(empresa_id, data)
);

ALTER TABLE public.google_ads_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver metricas da empresa"
  ON public.google_ads_metrics FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Service role pode inserir metricas"
  ON public.google_ads_metrics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role pode atualizar metricas"
  ON public.google_ads_metrics FOR UPDATE
  USING (true);
