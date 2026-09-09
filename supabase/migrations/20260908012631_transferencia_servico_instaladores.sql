-- Transferência de serviço entre instaladores, com trilha de auditoria.
--
-- Hoje servicos.instalador_id é sobrescrito quando um serviço muda de
-- responsável, sem deixar histórico. Isso é um problema contratual: a
-- cláusula de não aliciamento se apoia no registro de quem recebeu os
-- dados de cada cliente e quando.
--
-- Esta migration cria:
-- 1. servicos_transferencias — histórico imutável (só INSERT, nunca
--    UPDATE/DELETE) de cada transferência.
-- 2. Um trigger em servicos que bloqueia troca direta de instalador_id
--    (de um instalador pra outro) via UPDATE do client — só passa quando
--    a flag de sessão app.transferencia_via_funcao está ligada, o que só
--    acontece dentro da função transferir_servico() abaixo.
-- 3. A função transferir_servico(), único caminho permitido para
--    reatribuir um serviço já atribuído.

CREATE TABLE public.servicos_transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  servico_id uuid NOT NULL REFERENCES public.servicos(id),
  de_instalador_id uuid NOT NULL REFERENCES public.usuarios(id),
  para_instalador_id uuid NOT NULL REFERENCES public.usuarios(id),
  motivo text,
  transferido_por uuid NOT NULL REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.servicos_transferencias IS
  'Histórico imutável de transferências de serviço entre instaladores. Nunca é editado nem apagado — só recebe INSERT, e exclusivamente via a função transferir_servico().';

COMMENT ON COLUMN public.servicos_transferencias.transferido_por IS
  'auth.uid() de quem executou a transferência (o próprio instalador atual ou um admin da empresa).';

CREATE INDEX idx_servicos_transferencias_servico_id ON public.servicos_transferencias USING btree (servico_id);
CREATE INDEX idx_servicos_transferencias_de_instalador_id ON public.servicos_transferencias USING btree (de_instalador_id);
CREATE INDEX idx_servicos_transferencias_para_instalador_id ON public.servicos_transferencias USING btree (para_instalador_id);

ALTER TABLE public.servicos_transferencias ENABLE ROW LEVEL SECURITY;

-- SELECT: admin da empresa e os dois instaladores envolvidos.
-- Não há policy de INSERT/UPDATE/DELETE — a tabela só é escrita pela
-- função transferir_servico(), que roda como SECURITY DEFINER e portanto
-- ignora RLS. Nenhum client consegue inserir, editar ou apagar direto.
CREATE POLICY "Admin da empresa vê transferências da empresa"
  ON public.servicos_transferencias
  FOR SELECT
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.usuarios WHERE id = auth.uid() AND tipo = 'admin'
    )
  );

CREATE POLICY "Instaladores envolvidos veem a própria transferência"
  ON public.servicos_transferencias
  FOR SELECT
  USING (de_instalador_id = auth.uid() OR para_instalador_id = auth.uid());

-- Bloqueia troca direta de UM instalador pra OUTRO via UPDATE do client.
-- Atribuição inicial (de null pra alguém) e "devolver pro pool" (de
-- alguém pra null, via "Disponibilizar") continuam liberados, pois não
-- são transferência entre instaladores.
CREATE OR REPLACE FUNCTION public.bloquear_transferencia_direta_instalador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if old.instalador_id is not null
     and new.instalador_id is not null
     and new.instalador_id is distinct from old.instalador_id
     and coalesce(current_setting('app.transferencia_via_funcao', true), '') <> 'on'
  then
    raise exception 'Troca direta de instalador não é permitida. Use a transferência de serviço para manter o histórico de auditoria.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_transferencia_direta_instalador ON public.servicos;
CREATE TRIGGER trg_bloquear_transferencia_direta_instalador
BEFORE UPDATE ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_transferencia_direta_instalador();

