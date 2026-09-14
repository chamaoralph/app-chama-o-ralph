-- =============================================================================
-- Migration: 20260914223000_agendar_followup_automatico.sql
--
-- Agenda o disparo diário (via pg_cron + pg_net) da edge function
-- followup-automatico, que manda WhatsApp pra clientes com cotação pendente
-- há 10+ dias — e repete a cada 10 dias enquanto continuar pendente. Ver
-- supabase/functions/followup-automatico/index.ts.
--
-- 19:30 America/Sao_Paulo = 22:30 UTC (SP é UTC-3 fixo, sem horário de verão).
--
-- O secret usado no header x-webhook-token vem do Vault (n8n_webhook_secret,
-- já usado pelas demais integrações N8N/Edge Functions do projeto, mesmo
-- valor de WEBHOOK_SECRET) — nunca gravado em texto puro nesta migration.
-- =============================================================================

create extension if not exists pg_cron;

select cron.schedule(
  'followup-automatico-diario',
  '30 22 * * *',
  $$
  select net.http_post(
    url := 'https://dgkpxgwpjgnrobxduamz.supabase.co/functions/v1/followup-automatico',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-token', (select decrypted_secret from vault.decrypted_secrets where name = 'n8n_webhook_secret')
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);
