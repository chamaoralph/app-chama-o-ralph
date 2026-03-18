DROP POLICY "Bloquear acesso anonimo cliques_whatsapp" ON public.cliques_whatsapp;

CREATE POLICY "Bloquear escrita anonima cliques_whatsapp"
  ON public.cliques_whatsapp AS RESTRICTIVE FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "Bloquear update anonimo cliques_whatsapp"
  ON public.cliques_whatsapp AS RESTRICTIVE FOR UPDATE TO anon USING (false);

CREATE POLICY "Bloquear delete anonimo cliques_whatsapp"
  ON public.cliques_whatsapp AS RESTRICTIVE FOR DELETE TO anon USING (false);

CREATE POLICY "Service pode ler cliques"
  ON public.cliques_whatsapp FOR SELECT TO anon USING (true);