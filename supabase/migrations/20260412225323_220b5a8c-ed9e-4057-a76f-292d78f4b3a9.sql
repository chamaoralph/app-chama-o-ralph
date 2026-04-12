CREATE OR REPLACE FUNCTION public.create_user_invitation(p_email text, p_role app_role DEFAULT 'instalador'::app_role)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token TEXT;
  v_empresa_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem criar convites';
  END IF;

  v_empresa_id := public.get_empresa_id(auth.uid());

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada';
  END IF;

  DELETE FROM public.user_invitations
  WHERE email = LOWER(TRIM(p_email))
    AND empresa_id = v_empresa_id
    AND used_at IS NULL;

  INSERT INTO public.user_invitations (
    empresa_id,
    email,
    role,
    invited_by
  )
  VALUES (
    v_empresa_id,
    LOWER(TRIM(p_email)),
    p_role,
    auth.uid()
  )
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$function$;