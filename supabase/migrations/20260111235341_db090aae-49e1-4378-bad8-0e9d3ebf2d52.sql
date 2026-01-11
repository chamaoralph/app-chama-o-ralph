-- Create user_invitations table for invitation-only signups
CREATE TABLE public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'instalador',
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view and create invitations for their company
CREATE POLICY "Admins can view company invitations"
ON public.user_invitations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id = public.get_empresa_id(auth.uid())
);

CREATE POLICY "Admins can create invitations"
ON public.user_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id = public.get_empresa_id(auth.uid())
);

CREATE POLICY "Admins can delete invitations"
ON public.user_invitations
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id = public.get_empresa_id(auth.uid())
);

-- Anyone can validate an invitation (needed during signup before auth)
CREATE POLICY "Anyone can validate invitations"
ON public.user_invitations
FOR SELECT
TO anon
USING (
  used_at IS NULL 
  AND expires_at > now()
);

-- Function to validate and consume invitation during signup
CREATE OR REPLACE FUNCTION public.validate_signup_invitation(
  p_email TEXT,
  p_token TEXT
)
RETURNS TABLE (
  empresa_id UUID,
  role app_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Find valid invitation
  SELECT i.empresa_id, i.role, i.id INTO v_invitation
  FROM user_invitations i
  WHERE i.email = LOWER(TRIM(p_email))
    AND i.token = p_token
    AND i.used_at IS NULL
    AND i.expires_at > now();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido ou expirado';
  END IF;
  
  -- Mark invitation as used
  UPDATE user_invitations
  SET used_at = now()
  WHERE id = v_invitation.id;
  
  RETURN QUERY SELECT v_invitation.empresa_id, v_invitation.role;
END;
$$;

-- Function to create invitation (for admins)
CREATE OR REPLACE FUNCTION public.create_user_invitation(
  p_email TEXT,
  p_role app_role DEFAULT 'instalador'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_empresa_id UUID;
BEGIN
  -- Only admins can create invitations
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem criar convites';
  END IF;
  
  -- Get caller's empresa_id
  v_empresa_id := public.get_empresa_id(auth.uid());
  
  -- Check if invitation already exists for this email
  DELETE FROM user_invitations 
  WHERE email = LOWER(TRIM(p_email)) 
    AND empresa_id = v_empresa_id
    AND used_at IS NULL;
  
  -- Generate token
  v_token := encode(gen_random_bytes(32), 'hex');
  
  -- Create invitation
  INSERT INTO user_invitations (empresa_id, email, role, token, invited_by)
  VALUES (v_empresa_id, LOWER(TRIM(p_email)), p_role, v_token, auth.uid());
  
  RETURN v_token;
END;
$$;