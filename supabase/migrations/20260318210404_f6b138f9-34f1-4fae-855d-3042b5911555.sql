
CREATE TABLE public.telefones_bloqueados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  telefone TEXT NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(empresa_id, telefone)
);

ALTER TABLE public.telefones_bloqueados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam bloqueios"
  ON public.telefones_bloqueados FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) 
    AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) 
    AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "Bloquear anon telefones_bloqueados"
  ON public.telefones_bloqueados AS RESTRICTIVE FOR ALL TO anon
  USING (false);
