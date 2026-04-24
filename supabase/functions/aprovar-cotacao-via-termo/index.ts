import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Buscar termo
    const { data: termo, error: termoErr } = await supabase
      .from("termos_aceite")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (termoErr || !termo) {
      return new Response(JSON.stringify({ error: "Termo não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (termo.status !== "aceito") {
      return new Response(
        JSON.stringify({ error: "Termo ainda não foi aceito" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Buscar cotação
    const { data: cotacao, error: cotErr } = await supabase
      .from("cotacoes")
      .select("*")
      .eq("id", termo.cotacao_id)
      .maybeSingle();

    if (cotErr || !cotacao) {
      return new Response(JSON.stringify({ error: "Cotação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotência
    if (cotacao.status === "aprovada") {
      return new Response(
        JSON.stringify({ sucesso: true, ja_aprovada: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Determinar cobertura nova
    const novaCobertura =
      termo.modalidade_escolhida === "completa" ? "total" : "parcial";

    // 4. Buscar preço (se tiver dados da calculadora)
    let updatePayload: Record<string, unknown> = {
      status: "aprovada",
      tv_cobertura: novaCobertura,
    };

    if (cotacao.tv_tamanho && cotacao.tv_parede) {
      const { data: preco } = await supabase
        .from("precos_instalacao_tv")
        .select("*")
        .eq("empresa_id", cotacao.empresa_id)
        .eq("tamanho_tv", cotacao.tv_tamanho)
        .eq("tipo_parede", cotacao.tv_parede)
        .eq("cobertura", novaCobertura)
        .maybeSingle();

      if (preco && preco.disponivel && preco.valor_mao_obra != null) {
        updatePayload.valor_estimado = preco.valor_mao_obra;
        updatePayload.valor_material = preco.valor_parafusos ?? 0;

        if (preco.tipo_suporte === "incluso") {
          updatePayload.origem_suporte = "empresa";
          updatePayload.custo_suporte = 0;
        } else if (preco.tipo_suporte === "valor") {
          updatePayload.origem_suporte = "empresa";
          updatePayload.custo_suporte = preco.valor_suporte ?? 0;
        } else {
          updatePayload.origem_suporte = "instalador";
          updatePayload.custo_suporte = 0;
        }
      } else {
        // Sem preço cadastrado: usa valor escolhido no termo como fallback
        const valor =
          termo.modalidade_escolhida === "completa"
            ? termo.valor_completa
            : termo.valor_colaborativa;
        if (valor != null) updatePayload.valor_estimado = valor;
      }
    } else {
      // Sem dados de calculadora: usa valor do termo
      const valor =
        termo.modalidade_escolhida === "completa"
          ? termo.valor_completa
          : termo.valor_colaborativa;
      if (valor != null) updatePayload.valor_estimado = valor;
    }

    // 5. Aprovar cotação
    const { error: updErr } = await supabase
      .from("cotacoes")
      .update(updatePayload)
      .eq("id", cotacao.id);

    if (updErr) {
      console.error("Erro ao atualizar cotação:", updErr);
      return new Response(
        JSON.stringify({ error: "Erro ao aprovar cotação", details: updErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ sucesso: true, cotacao_id: cotacao.id, cobertura: novaCobertura }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Erro inesperado:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
