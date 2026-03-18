ALTER TABLE public.conversoes_offline 
ADD COLUMN enviado_google BOOLEAN DEFAULT false;

DROP POLICY IF EXISTS "Bloquear acesso anonimo conversoes_offline" 
  ON public.conversoes_offline;

CREATE POLICY "Bloquear select anonimo conversoes_offline"
  ON public.conversoes_offline FOR SELECT TO anon USING (false);

CREATE POLICY "Bloquear insert anonimo conversoes_offline"
  ON public.conversoes_offline FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "Bloquear delete anonimo conversoes_offline"
  ON public.conversoes_offline FOR DELETE TO anon USING (false);

CREATE POLICY "Anon pode atualizar conversoes_offline"
  ON public.conversoes_offline FOR UPDATE TO anon
  USING (true) WITH CHECK (true);