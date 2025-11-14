-- Fix RLS recursion properly using security definer function
CREATE OR REPLACE FUNCTION public.get_empresa_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.usuarios WHERE id = _user_id;
$$;

DROP POLICY IF EXISTS "Admin pode ver todos usuarios da empresa" ON public.usuarios;
CREATE POLICY "Admin pode ver todos usuarios da empresa"
ON public.usuarios
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND empresa_id = public.get_empresa_id(auth.uid())
);
