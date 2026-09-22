// supabase/functions/montar-cascata/index.ts
//
// Monta a fila de avisos de serviço novo, na ordem do ranking.
// Chamada pelo N8N (cron) sem body, ou com { servico_id } para um serviço só.
//
// Ordem: quem tem prioridade_topo (sócia) primeiro, depois o ranking.
// Tempos: topo em 0, o seguinte em +2 min, 3ª->4ª posição em +2 min,
// demais intervalos em +5 min (0, 2, 7, 9, 14...).
// Serviço que já tem fila é ignorado (não remonta).
// Só monta fila para serviço que ENTROU em disponivel há até
// JANELA_DISPONIVEL_MIN minutos (disponivel_em, preenchido por trigger
// só na transição — não em qualquer edição). Serviço com disponivel_em
// nulo (nunca passou pela transição desde que a coluna existe) nunca
// é tratado como recente e é sempre ignorado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STATUS_DISPONIVEL = "disponivel";
const JANELA_DISPONIVEL_MIN = 15;       // só monta fila p/ serviço recém-liberado
const INTERVALO_TOPO_MIN = 2;           // do topo para o próximo
const INTERVALO_MIN = 5;                // entre os demais
const INTERVALO_3_PARA_4_MIN = 2;       // da 3ª para a 4ª posição
const TELEFONES_IGNORADOS = ["11999999999"]; // usuário de teste

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-webhook-token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Autenticação simples por segredo compartilhado com o N8N
  // (mesmo padrão de fila-upsell, listar-servicos-do-dia e criar-cotacao-whatsapp)
  const token = req.headers.get("x-webhook-token");
  const expectedToken = Deno.env.get("WEBHOOK_SECRET");
  if (!token || token !== expectedToken) {
    return json({ erro: "nao_autorizado" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let servicoId: string | null = null;
  try {
    const body = await req.json();
    servicoId = body?.servico_id ?? null;
  } catch {
    // sem body = varre todos os disponíveis
  }

  // 1) Serviços que precisam de fila: disponivel E recém-liberado.
  //    disponivel_em nulo NUNCA conta como recente (.not is null exclui
  //    explicitamente em vez de deixar isso implícito no gte).
  const limiteJanela = new Date(Date.now() - JANELA_DISPONIVEL_MIN * 60_000).toISOString();
  let q = supabase
    .from("servicos")
    .select("id, empresa_id")
    .eq("status", STATUS_DISPONIVEL)
    .not("disponivel_em", "is", null)
    .gte("disponivel_em", limiteJanela);
  if (servicoId) q = q.eq("id", servicoId);

  const { data: servicos, error: erroServicos } = await q;
  if (erroServicos) return json({ erro: erroServicos.message }, 500);
  if (!servicos?.length) return json({ montados: 0, motivo: "nenhum_servico" });

  // 2) Ignora os que já têm fila
  const { data: jaTem, error: erroJa } = await supabase
    .from("cascata_notificacoes")
    .select("servico_id")
    .in("servico_id", servicos.map((s) => s.id));
  if (erroJa) return json({ erro: erroJa.message }, 500);

  const comFila = new Set((jaTem ?? []).map((r) => r.servico_id));
  const pendentes = servicos.filter((s) => !comFila.has(s.id));
  if (!pendentes.length) return json({ montados: 0, motivo: "todos_ja_tem_fila" });

  const resultado: Array<Record<string, unknown>> = [];

  for (const servico of pendentes) {
    // 3) Ranking da empresa do serviço
    const { data: ranking, error: erroRanking } = await supabase
      .rpc("ranking_instaladores", { p_empresa_id: servico.empresa_id });
    if (erroRanking) {
      resultado.push({ servico_id: servico.id, erro: erroRanking.message });
      continue;
    }

    // 4) Telefones (a fila só inclui quem dá para avisar)
    const ids = (ranking ?? []).map((r: any) => r.instalador_id);
    const { data: contatos } = await supabase
      .from("usuarios")
      .select("id, telefone")
      .in("id", ids);

    const telefonePorId = new Map(
      (contatos ?? []).map((c: any) => [c.id, (c.telefone ?? "").replace(/\D/g, "")]),
    );

    // 4b) Quem sempre recebe primeiro, fora do ranking
    const { data: topos } = await supabase
      .from("instaladores")
      .select("id")
      .eq("prioridade_topo", true);
    const idsTopo = new Set((topos ?? []).map((t: any) => t.id));

    const fila = (ranking ?? [])
      .filter((r: any) => {
        const tel = telefonePorId.get(r.instalador_id);
        return tel && tel.length >= 10 && !TELEFONES_IGNORADOS.includes(tel);
      })
      .sort((a: any, b: any) => {
        const topoA = idsTopo.has(a.instalador_id) ? 0 : 1;
        const topoB = idsTopo.has(b.instalador_id) ? 0 : 1;
        return topoA !== topoB ? topoA - topoB : a.posicao - b.posicao;
      });

    if (!fila.length) {
      resultado.push({ servico_id: servico.id, erro: "nenhum_instalador_avisavel" });
      continue;
    }

    // 5) Agenda: topo em 0, próximo em +2 min, 3ª->4ª em +2 min,
    //    demais de 5 em 5 (0, 2, 7, 9, 14...). Sem ninguém no topo,
    //    vira 0, 5, 10, 12, 17...
    const agora = Date.now();
    const temTopo = idsTopo.has(fila[0].instalador_id);
    const atraso = (i: number) => {
      let total = 0;
      for (let pos = 1; pos <= i; pos++) {
        if (pos === 1) total += temTopo ? INTERVALO_TOPO_MIN : INTERVALO_MIN;
        else if (pos === 3) total += INTERVALO_3_PARA_4_MIN;
        else total += INTERVALO_MIN;
      }
      return total;
    };
    const linhas = fila.map((r: any, i: number) => ({
      empresa_id: servico.empresa_id,
      servico_id: servico.id,
      instalador_id: r.instalador_id,
      posicao: i + 1,
      pontuacao: Math.round(Number(r.indice ?? 0)),
      agendado_para: new Date(agora + atraso(i) * 60_000).toISOString(),
      status: "agendado",
    }));

    const { error: erroInsert } = await supabase
      .from("cascata_notificacoes")
      .insert(linhas);

    resultado.push(
      erroInsert
        ? { servico_id: servico.id, erro: erroInsert.message }
        : { servico_id: servico.id, instaladores: linhas.length, primeiro: fila[0].nome },
    );
  }

  return json({ montados: resultado.filter((r) => !r.erro).length, resultado });
});
