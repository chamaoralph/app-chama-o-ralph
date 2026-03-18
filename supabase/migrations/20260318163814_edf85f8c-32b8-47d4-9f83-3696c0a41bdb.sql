CREATE TABLE public.cliques_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gclid text,
  telefone text,
  servico text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cliques_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bloquear acesso anonimo cliques_whatsapp"
  ON public.cliques_whatsapp AS RESTRICTIVE FOR ALL TO anon USING (false);

CREATE POLICY "Admins podem ver cliques"
  ON public.cliques_whatsapp FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));