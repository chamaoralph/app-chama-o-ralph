import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token",
};

const LIMITE_PADRAO = 1;
const LIMITE_MAXIMO = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = req.headers.get("x-webhook-token");
  const expectedToken = Deno.env.get("WEBHOOK_SECRET");

  if (!token || token !== expectedToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "pendentes") {
      const { empresa_id, limite } = body;

      if (!empresa_id) {
        return new Response(JSON.stringify({ error: "empresa_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let limiteFinal = Number.isInteger(limite) ? limite : LIMITE_PADRAO;
      if (limiteFinal < 1) limiteFinal = LIMITE_PADRAO;
      if (limiteFinal > LIMITE_MAXIMO) limiteFinal = LIMITE_MAXIMO;

      const janelaFim = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // 0. Buscar clientes com nao_perturbe = true (sem join) pra excluir da fila
      const { data: clientesBloqueados, error: bErr } = await supabase
        .from("clientes")
        .select("id")
        .eq("empresa_id", empresa_id)
        .eq("nao_perturbe", true);

      if (bErr) throw bErr;

      const idsBloqueados = (clientesBloqueados ?? []).map((c) => c.id);

      // 1. Buscar avaliações elegíveis (sem join), excluindo nao_perturbe ANTES do limit
      let query = supabase
        .from("avaliacoes")
        .select("id, cliente_id, respondido_em")
        .eq("empresa_id", empresa_id)
        .eq("status", "respondida")
        .gte("nota", 4)
        .is("upsell_enviado_em", null)
        .lte("respondido_em", janelaFim);

      if (idsBloqueados.length > 0) {
        query = query.not("cliente_id", "in", `(${idsBloqueados.join(",")})`);
      }

      const { data: avaliacoes, error: aErr } = await query
        .order("respondido_em", { ascending: false })
        .limit(limiteFinal);

      if (aErr) throw aErr;

      if (!avaliacoes || avaliacoes.length === 0) {
        return new Response(JSON.stringify({ pendentes: [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Buscar clientes (query separada)
      const clienteIds = [...new Set(avaliacoes.map((a) => a.cliente_id).filter(Boolean))];
      const clientesMap: Record<string, { nome: string; telefone: string }> = {};

      if (clienteIds.length > 0) {
        const { data: clientes, error: cErr } = await supabase
          .from("clientes")
          .select("id, nome, telefone")
          .in("id", clienteIds);

        if (cErr) throw cErr;

        for (const c of clientes ?? []) {
          clientesMap[c.id] = { nome: c.nome, telefone: c.telefone };
        }
      }

      const pendentes = avaliacoes.map((a) => {
        const cliente = clientesMap[a.cliente_id] || { nome: "Cliente", telefone: "" };
        return {
          avaliacao_id: a.id,
          cliente_nome: cliente.nome,
          cliente_telefone: cliente.telefone,
          respondido_em: a.respondido_em,
        };
      });

      return new Response(JSON.stringify({ pendentes }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "marcar_enviados") {
      const { ids } = body;

      if (!Array.isArray(ids)) {
        return new Response(JSON.stringify({ error: "ids must be an array" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (ids.length === 0) {
        return new Response(JSON.stringify({ atualizados: 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("avaliacoes")
        .update({ upsell_enviado_em: new Date().toISOString() })
        .in("id", ids)
        .select("id");

      if (error) throw error;

      return new Response(JSON.stringify({ atualizados: data?.length ?? 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
