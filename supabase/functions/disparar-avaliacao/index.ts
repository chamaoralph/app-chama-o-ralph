import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function hmacSign(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-token",
};

const N8N_WEBHOOK_URL = "https://primary-production-4e58.up.railway.app/webhook/feedback-disparo";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { servico_id } = body;

    if (!servico_id) {
      return new Response(
        JSON.stringify({ error: "servico_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar dados do serviço com cliente e instalador
    const { data: servico, error: sErr } = await supabase
      .from("servicos")
      .select("id, codigo, tipo_servico, empresa_id, cliente_id, instalador_id")
      .eq("id", servico_id)
      .single();

    if (sErr || !servico) {
      return new Response(
        JSON.stringify({ error: "Servico not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar cliente
    const { data: cliente } = await supabase
      .from("clientes")
      .select("nome, telefone")
      .eq("id", servico.cliente_id)
      .single();

    // Buscar instalador
    let instaladorNome = "Não atribuído";
    if (servico.instalador_id) {
      const { data: instalador } = await supabase
        .from("usuarios")
        .select("nome")
        .eq("id", servico.instalador_id)
        .single();
      if (instalador) instaladorNome = instalador.nome;
    }

    // Buscar avaliação
    const { data: avaliacao } = await supabase
      .from("avaliacoes")
      .select("id")
      .eq("servico_id", servico_id)
      .single();

    // Preparar payload pro n8n
    const payload = {
      avaliacao_id: avaliacao?.id,
      servico_id: servico.id,
      servico_codigo: servico.codigo,
      tipo_servico: servico.tipo_servico,
      empresa_id: servico.empresa_id,
      cliente_nome: cliente?.nome || "Cliente",
      cliente_telefone: cliente?.telefone || "",
      instalador_nome: instaladorNome,
      timestamp: new Date().toISOString(),
    };

    // Gerar HMAC signature
    const secret = Deno.env.get("WEBHOOK_SECRET");
    if (!secret) {
      return new Response(
        JSON.stringify({ error: "WEBHOOK_SECRET not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payloadStr = JSON.stringify(payload);
    const signature = await hmacSign(secret, payloadStr);

    // Marcar enviado_em + status='enviada' na avaliação. O workflow "Feedback WhatsApp -
    // Captura" no N8N só encontra a avaliação certa buscando por status='enviada' quando o
    // cliente responde — sem isso a resposta do cliente chega no WhatsApp mas nunca é
    // vinculada a nenhuma avaliação (bug real encontrado em produção: status ficava
    // 'pendente' pra sempre, mesmo com a mensagem já enviada).
    if (avaliacao?.id) {
      await supabase
        .from("avaliacoes")
        .update({ enviado_em: new Date().toISOString(), status: "enviada" })
        .eq("id", avaliacao.id);
    }

    // Chamar N8N
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-token": secret,
        "x-signature": signature,
      },
      body: payloadStr,
    });

    const n8nStatus = n8nResponse.status;

    return new Response(
      JSON.stringify({
        success: true,
        n8n_status: n8nStatus,
        payload,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
