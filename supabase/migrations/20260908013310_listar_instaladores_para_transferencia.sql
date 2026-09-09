-- Lista instaladores ativos da mesma empresa do usuário autenticado, exceto
-- o informado em p_excluir_instalador_id. Usado pelo modal de transferência
-- de serviço, inclusive quando quem chama é o próprio instalador (que por
-- RLS não pode listar outros usuarios diretamente).

CREATE OR REPLACE FUNCTION public.listar_instaladores_para_transferencia(
  p_excluir_instalador_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select u.id, u.nome
  from public.usuarios u
  where u.tipo = 'instalador'
    and u.ativo = true
    and u.empresa_id = (select empresa_id from public.usuarios where id = auth.uid())
    and (p_excluir_instalador_id is null or u.id <> p_excluir_instalador_id)
  order by u.nome;
$$;

COMMENT ON FUNCTION public.listar_instaladores_para_transferencia(uuid) IS
  'Lista instaladores ativos da mesma empresa do usuário autenticado, exceto o informado em p_excluir_instalador_id. Usado pelo modal de transferência de serviço, inclusive quando quem chama é o próprio instalador (que por RLS não pode listar outros usuarios diretamente).';
