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
    "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get("WEBHOOK_SECRET");
    if (!secret) {
      return new Response(
        JSON.stringify({ error: "WEBHOOK_SECRET not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawBody = await req.text();

    // Aceita dois jeitos de autenticar: token simples (x-webhook-token, é como o N8N chama
    // essa e todas as outras Edge Functions — ver skill n8n-railway) OU assinatura HMAC
    // (x-webhook-signature, mais forte, pra outros chamadores). Bug real encontrado em
    // produção: antes só aceitava HMAC, mas o node "Registrar Avaliação" do N8N manda
    // x-webhook-token — toda tentativa de registrar a nota do cliente falhava com 401
    // "Missing signature", mesmo depois da avaliação já estar sendo encontrada certo.
    const tokenHeader = req.headers.get("x-webhook-token");
    const signatureHeader = req.headers.get("x-webhook-signature");

    let autenticado = false;
    if (tokenHeader) {
      autenticado = tokenHeader === secret;
    } else if (signatureHeader) {
      const expectedSignature = await hmacSign(secret, rawBody);
      autenticado = signatureHeader === expectedSignature;
    }

    if (!autenticado) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authentication (x-webhook-token or x-webhook-signature)" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = JSON.parse(rawBody);
    const { avaliacao_id, nota, comentario, status } = body;

    // Validações
    if (!avaliacao_id) {
      return new Response(
        JSON.stringify({ error: "avaliacao_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!status || !["respondida", "nao_avaliou"].includes(status)) {
      return new Response(
        JSON.stringify({ error: "status must be 'respondida' or 'nao_avaliou'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (status === "respondida") {
      if (nota !== undefined && nota !== null) {
        if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
          return new Response(
            JSON.stringify({ error: "nota must be integer between 1 and 5" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    if (comentario && typeof comentario === "string" && comentario.length > 1000) {
      return new Response(
        JSON.stringify({ error: "comentario max 1000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const updateData: Record<string, unknown> = {
      status,
      respondido_em: new Date().toISOString(),
    };

    if (status === "respondida") {
      if (nota !== undefined && nota !== null) updateData.nota = nota;
      if (comentario) updateData.comentario = comentario.substring(0, 1000);
    }

    const { error } = await supabase
      .from("avaliacoes")
      .update(updateData)
      .eq("id", avaliacao_id);

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, avaliacao_id, status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
