/**
 * Orquestra a conciliação de um extrato OFX: busca os recibos pendentes reais no Supabase,
 * roda o matching (ver extrato-matching.ts) e persiste o resultado — dá baixa automática
 * nos casos inequívocos e registra os ambíguos numa fila de revisão (tabela
 * extrato_conciliacao). Cada transação do extrato só é processada uma vez (idempotência
 * via FITID), então reenviar o mesmo arquivo ou um período sobreposto não duplica nada.
 */
import { format } from 'date-fns'
import { supabase } from '@/integrations/supabase/client'
import { parseOFX, filtrarCreditos } from './ofx-parser'
import { conciliarExtrato, type ReciboPendente, type ResultadoMatch } from './extrato-matching'

export interface ResumoConciliacao {
  totalTransacoesCredito: number
  jaProcessadas: number
  automaticos: number
  revisao: number
  semCorrespondencia: number
  erros: string[]
  resultados: ResultadoMatch[]
}

/**
 * @param dryRun Quando true, faz todo o matching mas não grava nada no banco (nem baixa,
 * nem lançamento no caixa, nem registro na fila de revisão) — só retorna o resumo pra
 * conferência. Útil pra validar um extrato antes de aplicar de verdade.
 */
export async function processarExtratoOFX(
  empresaId: string,
  conteudoOFX: string,
  dryRun: boolean = false
): Promise<ResumoConciliacao> {
  const transacoes = parseOFX(conteudoOFX)
  const creditos = filtrarCreditos(transacoes)

  if (creditos.length === 0) {
    return {
      totalTransacoesCredito: 0,
      jaProcessadas: 0,
      automaticos: 0,
      revisao: 0,
      semCorrespondencia: 0,
      erros: [],
      resultados: []
    }
  }

  // Não reprocessa transação que já apareceu num extrato importado antes.
  const fitidsDoArquivo = creditos.map(t => t.fitid)
  const { data: jaProcessadas } = await supabase
    .from('extrato_conciliacao')
    .select('fitid')
    .eq('empresa_id', empresaId)
    .in('fitid', fitidsDoArquivo)

  const fitidsJaProcessados = new Set((jaProcessadas || []).map((r: { fitid: string }) => r.fitid))
  const creditosNovos = creditos.filter(t => !fitidsJaProcessados.has(t.fitid))

  const recibosPendentes = await buscarRecibosPendentes(empresaId)
  const { candidatos: candidatosFaltantes, detalhesPorId: faltantesPorId } = await buscarRecibosFaltantes(empresaId)
  const resultados = conciliarExtrato(creditosNovos, [...recibosPendentes, ...candidatosFaltantes])

  let automaticos = 0
  let revisao = 0
  let semCorrespondencia = 0
  const erros: string[] = []

  for (const resultado of resultados) {
    try {
      if (resultado.tipo === 'automatico') {
        if (!dryRun) {
          if (resultado.recibo.id.startsWith('faltante:')) {
            const faltante = faltantesPorId.get(resultado.recibo.id)
            if (!faltante) throw new Error('Esse recibo ainda não existia na hora de casar, mas sumiu da lista de faltantes — provavelmente já foi gerado por outro caminho nesse meio tempo')
            const reciboId = await criarReciboJaPago(empresaId, resultado.transacao, faltante)
            await registrarConciliacao(empresaId, resultado.transacao, 'automatico', { recibo_id: reciboId })
          } else {
            await aplicarBaixaAutomatica(empresaId, resultado)
          }
        }
        automaticos++
      } else if (resultado.tipo === 'revisao') {
        if (!dryRun) {
          await registrarConciliacao(empresaId, resultado.transacao, 'revisao', {
            candidatos_recibo_ids: resultado.candidatos.map(c => c.id),
            status_revisao: 'pendente'
          })
        }
        revisao++
      } else {
        if (!dryRun) await registrarConciliacao(empresaId, resultado.transacao, 'sem_correspondencia')
        semCorrespondencia++
      }
    } catch (error) {
      console.error('Erro ao processar transação do extrato:', resultado.transacao.fitid, error)
      erros.push(`Transação ${resultado.transacao.fitid} (R$ ${resultado.transacao.valor.toFixed(2)}, ${resultado.transacao.nome}): ${(error as Error).message}`)
    }
  }

  return {
    totalTransacoesCredito: creditos.length,
    jaProcessadas: fitidsJaProcessados.size,
    automaticos,
    revisao,
    semCorrespondencia,
    erros,
    resultados
  }
}

