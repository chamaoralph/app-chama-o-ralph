// =====================================================================
// Edge Function: followup-automatico
//
// Roda 1x/dia (via pg_cron + pg_net, ver migration
// 20260914190000_agendar_followup_automatico.sql) e manda uma mensagem
// de WhatsApp pra clientes com cotação pendente há 10+ dias — e repete
// a cada 10 dias enquanto a cotação continuar pendente (sem fechar nem
// ser marcada como "Não Gerou"/perdida/etc).
//
// Mesmo texto do botão manual de WhatsApp da tela /admin/follow-up
// (src/pages/admin/FollowUp.tsx -> abrirWhatsApp).
//
// Segurança: exige o header x-webhook-token com o valor de WEBHOOK_SECRET
// (mesmo padrão das outras edge functions do projeto, ex: disparar-avaliacao).
// JWT verification fica desabilitado no deploy (igual às demais 8 functions
// do projeto — ver CLAUDE.md), já que quem chama é o pg_cron/pg_net.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MEGA_HOST = Deno.env.get("MEGAAPI_HOST") ?? "apinocode01.megaapi.com.br";
const MEGA_INSTANCE_KEY = Deno.env.get("MEGAAPI_INSTANCE_KEY") ?? "megacode-MoTNZMNvYUQ";
const MEGA_TOKEN = Deno.env.get("MEGAAPI_TOKEN") ?? "MoTNZMNvYUQ";

const DIAS_LIMITE = 10;
// Pausa entre envios pra não levar bloqueio da megaAPI/WhatsApp (mesma
// prática recomendada usada no workflow de Confirmação de Agendamento no N8N).
const PAUSA_ENTRE_ENVIOS_MS = 4000;
// Máximo de mensagens por execução — a megaAPI recomenda não passar de ~50
// contatos sem pausas longas. Quem não for atendido hoje (backlog grande)
// continua elegível e é pego na execução de amanhã, sem repetir os já enviados.
const LOTE_MAXIMO = 25;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token",
};

function montarMensagem(nome: string): string {
  return `Olá ${nome}! Tudo bem? Passando para saber se você ainda tem interesse no serviço que conversamos. Posso ajudar com alguma dúvida?`;
}

function formatarTelefoneWhatsapp(telefone: string): { limpo: string; jid: string } {
  let limpo = (telefone || "").replace(/\D/g, "");
  if (limpo && !limpo.startsWith("55")) limpo = "55" + limpo;
  return { limpo, jid: `${limpo}@s.whatsapp.net` };
}

