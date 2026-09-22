// supabase/functions/fila-cascata/index.ts
//
// Serve a fila da cascata para o N8N (cron a cada 1 min).
// Actions:
//   "proximo"        -> cancela filas de serviços que saíram de 'disponivel'
//                       e devolve 1 envio vencido, com dados para a mensagem
//   "marcar_enviado" -> { id } marca como enviado
//   "marcar_falha"   -> { id, erro } marca como falhou

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STATUS_DISPONIVEL = "disponivel";

// Colunas reais confirmadas em servicos/clientes/cotacoes. "cidade" não
// existe no schema (nem em servicos, clientes ou cotacoes) — não incluída.
// "período" também não existe como campo categórico; o mais próximo é
// cotacoes.horario_inicio/horario_fim (frequentemente vazio).
//
// cotacoes precisa do nome explícito da FK: existem DUAS relações entre
// servicos e cotacoes (servicos.cotacao_id -> cotacoes.id, e também
// cotacoes.servico_origem_id -> servicos.id, da feature de upsell). Sem
// especificar qual usar, o PostgREST rejeita o embed por ambiguidade e
// devolve erro (era isso que fazia a function retornar 500).
const SELECT_SERVICO =
  "id, codigo, status, tipo_servico, endereco_completo, data_servico_agendada, valor_mao_obra_instalador, clientes(bairro), cotacoes!servicos_cotacao_id_fkey(horario_inicio, horario_fim)";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const token = Deno.env.get("WEBHOOK_SECRET");
  if (!token || req.headers.get("x-webhook-token") !== token) {
    return json({ erro: "nao_autorizado" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try { body = await req.json(); } catch { /* sem body */ }
  const action = body?.action ?? "proximo";

  // ---------------- marcar_enviado ----------------
  if (action === "marcar_enviado") {
    if (!body?.id) return json({ erro: "id_obrigatorio" }, 400);
    const { error } = await supabase
      .from("cascata_notificacoes")
      .update({ status: "enviado", enviado_em: new Date().toISOString() })
      .eq("id", body.id)
      .eq("status", "agendado");
    return error ? json({ erro: error.message }, 500) : json({ ok: true });
  }

  // ---------------- marcar_falha ----------------
  if (action === "marcar_falha") {
    if (!body?.id) return json({ erro: "id_obrigatorio" }, 400);
    const { error } = await supabase
      .from("cascata_notificacoes")
      .update({ status: "falhou", cancelado_motivo: String(body?.erro ?? "").slice(0, 300) })
      .eq("id", body.id);
    return error ? json({ erro: error.message }, 500) : json({ ok: true });
  }

  // ---------------- proximo ----------------
  const agora = new Date().toISOString();

  // 1) Quais serviços ainda têm fila agendada?
  const { data: agendados, error: erroAgendados } = await supabase
    .from("cascata_notificacoes")
    .select("id, servico_id, instalador_id, posicao, agendado_para")
    .eq("status", "agendado")
    .order("agendado_para", { ascending: true });
  if (erroAgendados) return json({ erro: erroAgendados.message }, 500);
  if (!agendados?.length) return json({ tem_envio: false, motivo: "fila_vazia" });

  const servicoIds = [...new Set(agendados.map((a) => a.servico_id))];

  const { data: servicos, error: erroServicos } = await supabase
    .from("servicos")
    .select(SELECT_SERVICO)
    .in("id", servicoIds);
  if (erroServicos) return json({ erro: erroServicos.message }, 500);

  const porId = new Map((servicos ?? []).map((s: any) => [s.id, s]));

  // 2) Serviço que saiu de 'disponivel' (alguém pegou ou foi cancelado):
  //    cancela o que resta da fila dele
  const encerrados = servicoIds.filter(
    (id) => porId.get(id)?.status !== STATUS_DISPONIVEL,
  );
  if (encerrados.length) {
    await supabase
      .from("cascata_notificacoes")
      .update({ status: "cancelado", cancelado_motivo: "servico_indisponivel" })
      .in("servico_id", encerrados)
      .eq("status", "agendado");
  }

  // 3) Primeiro envio vencido de um serviço ainda disponível
  const proximo = agendados.find(
    (a) =>
      !encerrados.includes(a.servico_id) &&
      new Date(a.agendado_para).toISOString() <= agora,
  );
  if (!proximo) {
    return json({ tem_envio: false, motivo: "nada_vencido", cancelados: encerrados.length });
  }

  // 4) Dados do instalador
  const { data: instalador, error: erroInstalador } = await supabase
    .from("usuarios")
    .select("id, nome, telefone")
    .eq("id", proximo.instalador_id)
    .single();
  if (erroInstalador || !instalador?.telefone) {
    await supabase
      .from("cascata_notificacoes")
      .update({ status: "falhou", cancelado_motivo: "instalador_sem_telefone" })
      .eq("id", proximo.id);
    return json({ tem_envio: false, motivo: "instalador_sem_telefone" });
  }

  return json({
    tem_envio: true,
    id: proximo.id,
    posicao: proximo.posicao,
    instalador: { id: instalador.id, nome: instalador.nome, telefone: instalador.telefone },
    servico: porId.get(proximo.servico_id),
    cancelados: encerrados.length,
  });
});
