-- Substitui o agendamento diário (que mandava até 25 de uma vez e causou
-- restrição de 24h no WhatsApp em 2026-09-14) por 1 execução por hora em
-- horário comercial. A edge function followup-automatico agora manda no
-- máximo 1 mensagem por execução (LOTE_MAXIMO=1) — ver index.ts.
--
-- 8h-20h America/Sao_Paulo = 11h-23h UTC (SP é UTC-3 fixo).
--
-- Criado DESATIVADO (active=false) até confirmar que a restrição de 24h do
-- WhatsApp passou — reativar com:
--   select cron.alter_job((select jobid from cron.job where jobname='followup-automatico-1-por-hora'), active := true);

select cron.unschedule('followup-automatico-diario') where exists (
  select 1 from cron.job where jobname = 'followup-automatico-diario'
);

select cron.schedule(
  'followup-automatico-1-por-hora',
  '0 11-23 * * *',
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

select cron.alter_job(
  (select jobid from cron.job where jobname = 'followup-automatico-1-por-hora'),
  active := false
);
