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

    // 4. Calcular preço
    let updatePayload: Record<string, unknown> = {
      status: "aprovada",
      tv_cobertura: novaCobertura,
    };

    // Helper: busca preço p/ um item
    const buscarPreco = async (tamanho: string, parede: string) => {
      const { data } = await supabase
        .from("precos_instalacao_tv")
        .select("*")
        .eq("empresa_id", cotacao.empresa_id)
        .eq("tamanho_tv", tamanho)
        .eq("tipo_parede", parede)
        .eq("cobertura", novaCobertura)
        .maybeSingle();
      return data;
    };

    const itens: any[] = Array.isArray(cotacao.tvs_itens) && cotacao.tvs_itens.length > 0
      ? cotacao.tvs_itens
      : (cotacao.tv_tamanho && cotacao.tv_parede
          ? [{ tamanho: cotacao.tv_tamanho, parede: cotacao.tv_parede }]
          : []);

    if (itens.length > 0) {
      let totalMaoObra = 0;
      let totalMaterial = 0;
      let totalSuporte = 0;
      let origemSuporteAgregada: "empresa" | "instalador" = "instalador";
      const itensAtualizados: any[] = [];
      let algumSemPreco = false;

      for (const item of itens) {
        const preco = await buscarPreco(item.tamanho, item.parede);
        if (preco && preco.disponivel && preco.valor_mao_obra != null) {
          const mo = Number(preco.valor_mao_obra) || 0;
          const mat = Number(preco.valor_parafusos ?? 0) || 0;
          let origem: "empresa" | "instalador" = "instalador";
          let custoSup = 0;
          if (preco.tipo_suporte === "incluso") {
            origem = "empresa";
            custoSup = 0;
          } else if (preco.tipo_suporte === "valor") {
            origem = "empresa";
            custoSup = Number(preco.valor_suporte ?? 0) || 0;
          } else {
            origem = "instalador";
            custoSup = 0;
          }
          totalMaoObra += mo;
          totalMaterial += mat;
          totalSuporte += custoSup;
          if (origem === "empresa") origemSuporteAgregada = "empresa";
          itensAtualizados.push({
            ...item,
            cobertura: novaCobertura,
            valor_mao_obra: mo,
            valor_material: mat,
            origem_suporte: origem,
            custo_suporte: custoSup,
          });
        } else {
          algumSemPreco = true;
          itensAtualizados.push({ ...item, cobertura: novaCobertura });
        }
      }

      if (!algumSemPreco) {
        updatePayload.valor_estimado = totalMaoObra;
        updatePayload.valor_material = totalMaterial;
        updatePayload.origem_suporte = origemSuporteAgregada;
        updatePayload.custo_suporte = totalSuporte;
      } else {
        // Fallback: usa valor do termo
        const valor =
          termo.modalidade_escolhida === "completa"
            ? termo.valor_completa
            : termo.valor_colaborativa;
        if (valor != null) updatePayload.valor_estimado = valor;
      }

      if (Array.isArray(cotacao.tvs_itens) && cotacao.tvs_itens.length > 0) {
        updatePayload.tvs_itens = itensAtualizados;
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