-- Único caminho permitido para reatribuir um serviço já atribuído a outro
-- instalador. Valida, nesta ordem: empresa, permissão (instalador atual
-- ou admin), status, destinatário (existe/ativo/mesma empresa) e
-- destinatário diferente do atual. Grava o histórico e só então atualiza
-- servicos.instalador_id, numa única transação.
CREATE OR REPLACE FUNCTION public.transferir_servico(
  p_servico_id uuid,
  p_para_instalador_id uuid,
  p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_caller_id         uuid := auth.uid();
  v_caller_empresa_id uuid;
  v_caller_tipo       text;
  v_servico           record;
  v_destino           record;
begin
  if v_caller_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if p_servico_id is null or p_para_instalador_id is null then
    raise exception 'Serviço e instalador de destino são obrigatórios.';
  end if;

  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'Informe o motivo da transferência.';
  end if;

  select empresa_id, tipo
    into v_caller_empresa_id, v_caller_tipo
    from public.usuarios
   where id = v_caller_id;

  if v_caller_empresa_id is null then
    raise exception 'Usuário autenticado não encontrado.';
  end if;

  -- Trava a linha do serviço pra evitar duas transferências concorrentes.
  select id, empresa_id, instalador_id, status
    into v_servico
    from public.servicos
   where id = p_servico_id
   for update;

  if v_servico.id is null then
    raise exception 'Serviço não encontrado.';
  end if;

  -- Validação 1: serviço pertence à empresa do usuário autenticado.
  if v_servico.empresa_id is distinct from v_caller_empresa_id then
    raise exception 'Serviço não pertence à sua empresa.';
  end if;

  -- Validação 2: quem chama é o instalador atual do serviço OU admin da empresa.
  if v_caller_tipo is distinct from 'admin' and v_servico.instalador_id is distinct from v_caller_id then
    raise exception 'Apenas o instalador atual do serviço ou um administrador podem transferi-lo.';
  end if;

  if v_servico.instalador_id is null then
    raise exception 'Serviço não possui instalador atribuído — não há o que transferir.';
  end if;

  -- Validação 3: status permite transferência.
  if v_servico.status in ('concluido', 'cancelado') then
    raise exception 'Serviço com status "%" não permite transferência.', v_servico.status;
  end if;

  select id, empresa_id, tipo, ativo
    into v_destino
    from public.usuarios
   where id = p_para_instalador_id;

  -- Validação 4: destinatário existe, está ativo e é da mesma empresa.
  if v_destino.id is null then
    raise exception 'Instalador de destino não encontrado.';
  end if;

  if v_destino.tipo is distinct from 'instalador' then
    raise exception 'Destinatário informado não é um instalador.';
  end if;

  if v_destino.ativo is distinct from true then
    raise exception 'Instalador de destino está inativo.';
  end if;

  if v_destino.empresa_id is distinct from v_caller_empresa_id then
    raise exception 'Instalador de destino não pertence à sua empresa.';
  end if;

  -- Validação 5: destinatário diferente do instalador atual.
  if p_para_instalador_id = v_servico.instalador_id then
    raise exception 'O instalador de destino já é o responsável atual pelo serviço.';
  end if;

  -- Tudo validado: grava o histórico e reatribui o serviço numa única transação.
  insert into public.servicos_transferencias (
    empresa_id, servico_id, de_instalador_id, para_instalador_id, motivo, transferido_por
  ) values (
    v_caller_empresa_id, v_servico.id, v_servico.instalador_id, p_para_instalador_id, p_motivo, v_caller_id
  );

  -- Libera o trigger de bloqueio só para o UPDATE desta transação.
  perform set_config('app.transferencia_via_funcao', 'on', true);

  -- valor_mao_obra_instalador NÃO é recalculado aqui: o valor acompanha o
  -- serviço e passa a ser do novo instalador_id automaticamente, já que é
  -- por instalador_id que comissão, prestação de contas e responsabilidade
  -- técnica são apuradas em todo o resto do sistema (extrato, pagamentos,
  -- recibos etc).
  update public.servicos
     set instalador_id = p_para_instalador_id,
         updated_at = now()
   where id = v_servico.id;
end;
$$;

COMMENT ON FUNCTION public.transferir_servico(uuid, uuid, text) IS
  'Único caminho permitido para reatribuir um serviço já atribuído a outro instalador. Valida empresa, permissão, status, destinatário e grava o histórico em servicos_transferencias antes de atualizar servicos.instalador_id.';