async function buscarRecibosPendentes(empresaId: string): Promise<ReciboPendente[]> {
  const { data: recibosRaw, error } = await supabase
    .from('recibos_diarios')
    .select('id, instalador_id, data_referencia, valor_mao_obra, valor_reembolso, valor_recebido_cliente')
    .eq('empresa_id', empresaId)
    .eq('status_pagamento', 'pendente')

  if (error) throw error

  const instaladorIds = Array.from(new Set((recibosRaw || []).map((r: any) => r.instalador_id)))
  const { data: instaladores } = instaladorIds.length > 0
    ? await supabase.from('usuarios').select('id, nome').in('id', instaladorIds)
    : { data: [] as { id: string; nome: string }[] }
  const nomesPorId = new Map((instaladores || []).map((i: any) => [i.id, i.nome]))

  return (recibosRaw || [])
    .map((r: any) => {
      // Mesma conta que PagamentosInstaladores.tsx: negativo = instalador deve devolver.
      const saldo = Number(r.valor_mao_obra) + Number(r.valor_reembolso) - Number(r.valor_recebido_cliente || 0)
      return {
        id: r.id,
        instalador_id: r.instalador_id,
        instalador_nome: nomesPorId.get(r.instalador_id) || '',
        data_referencia: r.data_referencia,
        valor_a_pagar: saldo < 0 ? Math.abs(saldo) : 0
      }
    })
    .filter((r: ReciboPendente) => r.valor_a_pagar > 0)
}

export interface ReciboFaltanteCandidato {
  /** faltante:<instalador_id>:<data_referencia> */
  id: string
  instalador_id: string
  instalador_nome: string
  data_referencia: string
  servicos_ids: string[]
  valor_mao_obra: number
  valor_reembolso: number
  valor_recebido_cliente: number
  quantidade_servicos: number
}

/**
 * Serviços concluídos há até 90 dias, de um dia+instalador que ainda não tem recibo_diario
 * nenhum (mesma detecção que a caixa "Recibos Não Gerados" em PagamentosInstaladores.tsx).
 * Servem como candidato de conciliação: se um crédito do extrato bater com um desses, o
 * recibo é criado JÁ como pago (ver criarReciboJaPago), sem passar por 'pendente'.
 */
