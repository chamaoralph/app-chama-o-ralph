-- ============================================================
-- Prioridade de instaladores — Etapa 5
-- Só mostra um serviço disponível ao instalador depois que chegar a
-- vez dele na cascata (cascata_notificacoes). Serviço sem nenhuma
-- linha na cascata continua aparecendo para todos (failsafe caso a
-- fila não tenha sido montada).
--
-- SECURITY DEFINER: roda com privilégio elevado, ignorando a RLS de
-- cascata_notificacoes (que só deixa cada instalador ver a própria
-- linha) para poder checar "existe alguma linha desse serviço, de
-- QUALQUER instalador". search_path fixado em 'public' por segurança.
-- ============================================================

CREATE OR REPLACE FUNCTION public.servicos_disponiveis_para_mim()
RETURNS TABLE (
  id                         uuid,
  codigo                     text,
  tipo_servico               text[],
  data_servico_agendada      timestamptz,
  endereco_completo          text,
  valor_mao_obra_instalador  numeric,
  descricao                  text,
  acessorios_vendidos        jsonb,
  cliente_nome               text,
  cliente_telefone           text,
  cliente_bairro             text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instalador_id uuid := auth.uid();
  v_empresa_id    uuid;
BEGIN
  IF v_instalador_id IS NULL THEN
    RETURN;
  END IF;

  SELECT u.empresa_id INTO v_empresa_id
  FROM usuarios u
  WHERE u.id = v_instalador_id;

  IF v_empresa_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id, s.codigo, s.tipo_servico, s.data_servico_agendada, s.endereco_completo,
    s.valor_mao_obra_instalador, s.descricao, s.acessorios_vendidos,
    cl.nome, cl.telefone, cl.bairro
  FROM servicos s
  LEFT JOIN clientes cl ON cl.id = s.cliente_id
  WHERE s.status = 'disponivel'
    AND s.empresa_id = v_empresa_id
    AND (
      NOT EXISTS (
        SELECT 1 FROM cascata_notificacoes c WHERE c.servico_id = s.id
      )
      OR EXISTS (
        SELECT 1 FROM cascata_notificacoes c
        WHERE c.servico_id = s.id
          AND c.instalador_id = v_instalador_id
          AND c.agendado_para <= now()
      )
    )
  ORDER BY s.data_servico_agendada ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.servicos_disponiveis_para_mim() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.servicos_disponiveis_para_mim() TO authenticated;
