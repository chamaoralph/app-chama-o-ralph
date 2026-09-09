-- Histórico de transferências de um serviço, com nomes resolvidos. Só
-- retorna linhas que o usuário autenticado já poderia ver via RLS de
-- servicos_transferencias (admin da empresa ou um dos dois instaladores
-- envolvidos) — regra replicada manualmente aqui por rodar como
-- SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.historico_transferencias_servico(
  p_servico_id uuid
)
RETURNS TABLE(
  id uuid,
  de_instalador_id uuid,
  de_instalador_nome text,
  para_instalador_id uuid,
  para_instalador_nome text,
  motivo text,
  transferido_por uuid,
  transferido_por_nome text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select
    t.id,
    t.de_instalador_id,
    de.nome,
    t.para_instalador_id,
    para.nome,
    t.motivo,
    t.transferido_por,
    quem.nome,
    t.created_at
  from public.servicos_transferencias t
  join public.usuarios de   on de.id = t.de_instalador_id
  join public.usuarios para on para.id = t.para_instalador_id
  join public.usuarios quem on quem.id = t.transferido_por
  where t.servico_id = p_servico_id
    and (
      t.empresa_id in (
        select empresa_id from public.usuarios where id = auth.uid() and tipo = 'admin'
      )
      or t.de_instalador_id = auth.uid()
      or t.para_instalador_id = auth.uid()
    )
  order by t.created_at desc;
$$;

COMMENT ON FUNCTION public.historico_transferencias_servico(uuid) IS
  'Histórico de transferências de um serviço, com nomes resolvidos. Só retorna linhas que o usuário autenticado já poderia ver via RLS de servicos_transferencias (admin da empresa ou um dos dois instaladores envolvidos) — regra replicada manualmente aqui por rodar como SECURITY DEFINER.';