async function buscarRecibosFaltantes(empresaId: string): Promise<{
  candidatos: ReciboPendente[]
  detalhesPorId: Map<string, ReciboFaltanteCandidato>
}> {
  const noventaDiasAtras = new Date()
  noventaDiasAtras.setDate(noventaDiasAtras.getDate() - 90)
  const dataLimite = format(noventaDiasAtras, "yyyy-MM-dd'T'HH:mm:ss")

  const [recibosRes, servicosRes] = await Promise.all([
    supabase.from('recibos_diarios').select('instalador_id, data_referencia').eq('empresa_id', empresaId),
    supabase
      .from('servicos')
      .select('id, instalador_id, data_conclusao, valor_mao_obra_instalador, valor_reembolso_despesas, ganho_acessorios_instalador, valor_recebido_cliente')
      .eq('empresa_id', empresaId)
      .eq('status', 'concluido')
      .not('data_conclusao', 'is', null)
      .not('instalador_id', 'is', null)
      .gte('data_conclusao', dataLimite)
  ])
  if (recibosRes.error) throw recibosRes.error
  if (servicosRes.error) throw servicosRes.error

  // Dia+instalador que já tem QUALQUER recibo (pendente, pago...) não é "faltante".
  const recibosExistentesSet = new Set(
    (recibosRes.data || []).map((r: any) => `${r.instalador_id}|${r.data_referencia}`)
  )

  const grupos = new Map<string, ReciboFaltanteCandidato>()
  for (const s of servicosRes.data || []) {
    if (!s.instalador_id || !s.data_conclusao) continue

    // Fuso Brasília (-3h), mesma conversão que PagamentosInstaladores.tsx usa.
    const dtBrasilia = new Date(new Date(s.data_conclusao).getTime() - 3 * 60 * 60 * 1000)
    const dataRef = dtBrasilia.toISOString().slice(0, 10)

    if (recibosExistentesSet.has(`${s.instalador_id}|${dataRef}`)) continue

    const id = `faltante:${s.instalador_id}:${dataRef}`
    if (!grupos.has(id)) {
      grupos.set(id, {
        id,
        instalador_id: s.instalador_id,
        instalador_nome: '',
        data_referencia: dataRef,
        servicos_ids: [],
        valor_mao_obra: 0,
        valor_reembolso: 0,
        valor_recebido_cliente: 0,
        quantidade_servicos: 0
      })
    }
    const grupo = grupos.get(id)!
    grupo.servicos_ids.push(s.id)
    grupo.valor_mao_obra += Number(s.valor_mao_obra_instalador || 0)
    // Fatia do instalador: reembolso de despesas + ganho em acessórios vendidos.
    grupo.valor_reembolso += Number(s.valor_reembolso_despesas || 0) + Number(s.ganho_acessorios_instalador || 0)
    grupo.valor_recebido_cliente += Number(s.valor_recebido_cliente || 0)
    grupo.quantidade_servicos++
  }

  const instaladorIds = Array.from(new Set(Array.from(grupos.values()).map(g => g.instalador_id)))
  const { data: instaladores } = instaladorIds.length > 0
    ? await supabase.from('usuarios').select('id, nome').in('id', instaladorIds)
    : { data: [] as { id: string; nome: string }[] }
  const nomesPorId = new Map<string, string>((instaladores || []).map((i: any) => [i.id, i.nome] as [string, string]))
  for (const g of grupos.values()) g.instalador_nome = nomesPorId.get(g.instalador_id) || ''

  const candidatos: ReciboPendente[] = Array.from(grupos.values())
    .map(g => {
      const saldo = g.valor_mao_obra + g.valor_reembolso - g.valor_recebido_cliente
      return {
        id: g.id,
        instalador_id: g.instalador_id,
        instalador_nome: g.instalador_nome,
        data_referencia: g.data_referencia,
        valor_a_pagar: saldo < 0 ? Math.abs(saldo) : 0
      }
    })
    .filter(c => c.valor_a_pagar > 0)

  return { candidatos, detalhesPorId: grupos }
}

/** Cria o recibo_diario JÁ como pago (pula o estado 'pendente') e lança a receita no caixa. Retorna o id criado. */
async function criarReciboJaPago(
  empresaId: string,
  transacao: { fitid: string; data: string; valor: number },
  faltante: ReciboFaltanteCandidato
): Promise<string> {
  const valorTotal = faltante.valor_mao_obra + faltante.valor_reembolso

  const { data: novoRecibo, error: erroInsert } = await supabase
    .from('recibos_diarios')
    .insert({
      empresa_id: empresaId,
      instalador_id: faltante.instalador_id,
      data_referencia: faltante.data_referencia,
      valor_mao_obra: faltante.valor_mao_obra,
      valor_reembolso: faltante.valor_reembolso,
      valor_total: valorTotal,
      quantidade_servicos: faltante.quantidade_servicos,
      servicos_ids: faltante.servicos_ids,
      valor_recebido_cliente: faltante.valor_recebido_cliente,
      status_pagamento: 'pago',
      data_pagamento: transacao.data,
      extrato_fitid: transacao.fitid
    })
    .select('id')
    .single()
  if (erroInsert) throw erroInsert

  const dataReferenciaFormatada = format(new Date(faltante.data_referencia + 'T12:00:00'), 'dd/MM/yyyy')

  const { error: erroCaixa } = await supabase.from('lancamentos_caixa').insert({
    empresa_id: empresaId,
    tipo: 'receita',
    categoria: 'Recebimento Instalador',
    descricao: `Recebimento de ${faltante.instalador_nome} - ${dataReferenciaFormatada} (extrato bancário — recibo gerado automaticamente)`,
    valor: transacao.valor,
    data_lancamento: transacao.data,
    forma_pagamento: 'PIX'
  })
  if (erroCaixa) throw erroCaixa

  return novoRecibo.id
}

