-- Adicionar política de INSERT para tabela usuarios
CREATE POLICY "Permitir criação de perfil durante signup"
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Adicionar política de INSERT para tabela instaladores  
CREATE POLICY "Permitir criação de perfil de instalador durante signup"
ON public.instaladores
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);