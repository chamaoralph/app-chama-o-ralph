-- Ajustar políticas RLS para permitir criação durante signup

-- Remover políticas antigas e criar novas para instaladores
DROP POLICY IF EXISTS "Permitir criação de perfil de instalador durante signup" ON instaladores;

CREATE POLICY "Permitir insert instalador durante signup"
ON instaladores
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Remover políticas antigas e criar novas para usuarios
DROP POLICY IF EXISTS "Permitir criação de perfil durante signup" ON usuarios;

CREATE POLICY "Permitir insert usuario durante signup"
ON usuarios
FOR INSERT
WITH CHECK (auth.uid() = id);