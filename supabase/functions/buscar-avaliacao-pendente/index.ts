import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = req.headers.get("x-webhook-token");
    if (!token || token !== Deno.env.get("WEBHOOK_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { telefone } = await req.json();
    if (!telefone) {
      return new Response(JSON.stringify({ error: "telefone is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Normalizar telefone (remove 55 do início se tiver)
    const telefoneNorm = telefone.replace(/\D/g, "").replace(/^55/, "");

    // Buscar cliente pelo telefone
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, nome")
      .or(`telefone.eq.${telefoneNorm},telefone.eq.55${telefoneNorm}`)
      .maybeSingle();

    if (!cliente) {
      return new Response(
        JSON.stringify({ encontrou: false, motivo: "cliente_nao_encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar avaliação já enviada aguardando resposta. Fluxo de status:
    // pendente (criada) -> enviada (disparar-avaliacao mandou o WhatsApp) ->
    // respondida | nao_avaliou (registrar-avaliacao). Bug real encontrado em produção:
    // essa query buscava status='pendente', que nunca era o estado de uma avaliação já
    // enviada (disparar-avaliacao virou pra 'enviada') — toda resposta de cliente batia
    // aqui e não achava nada.
    const { data: avaliacao } = await supabase
      .from("avaliacoes")
      .select("id, servico_id, status, enviado_em")
      .eq("cliente_id", cliente.id)
      .eq("status", "enviada")
      .not("enviado_em", "is", null)
      .order("enviado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!avaliacao) {
      return new Response(
        JSON.stringify({ encontrou: false, motivo: "sem_avaliacao_pendente" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        encontrou: true,
        avaliacao: {
          id: avaliacao.id,
          servico_id: avaliacao.servico_id,
          cliente_nome: cliente.nome,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
