-- =============================================================================
-- Migration: 20260823130000_copia_admin_notificacao_instalador.sql
-- Objetivo : Incluir o telefone do admin no payload da notificação de
--            "instalador solicitou serviço" (20260823120000), pra o N8N
--            também mandar uma cópia da mensagem pro admin acompanhar.
--
-- Número fixo (hardcoded) de propósito: sistema é single-tenant (uma empresa
-- só, "Chama o Ralph"), sem tela de configuração de contato do admin.
-- =============================================================================

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
  v_admin_telefone   text := '11945672534';
begin
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
                 'servico_id',          new.id,
                 'servico_codigo',      new.codigo,
                 'empresa_id',          new.empresa_id,
                 'cliente_nome',        coalesce(v_cliente_nome, 'Cliente'),
                 'cliente_telefone',    v_cliente_telefone,
                 'instalador_nome',     coalesce(v_inst_nome, 'Instalador'),
                 'instalador_telefone', v_inst_telefone,
                 'instalador_rg',       v_inst_rg,
                 'admin_telefone',      v_admin_telefone
               ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;
