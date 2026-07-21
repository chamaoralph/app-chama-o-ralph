import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-webhook-token, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = req.headers.get("x-webhook-token");
  const expectedToken = Deno.env.get("WEBHOOK_SECRET");

  if (!token || token !== expectedToken) {
    return new Response(JSON.stringify({ error: "Token inválido" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Data alvo
    let dataAlvo: string;
    try {
      const body = await req.json();
      dataAlvo = body?.data || "";
    } catch {
      dataAlvo = "";
    }

    if (!dataAlvo) {
      const now = new Date();
      const spFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      dataAlvo = spFormatter.format(now);
    }

    const EMPRESA_ID = "a5006ac5-230b-4687-bb88-e49ebc7811a2";

    // 1. Buscar serviços do dia (SEM join - banco não tem FKs)
    const { data: servicos, error: errorServicos } = await supabase
      .from("servicos")
      .select("id, codigo, data_servico_agendada, tipo_servico, endereco_completo, status, valor_total, cliente_id, instalador_id")
      .eq("empresa_id", EMPRESA_ID)
      .gte("data_servico_agendada", `${dataAlvo}T00:00:00-03:00`)
      .lt("data_servico_agendada", `${dataAlvo}T23:59:59-03:00`)
      .in("status", ["atribuido", "em_andamento", "disponivel"])
      .eq("confirmacao_enviada", false)
      .order("data_servico_agendada", { ascending: true });

    if (errorServicos) {
      console.error("Erro ao buscar servicos:", JSON.stringify(errorServicos));
      throw new Error(`Erro ao buscar servicos: ${JSON.stringify(errorServicos)}`);
    }

    if (!servicos || servicos.length === 0) {
      return new Response(
        JSON.stringify({ data: dataAlvo, total: 0, servicos: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Buscar clientes
    const clienteIds = [...new Set(servicos.map((s) => s.cliente_id).filter(Boolean))];
    let clientesMap: Record<string, any> = {};

    if (clienteIds.length > 0) {
      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, nome, telefone, endereco_completo")
        .in("id", clienteIds);

      if (clientes) {
        for (const c of clientes) {
          clientesMap[c.id] = c;
        }
      }
    }

    // 3. Buscar instaladores
    const instaladorIds = [...new Set(servicos.map((s) => s.instalador_id).filter(Boolean))];
    let instaladoresMap: Record<string, any> = {};

    if (instaladorIds.length > 0) {
      const { data: instaladores } = await supabase
        .from("usuarios")
        .select("id, nome, telefone")
        .in("id", instaladorIds);

      if (instaladores) {
        for (const i of instaladores) {
          instaladoresMap[i.id] = i;
        }
      }
    }

    // 4. Montar resultado
    const resultado = servicos.map((s) => {
      const cliente = clientesMap[s.cliente_id] || {};
      const instalador = instaladoresMap[s.instalador_id] || {};

      // Horários no banco são locais SP salvos com offset +00 — extrair direto
      const isoStr = s.data_servico_agendada;
      const horario = isoStr.split("T")[1].substring(0, 5);

      return {
        id: s.id,
        codigo: s.codigo,
        data_servico_agendada: s.data_servico_agendada,
        horario,
        tipo_servico: s.tipo_servico,
        endereco_servico: s.endereco_completo,
        status: s.status,
        valor_total: s.valor_total,
        cliente_nome: cliente.nome || "Cliente",
        cliente_telefone: cliente.telefone || "",
        cliente_endereco: cliente.endereco_completo || "",
        instalador_nome: instalador.nome || "A definir",
        instalador_telefone: instalador.telefone || "",
      };
    });

    // 5. Marcar como enviado
    const ids = resultado.map((s) => s.id);
    const { error: updateError } = await supabase
      .from("servicos")
      .update({
        confirmacao_enviada: true,
        confirmacao_enviada_em: new Date().toISOString(),
      })
      .in("id", ids);

    if (updateError) {
      console.error("Erro ao marcar confirmacao_enviada:", JSON.stringify(updateError));
    }

    return new Response(
      JSON.stringify({ data: dataAlvo, total: resultado.length, servicos: resultado }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("Erro:", errorMsg);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
