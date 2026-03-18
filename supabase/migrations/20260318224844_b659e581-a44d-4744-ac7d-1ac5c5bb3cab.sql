DROP POLICY IF EXISTS "Bloquear select anonimo conversoes_offline" ON public.conversoes_offline;

CREATE POLICY "Anon pode ler conversoes_offline"
  ON public.conversoes_offline FOR SELECT TO anon
  USING (true);