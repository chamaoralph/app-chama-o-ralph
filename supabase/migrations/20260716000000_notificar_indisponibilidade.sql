-- =============================================================================
-- Migration: 20260716000000_notificar_indisponibilidade.sql
-- Objetivo : Avisar o admin no WhatsApp quando um instalador marca
--            indisponibilidade na agenda.
--
-- Como funciona:
--   INSERT em indisponibilidades_instaladores
--        -> gatilho AFTER INSERT (esta migration)
--        -> POST via pg_net para o workflow N8N "indisponibilidade-alerta"
--        -> N8N formata a mensagem e envia pela megaAPI (Etapas 2 e 3)
--
-- Observações de projeto:
--   - Nome do instalador vem de public.usuarios (id compartilhado com o
--     instalador_id). A função é SECURITY DEFINER, então a RLS de "instaladores"
--     não atrapalha a leitura do nome.
--   - created_at (timestamptz) é convertido para America/Sao_Paulo aqui.
--   - data_* e hora_* são campos puros (date / time) e vão sem conversão.
--   - Envio é "fire-and-forget" (pg_net assíncrono): não trava o INSERT do app.
-- =============================================================================

-- 1) Extensão para chamadas HTTP a partir do Postgres -------------------------
create extension if not exists pg_net with schema extensions;

-- 2) Função do gatilho --------------------------------------------------------
create or replace function public.notificar_indisponibilidade()
returns trigger
language plpgsql
security definer
set search_path = vault
as $$
declare
  v_nome      text;
  v_criado_sp text;
  v_token     text;
  -- URL do workflow N8N que será criado na Etapa 2
  v_url       text := 'https://primary-production-4e58.up.railway.app/webhook/indisponibilidade-alerta';
begin
  -- Nome do instalador (usuarios.id = indisponibilidades_instaladores.instalador_id)
  select u.nome
    into v_nome
    from public.usuarios u
   where u.id = new.instalador_id;

  -- "Marcado em" no horário de São Paulo, já formatado
  v_criado_sp := to_char(
                   new.created_at at time zone 'America/Sao_Paulo',
                   'DD/MM/YYYY HH24:MI'
                 );

  -- Token do webhook (Vault, nunca em texto puro)
  select decrypted_secret
    into v_token
    from vault.decrypted_secrets
   where name = 'n8n_webhook_secret';

  -- Dispara para o N8N (não bloqueia o INSERT)
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type',   'application/json',
                 'x-webhook-token', v_token
               ),
    body    := jsonb_build_object(
                 'instalador_nome', coalesce(v_nome, 'Instalador'),
                 'instalador_id',   new.instalador_id,
                 'empresa_id',      new.empresa_id,
                 'data_inicio',     new.data_inicio,
                 'data_fim',        new.data_fim,
                 'hora_inicio',     new.hora_inicio,
                 'hora_fim',        new.hora_fim,
                 'motivo',          new.motivo,
                 'criado_em_sp',    v_criado_sp
               ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

-- 3) Gatilho AFTER INSERT -----------------------------------------------------
drop trigger if exists trg_notificar_indisponibilidade
  on public.indisponibilidades_instaladores;

create trigger trg_notificar_indisponibilidade
after insert on public.indisponibilidades_instaladores
for each row
execute function public.notificar_indisponibilidade();