async function enviarWhatsapp(jid: string, texto: string): Promise<void> {
  const resp = await fetch(`https://${MEGA_HOST}/rest/sendMessage/${MEGA_INSTANCE_KEY}/text`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MEGA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messageData: { to: jid, text: texto } }),
  });
  if (!resp.ok) {
    throw new Error(`megaAPI respondeu ${resp.status}: ${await resp.text()}`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Faz o trabalho pesado (busca + envios + registro) em background — chamado
// via EdgeRuntime.waitUntil depois que a resposta HTTP já foi devolvida.
// Isso evita que o timeout curto do pg_net (5s, usado pelo pg_cron) corte a
// chamada no meio do envio das mensagens.
async function processarFollowupAutomatico(supabase: ReturnType<typeof createClient>) {
  const resultado = { enviados: 0, elegiveis: 0, erros: [] as { cotacao_id: string; erro: string }[] };

  try {
    const limite = new Date();
    limite.setDate(limite.getDate() - DIAS_LIMITE);

    const { data: cotacoes, error: erroCotacoes } = await supabase
      .from("cotacoes")
      .select("id, empresa_id, created_at, clientes!cotacoes_cliente_id_fkey(nome, telefone)")
      .eq("status", "pendente")
      .lte("created_at", limite.toISOString())
      .order("created_at", { ascending: true }); // mais atrasados primeiro

    if (erroCotacoes) throw erroCotacoes;
    if (!cotacoes || cotacoes.length === 0) return resultado;

    resultado.elegiveis = cotacoes.length;
    const cotacaoIds = cotacoes.map((c: any) => c.id);

    // Última mensagem automática já enviada por cotação — pra saber se já
    // passaram 10 dias desde o último envio (e não só desde a criação).
    const { data: contatosAuto } = await supabase
      .from("followup_contatos")
      .select("cotacao_id, created_at")
      .eq("tipo_contato", "whatsapp_auto")
      .in("cotacao_id", cotacaoIds)
      .order("created_at", { ascending: false });

    const ultimoAutoPorCotacao: Record<string, string> = {};
    (contatosAuto || []).forEach((c: any) => {
      if (!ultimoAutoPorCotacao[c.cotacao_id]) ultimoAutoPorCotacao[c.cotacao_id] = c.created_at;
    });

    // Nunca mandar pra telefone bloqueado.
    const { data: bloqueados } = await supabase.from("telefones_bloqueados").select("telefone");
    const telefonesBloqueados = new Set((bloqueados || []).map((b: any) => (b.telefone || "").replace(/\D/g, "")));

    // Admin de cada empresa, pra registrar o followup_contatos (usuario_id NOT NULL).
    const empresaIds = [...new Set(cotacoes.map((c: any) => c.empresa_id))];
    const { data: admins } = await supabase
      .from("usuarios")
      .select("id, empresa_id")
      .eq("tipo", "admin")
      .in("empresa_id", empresaIds);
    const adminPorEmpresa: Record<string, string> = {};
    (admins || []).forEach((a: any) => {
      if (!adminPorEmpresa[a.empresa_id]) adminPorEmpresa[a.empresa_id] = a.id;
    });

    for (const cotacao of cotacoes as any[]) {
      if (resultado.enviados >= LOTE_MAXIMO) break; // resto fica pro próximo dia

      const ultimoAuto = ultimoAutoPorCotacao[cotacao.id];
      const dataBase = new Date(ultimoAuto ?? cotacao.created_at);
      const diasDesdeBase = Math.floor((Date.now() - dataBase.getTime()) / (1000 * 60 * 60 * 24));
      if (diasDesdeBase < DIAS_LIMITE) continue; // ainda não completou outro ciclo de 10 dias

      const cliente = cotacao.clientes;
      const { limpo: telefoneLimpo, jid } = formatarTelefoneWhatsapp(cliente?.telefone || "");
      if (!telefoneLimpo) continue;
      if (telefonesBloqueados.has(telefoneLimpo)) continue;

      const adminId = adminPorEmpresa[cotacao.empresa_id];
      if (!adminId) {
        resultado.erros.push({ cotacao_id: cotacao.id, erro: "Empresa sem usuário admin cadastrado" });
        continue;
      }

      try {
        await enviarWhatsapp(jid, montarMensagem(cliente?.nome || "Cliente"));

        const { error: erroInsert } = await supabase.from("followup_contatos").insert({
          cotacao_id: cotacao.id,
          empresa_id: cotacao.empresa_id,
          usuario_id: adminId,
          tipo_contato: "whatsapp_auto",
          observacoes: `Mensagem automática de follow-up (${DIAS_LIMITE}+ dias sem retorno).`,
        });
        if (erroInsert) throw erroInsert;

        resultado.enviados++;
        await sleep(PAUSA_ENTRE_ENVIOS_MS);
      } catch (e) {
        resultado.erros.push({ cotacao_id: cotacao.id, erro: e instanceof Error ? e.message : String(e) });
      }
    }
  } catch (err: any) {
    resultado.erros.push({ cotacao_id: "geral", erro: err.message });
  }

  console.log("followup-automatico:", JSON.stringify(resultado));
  return resultado;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const secretEsperado = Deno.env.get("WEBHOOK_SECRET");
  if (!secretEsperado) {
    return new Response(JSON.stringify({ error: "WEBHOOK_SECRET não configurado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (req.headers.get("x-webhook-token") !== secretEsperado) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Responde já (o pg_cron/pg_net só espera 5s pela resposta) e continua os
  // envios em background — ver comentário em processarFollowupAutomatico.
  // @ts-ignore: EdgeRuntime é global no runtime do Supabase, sem tipos no editor.
  EdgeRuntime.waitUntil(processarFollowupAutomatico(supabase));

  return new Response(JSON.stringify({ status: "processando em background" }), {
    status: 202,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
