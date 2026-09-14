// =====================================================================
// Edge Function: followup-automatico — DESATIVADA
//
// Essa function mandava WhatsApp automático (via megaAPI) pra clientes
// com cotação pendente há 10+ dias. Foi desligada em 2026-09-14 depois
// que um lote de 30 mensagens automáticas em ~2min30 fez o WhatsApp
// restringir a conta por 24h (detecção de mensagem automática/em massa).
//
// Decisão: enviar automaticamente por API não-oficial (megaAPI) nunca é
// 100% seguro — mesmo em ritmo bem mais lento (1/hora) o risco de
// banimento permanente continua existindo, e esse número também é usado
// por outras automações (confirmação de agendamento, avaliação,
// cotação via WhatsApp). Perder o número tem custo muito maior que o
// ganho do follow-up automático.
//
// Alternativa adotada: a tela /admin/follow-up ganhou o filtro "10+ dias
// — precisa recontatar" (src/pages/admin/FollowUp.tsx) pra destacar quem
// precisa de novo contato. O envio continua manual, pelo botão de
// WhatsApp (abre o wa.me de verdade — um humano aperta enviar), que não
// tem nenhum risco de detecção por automação.
//
// O cron que chamava essa function (followup-automatico-1-por-hora e o
// followup-automatico-diario anterior) já foi removido do banco
// (cron.unschedule). Este stub fica só como rede de segurança, caso
// algo ainda chame essa URL por engano.
// =====================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      status: "disabled",
      motivo: "Envio automático de follow-up desativado após restrição de 24h do WhatsApp em 2026-09-14. Use o botão manual de WhatsApp na tela /admin/follow-up.",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