/** Efeito colateral em si da baixa: atualiza o recibo e lança a receita no caixa. Não mexe em extrato_conciliacao. */
async function darBaixaNoRecibo(
  empresaId: string,
  transacao: { fitid: string; data: string; valor: number },
  recibo: { id: string; instalador_nome: string; data_referencia: string }
) {
  const { error: erroUpdate } = await supabase
    .from('recibos_diarios')
    .update({
      status_pagamento: 'pago',
      data_pagamento: transacao.data,
      extrato_fitid: transacao.fitid
    })
    .eq('id', recibo.id)
  if (erroUpdate) throw erroUpdate

  const dataReferenciaFormatada = format(new Date(recibo.data_referencia + 'T12:00:00'), 'dd/MM/yyyy')

  const { error: erroCaixa } = await supabase.from('lancamentos_caixa').insert({
    empresa_id: empresaId,
    tipo: 'receita',
    categoria: 'Recebimento Instalador',
    descricao: `Recebimento de ${recibo.instalador_nome} - ${dataReferenciaFormatada} (extrato bancário)`,
    valor: transacao.valor,
    data_lancamento: transacao.data,
    forma_pagamento: 'PIX'
  })
  if (erroCaixa) throw erroCaixa
}

async function aplicarBaixaAutomatica(empresaId: string, match: Extract<ResultadoMatch, { tipo: 'automatico' }>) {
  const { transacao, recibo } = match
  await darBaixaNoRecibo(empresaId, transacao, recibo)
  await registrarConciliacao(empresaId, transacao, 'automatico', { recibo_id: recibo.id })
}

async function registrarConciliacao(
  empresaId: string,
  transacao: ResultadoMatch['transacao'],
  resultado: 'automatico' | 'revisao' | 'sem_correspondencia',
  extra: Record<string, unknown> = {}
) {
  const { error } = await supabase.from('extrato_conciliacao').insert({
    empresa_id: empresaId,
    fitid: transacao.fitid,
    data_transacao: transacao.data,
    valor: transacao.valor,
    nome_remetente: transacao.nome,
    resultado,
    ...extra
  })
  if (error) throw error
}

export interface ItemFilaRevisao {
  id: string
  fitid: string
  data_transacao: string
  valor: number
  nome_remetente: string
  candidatos: {
    id: string
    instalador_nome: string
    data_referencia: string
    valor_a_pagar: number
    /** true = recibo ainda não existe; confirmar essa opção cria e já marca como pago. */
    seraGerado: boolean
  }[]
}

