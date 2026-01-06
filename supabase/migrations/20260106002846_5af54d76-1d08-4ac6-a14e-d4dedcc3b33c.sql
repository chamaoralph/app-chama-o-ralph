-- Bloquear acesso anônimo à tabela servicos
CREATE POLICY "Bloquear acesso anonimo servicos"
ON public.servicos
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);