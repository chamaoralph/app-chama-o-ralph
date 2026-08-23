-- =============================================================================
-- Migration: 20260823120000_notificar_cliente_instalador_solicitado.sql
-- Objetivo : Avisar o cliente no WhatsApp com os dados do instalador (nome
--            completo, telefone e RG) assim que um instalador solicita/pega
--            um serviço disponível.
--
-- Como funciona:
--   UPDATE em servicos (status: disponivel -> atribuido, instalador_id setado)
--        -> gatilho AFTER UPDATE (esta migration)
--        -> POST via pg_net para o workflow N8N "servico-atribuido-cliente"
--        -> N8N formata a mensagem e envia pela megaAPI
--   (mesmo padrão de 20260716000000_notificar_indisponibilidade.sql)
--
-- Pré-requisito: coluna usuarios.rg precisa estar preenchida pro instalador
-- em questão, senão a mensagem sai sem essa informação (nunca trava o envio).
-- =============================================================================

-- 1) Campo RG no cadastro do usuário (instalador) -----------------------------
-- Nullable de propósito: nem todo instalador tem isso preenchido ainda.
-- Sem tela de cadastro pra esse campo por decisão do dono do produto — quem
-- preenche é o admin direto no banco.
alter table public.usuarios
  add column if not exists rg text;

comment on column public.usuarios.rg is
  'RG (documento de identidade) do usuário, usado hoje só pra automação de aviso ao cliente quando um instalador pega um serviço. Preenchido manualmente pelo admin, sem tela própria.';

-- 2) Função do gatilho --------------------------------------------------------
create extension if not exists pg_net with schema extensions;

create or replace function public.notificar_cliente_instalador_solicitado()
returns trigger
language plpgsql
security definer
set search_path = vault
as $$
declare
  v_cliente_nome     text;
  v_cliente_telefone text;
  v_inst_nome        text;
  v_inst_telefone    text;
  v_inst_rg          text;
  v_token            text;
  v_url              text := 'https://primary-production-4e58.up.railway.app/webhook/servico-atribuido-cliente';
begin
  -- Só dispara na transição disponivel -> atribuido, com instalador setado.
  -- (mesma condição do WHERE do trigger, repetida aqui por clareza/segurança
  -- caso o trigger um dia seja anexado sem o WHEN abaixo)
  if new.status is distinct from 'atribuido'
     or old.status is distinct from 'disponivel'
     or new.instalador_id is null then
    return new;
  end if;

  select c.nome, c.telefone
    into v_cliente_nome, v_cliente_telefone
    from public.clientes c
   where c.id = new.cliente_id;

  select u.nome, u.telefone, u.rg
    into v_inst_nome, v_inst_telefone, v_inst_rg
    from public.usuarios u
   where u.id = new.instalador_id;

  -- Sem telefone do cliente não tem pra quem mandar — não dispara.
  if v_cliente_telefone is null or v_cliente_telefone = '' then
    return new;
  end if;

  select decrypted_secret
    into v_token
    from vault.decrypted_secrets
   where name = 'n8n_webhook_secret';

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type',    'application/json',
                 'x-webhook-token', v_token
               ),
    body    := jsonb_build_object(
                 'servico_id',         new.id,
                 'servico_codigo',     new.codigo,
                 'empresa_id',         new.empresa_id,
                 'cliente_nome',       coalesce(v_cliente_nome, 'Cliente'),
                 'cliente_telefone',   v_cliente_telefone,
                 'instalador_nome',    coalesce(v_inst_nome, 'Instalador'),
                 'instalador_telefone', v_inst_telefone,
                 'instalador_rg',      v_inst_rg
               ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

-- 3) Gatilho AFTER UPDATE ------------------------------------------------------
drop trigger if exists trg_notificar_cliente_instalador_solicitado on public.servicos;

create trigger trg_notificar_cliente_instalador_solicitado
after update on public.servicos
for each row
when (new.status = 'atribuido' and old.status = 'disponivel' and new.instalador_id is not null)
execute function public.notificar_cliente_instalador_solicitado();
