
CREATE TABLE public.followup_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  tipo_contato text NOT NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar followup da empresa"
ON public.followup_contatos
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND empresa_id IN (SELECT u.empresa_id FROM usuarios u WHERE u.id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND empresa_id IN (SELECT u.empresa_id FROM usuarios u WHERE u.id = auth.uid())
);

CREATE POLICY "Bloquear acesso anonimo followup"
ON public.followup_contatos
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE INDEX idx_followup_contatos_cotacao ON public.followup_contatos(cotacao_id);
CREATE INDEX idx_followup_contatos_empresa ON public.followup_contatos(empresa_id);
