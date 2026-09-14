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
  const resultados = conciliarExtrato(creditosNovos, recibosPendentes)

  let automaticos = 0
  let revisao = 0
  let semCorrespondencia = 0
  const erros: string[] = []

  for (const resultado of resultados) {
    try {
      if (resultado.tipo === 'automatico') {
        if (!dryRun) await aplicarBaixaAutomatica(empresaId, resultado)
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
  candidatos: { id: string; instalador_nome: string; data_referencia: string; valor_a_pagar: number }[]
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

  const todosCandidatoIds = Array.from(new Set(itens.flatMap((i: any) => i.candidatos_recibo_ids || [])))
  const { data: recibos } = todosCandidatoIds.length > 0
    ? await supabase
        .from('recibos_diarios')
        .select('id, instalador_id, data_referencia, valor_mao_obra, valor_reembolso, valor_recebido_cliente')
        .in('id', todosCandidatoIds)
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
          valor_a_pagar: saldo < 0 ? Math.abs(saldo) : 0
        }
      ]
    })
  )

  return itens.map((item: any) => ({
    id: item.id,
    fitid: item.fitid,
    data_transacao: item.data_transacao,
    valor: Number(item.valor),
    nome_remetente: item.nome_remetente,
    candidatos: (item.candidatos_recibo_ids || []).map((id: string) => recibosPorId.get(id)).filter(Boolean)
  }))
}

/** Admin escolheu, entre os candidatos, qual recibo essa transação da fila de revisão paga. */
export async function confirmarRevisao(empresaId: string, itemConciliacaoId: string, reciboId: string): Promise<void> {
  const { data: item, error: erroItem } = await supabase
    .from('extrato_conciliacao')
    .select('fitid, data_transacao, valor')
    .eq('id', itemConciliacaoId)
    .single()
  if (erroItem) throw erroItem
  if (!item) throw new Error('Item de conciliação não encontrado')

  const { data: recibo, error: erroRecibo } = await supabase
    .from('recibos_diarios')
    .select('id, instalador_id, data_referencia')
    .eq('id', reciboId)
    .single()
  if (erroRecibo) throw erroRecibo

  const { data: instalador } = await supabase.from('usuarios').select('nome').eq('id', recibo.instalador_id).single()

  await darBaixaNoRecibo(
    empresaId,
    { fitid: item.fitid, data: item.data_transacao, valor: Number(item.valor) },
    { id: recibo.id, instalador_nome: instalador?.nome || '', data_referencia: recibo.data_referencia }
  )

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