/** Busca os itens pendentes de revisão (resultado='revisao' e status_revisao='pendente') com os dados dos recibos candidatos. */
export async function buscarFilaRevisao(empresaId: string): Promise<ItemFilaRevisao[]> {
  const { data: itens, error } = await supabase
    .from('extrato_conciliacao')
    .select('id, fitid, data_transacao, valor, nome_remetente, candidatos_recibo_ids')
    .eq('empresa_id', empresaId)
    .eq('resultado', 'revisao')
    .eq('status_revisao', 'pendente')
    .order('data_transacao', { ascending: false })
  if (error) throw error
  if (!itens || itens.length === 0) return []

  const todosCandidatoIds = Array.from(new Set(itens.flatMap((i: any) => i.candidatos_recibo_ids || []))) as string[]
  const idsReais = todosCandidatoIds.filter(id => !id.startsWith('faltante:'))
  const temCandidatoFaltante = todosCandidatoIds.some(id => id.startsWith('faltante:'))

  const { data: recibos } = idsReais.length > 0
    ? await supabase
        .from('recibos_diarios')
        .select('id, instalador_id, data_referencia, valor_mao_obra, valor_reembolso, valor_recebido_cliente')
        .in('id', idsReais)
    : { data: [] as any[] }

  const instaladorIds = Array.from(new Set((recibos || []).map((r: any) => r.instalador_id)))
  const { data: instaladores } = instaladorIds.length > 0
    ? await supabase.from('usuarios').select('id, nome').in('id', instaladorIds)
    : { data: [] as { id: string; nome: string }[] }
  const nomesPorId = new Map((instaladores || []).map((i: any) => [i.id, i.nome]))

  const recibosPorId = new Map(
    (recibos || []).map((r: any) => {
      const saldo = Number(r.valor_mao_obra) + Number(r.valor_reembolso) - Number(r.valor_recebido_cliente || 0)
      return [
        r.id,
        {
          id: r.id,
          instalador_nome: nomesPorId.get(r.instalador_id) || '',
          data_referencia: r.data_referencia,
          valor_a_pagar: saldo < 0 ? Math.abs(saldo) : 0,
          seraGerado: false
        }
      ]
    })
  )

  // Recibos faltantes são recalculados na hora (não existe registro fixo pra guardar) — se um
  // candidato já foi gerado por outro caminho nesse meio tempo, ele simplesmente não aparece mais.
  const { detalhesPorId: faltantesPorId } = temCandidatoFaltante
    ? await buscarRecibosFaltantes(empresaId)
    : { detalhesPorId: new Map<string, ReciboFaltanteCandidato>() }

  const candidatoPorId = (id: string) => {
    if (id.startsWith('faltante:')) {
      const f = faltantesPorId.get(id)
      if (!f) return null
      const saldo = f.valor_mao_obra + f.valor_reembolso - f.valor_recebido_cliente
      return {
        id: f.id,
        instalador_nome: f.instalador_nome,
        data_referencia: f.data_referencia,
        valor_a_pagar: saldo < 0 ? Math.abs(saldo) : 0,
        seraGerado: true
      }
    }
    return recibosPorId.get(id) || null
  }

  return itens.map((item: any) => ({
    id: item.id,
    fitid: item.fitid,
    data_transacao: item.data_transacao,
    valor: Number(item.valor),
    nome_remetente: item.nome_remetente,
    candidatos: (item.candidatos_recibo_ids || []).map((id: string) => candidatoPorId(id)).filter(Boolean)
  }))
}

/** Admin escolheu, entre os candidatos, qual recibo essa transação da fila de revisão paga. */
export async function confirmarRevisao(empresaId: string, itemConciliacaoId: string, candidatoId: string): Promise<void> {
  const { data: item, error: erroItem } = await supabase
    .from('extrato_conciliacao')
    .select('fitid, data_transacao, valor')
    .eq('id', itemConciliacaoId)
    .single()
  if (erroItem) throw erroItem
  if (!item) throw new Error('Item de conciliação não encontrado')

  const transacao = { fitid: item.fitid, data: item.data_transacao, valor: Number(item.valor) }
  let reciboId: string

  if (candidatoId.startsWith('faltante:')) {
    const { detalhesPorId } = await buscarRecibosFaltantes(empresaId)
    const faltante = detalhesPorId.get(candidatoId)
    if (!faltante) {
      throw new Error('Esse recibo não existe mais pra gerar (provavelmente já foi criado por outro caminho) — atualize a página')
    }
    reciboId = await criarReciboJaPago(empresaId, transacao, faltante)
  } else {
    const { data: recibo, error: erroRecibo } = await supabase
      .from('recibos_diarios')
      .select('id, instalador_id, data_referencia')
      .eq('id', candidatoId)
      .single()
    if (erroRecibo) throw erroRecibo

    const { data: instalador } = await supabase.from('usuarios').select('nome').eq('id', recibo.instalador_id).single()

    await darBaixaNoRecibo(
      empresaId,
      transacao,
      { id: recibo.id, instalador_nome: instalador?.nome || '', data_referencia: recibo.data_referencia }
    )
    reciboId = recibo.id
  }

  const { error: erroUpdate } = await supabase
    .from('extrato_conciliacao')
    .update({ status_revisao: 'confirmado', recibo_id: reciboId })
    .eq('id', itemConciliacaoId)
  if (erroUpdate) throw erroUpdate
}

/** Admin decidiu que nenhum candidato é o certo — não faz baixa nenhuma, só tira da fila. */
export async function ignorarRevisao(itemConciliacaoId: string): Promise<void> {
  const { error } = await supabase
    .from('extrato_conciliacao')
    .update({ status_revisao: 'ignorado' })
    .eq('id', itemConciliacaoId)
  if (error) throw error
}
