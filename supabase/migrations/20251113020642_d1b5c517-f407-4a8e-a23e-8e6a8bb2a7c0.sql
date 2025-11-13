-- 1. Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'instalador');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Add RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own roles during signup"
ON public.user_roles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 5. Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 6. Migrate existing roles from usuarios.tipo to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, tipo::app_role
FROM public.usuarios
WHERE tipo IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 7. Update RLS policies to use has_role function
-- Update clientes policies
DROP POLICY IF EXISTS "Usuários podem ver clientes da sua empresa" ON public.clientes;
CREATE POLICY "Usuários podem ver clientes da sua empresa"
ON public.clientes FOR SELECT
USING (
  empresa_id IN (
    SELECT empresa_id FROM usuarios 
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Usuários podem criar clientes na sua empresa" ON public.clientes;
CREATE POLICY "Usuários podem criar clientes na sua empresa"
ON public.clientes FOR INSERT
WITH CHECK (
  empresa_id IN (
    SELECT empresa_id FROM usuarios 
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Usuários podem atualizar clientes da sua empresa" ON public.clientes;
CREATE POLICY "Usuários podem atualizar clientes da sua empresa"
ON public.clientes FOR UPDATE
USING (
  empresa_id IN (
    SELECT empresa_id FROM usuarios 
    WHERE id = auth.uid()
  )
);

-- Update cotacoes policies
DROP POLICY IF EXISTS "Usuários podem ver cotações da sua empresa" ON public.cotacoes;
CREATE POLICY "Usuários podem ver cotações da sua empresa"
ON public.cotacoes FOR SELECT
USING (
  empresa_id IN (
    SELECT empresa_id FROM usuarios 
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Usuários podem criar cotações na sua empresa" ON public.cotacoes;
CREATE POLICY "Usuários podem criar cotações na sua empresa"
ON public.cotacoes FOR INSERT
WITH CHECK (
  empresa_id IN (
    SELECT empresa_id FROM usuarios 
    WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Usuários podem atualizar cotações da sua empresa" ON public.cotacoes;
CREATE POLICY "Usuários podem atualizar cotações da sua empresa"
ON public.cotacoes FOR UPDATE
USING (
  empresa_id IN (
    SELECT empresa_id FROM usuarios 
    WHERE id = auth.uid()
  )
);

-- Update servicos policies
DROP POLICY IF EXISTS "Usuários podem ver serviços da sua empresa" ON public.servicos;
DROP POLICY IF EXISTS "Instaladores podem ver serviços disponíveis ou atribuídos a " ON public.servicos;

CREATE POLICY "Admins podem ver todos serviços da empresa"
ON public.servicos FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') AND
  empresa_id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid()
  )
);

CREATE POLICY "Instaladores podem ver serviços atribuídos"
ON public.servicos FOR SELECT
USING (
  public.has_role(auth.uid(), 'instalador') AND
  instalador_id = auth.uid()
);

CREATE POLICY "Instaladores podem ver serviços disponíveis"
ON public.servicos FOR SELECT
USING (
  public.has_role(auth.uid(), 'instalador') AND
  status = 'disponivel' AND
  empresa_id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Usuários podem criar serviços na sua empresa" ON public.servicos;
CREATE POLICY "Admins podem criar serviços"
ON public.servicos FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') AND
  empresa_id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Usuários podem atualizar serviços da sua empresa" ON public.servicos;
DROP POLICY IF EXISTS "Instaladores podem atualizar serviços atribuídos a eles" ON public.servicos;

CREATE POLICY "Admins podem atualizar serviços da empresa"
ON public.servicos FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') AND
  empresa_id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid()
  )
);

CREATE POLICY "Instaladores podem atualizar serviços atribuídos"
ON public.servicos FOR UPDATE
USING (
  public.has_role(auth.uid(), 'instalador') AND
  instalador_id = auth.uid()
);

-- 8. Make fotos-servicos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'fotos-servicos';

-- 9. Add storage policies for fotos-servicos
CREATE POLICY "Users can view photos from their company services"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fotos-servicos' AND
  (storage.foldername(name))[1] IN (
    SELECT s.id::text FROM servicos s
    JOIN usuarios u ON u.empresa_id = s.empresa_id
    WHERE u.id = auth.uid()
  )
);

CREATE POLICY "Installers can upload photos for their services"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fotos-servicos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM servicos
    WHERE instalador_id = auth.uid()
  )
);

CREATE POLICY "Users can update photos from their company services"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'fotos-servicos' AND
  (storage.foldername(name))[1] IN (
    SELECT s.id::text FROM servicos s
    JOIN usuarios u ON u.empresa_id = s.empresa_id
    WHERE u.id = auth.uid()
  )
);

CREATE POLICY "Users can delete photos from their company services"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'fotos-servicos' AND
  (storage.foldername(name))[1] IN (
    SELECT s.id::text FROM servicos s
    JOIN usuarios u ON u.empresa_id = s.empresa_id
    WHERE u.id = auth.uid()
  )
);