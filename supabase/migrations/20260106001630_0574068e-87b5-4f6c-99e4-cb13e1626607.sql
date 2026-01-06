-- Bloquear acesso anônimo à tabela usuarios
CREATE POLICY "Bloquear acesso anonimo usuarios"
ON public.usuarios
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Bloquear acesso anônimo à tabela empresas
CREATE POLICY "Bloquear acesso anonimo empresas"
ON public.empresas
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);