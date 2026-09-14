-- Remove de vez o cron da automação de follow-up por WhatsApp.
--
-- Decisão: mesmo em ritmo bem mais lento (1/hora), enviar automaticamente
-- por API não-oficial do WhatsApp (megaAPI) nunca é 100% seguro — o risco
-- de banimento permanente do número continua existindo, e esse número
-- também é usado por outras automações do negócio (confirmação de
-- agendamento, avaliação, cotação via WhatsApp). Ver
-- supabase/functions/followup-automatico/index.ts (virou um stub inerte).
--
-- Alternativa: a tela /admin/follow-up ganhou o filtro "10+ dias — precisa
-- recontatar" pra destacar quem precisa de novo contato; o envio continua
-- manual, pelo botão de WhatsApp (wa.me — um humano aperta enviar).

select cron.unschedule('followup-automatico-1-por-hora') where exists (
  select 1 from cron.job where jobname = 'followup-automatico-1-por-hora'
);

select cron.unschedule('followup-automatico-diario') where exists (
  select 1 from cron.job where jobname = 'followup-automatico-diario'
);
