-- Trigger atômico para criar usuario/role/instalador no signup via convite
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text := NEW.raw_user_meta_data->>'tipo';
  v_empresa_id uuid;
BEGIN
  -- Skip se metadata não veio (ex: signup feito por outro caminho que não o do convite)
  IF v_tipo IS NULL OR (NEW.raw_user_meta_data->>'empresa_id') IS NULL THEN
    RETURN NEW;
  END IF;

  v_empresa_id := (NEW.raw_user_meta_data->>'empresa_id')::uuid;

  -- usuarios (idempotente)
  INSERT INTO public.usuarios (id, empresa_id, nome, telefone, tipo, ativo)
  VALUES (
    NEW.id,
    v_empresa_id,
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'telefone',
    v_tipo,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- user_roles (idempotente)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_tipo::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- instaladores (somente se for instalador)
  IF v_tipo = 'instalador' THEN
    INSERT INTO public.instaladores (id, empresa_id, ativo)
    VALUES (NEW.id, v_empresa_id, true)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();