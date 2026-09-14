/**
 * Casa transações de crédito de um extrato bancário (ver ofx-parser.ts) com recibos
 * pendentes de devolução (instalador → empresa) em recibos_diarios.
 *
 * Só entra como baixa automática quando não há dúvida (valor exato + nome com alta
 * similaridade + candidato único). Qualquer ambiguidade vai pra fila de revisão manual —
 * decisão tomada em conjunto com o usuário: confirmação com 1 clique em vez de baixa cega.
 */
import type { TransacaoExtrato } from './ofx-parser'

export interface ReciboPendente {
  id: string
  instalador_id: string
  instalador_nome: string
  /** yyyy-MM-dd */
  data_referencia: string
  /** Quanto o instalador deve devolver pra empresa (sempre positivo). */
  valor_a_pagar: number
}

export interface MatchAutomatico {
  tipo: 'automatico'
  transacao: TransacaoExtrato
  recibo: ReciboPendente
}

export interface MatchRevisao {
  tipo: 'revisao'
  transacao: TransacaoExtrato
  candidatos: ReciboPendente[]
  motivo: string
}

export interface TransacaoSemCorrespondencia {
  tipo: 'sem_correspondencia'
  transacao: TransacaoExtrato
}

export type ResultadoMatch = MatchAutomatico | MatchRevisao | TransacaoSemCorrespondencia

/** Tolerância de centavos pra cobrir arredondamento. */
const TOLERANCIA_VALOR = 0.01
/** PIX pode cair alguns dias depois da data do recibo (atraso do instalador) — nunca antes. */
const JANELA_DIAS = 5
/** Nome tem que estar bem parecido (~1-2 letras de diferença num nome médio) pra baixa automática. */
const SIMILARIDADE_MINIMA_AUTOMATICA = 0.92
/** Abaixo disso nem entra na fila de revisão — é ruído, não candidato. */
const SIMILARIDADE_MINIMA_REVISAO = 0.6

function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function distanciaLevenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + custo)
    }
  }
  return dp[m][n]
}

/** Similaridade 0-1 entre duas palavras, baseada em Levenshtein normalizada — tolera erro de digitação. */
function similaridadePalavra(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  return 1 - distanciaLevenshtein(a, b) / Math.max(a.length, b.length)
}

/**
 * Similaridade 0-1 entre dois nomes, comparando palavra a palavra em vez da string inteira.
 * Isso importa porque o banco costuma truncar o nome no extrato de PIX (ex: "BRYAN RODRIGUES"
 * em vez de "Bryan Rodrigues do Rosario") — uma comparação de string inteira penalizaria essa
 * diferença de tamanho mesmo sendo claramente a mesma pessoa. Aqui, o nome mais curto "casa"
 * bem quando todas as suas palavras aparecem (com pequena tolerância a erro) no nome maior.
 */
function similaridade(a: string, b: string): number {
  const tokensA = normalizarNome(a).split(' ').filter(Boolean)
  const tokensB = normalizarNome(b).split(' ').filter(Boolean)
  if (tokensA.length === 0 || tokensB.length === 0) return 0

  const [menor, maiorOriginal] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA]
  const maiorRestante = [...maiorOriginal]

  let casados = 0
  for (const token of menor) {
    let melhorIdx = -1
    let melhorSim = 0
    for (let i = 0; i < maiorRestante.length; i++) {
      const sim = similaridadePalavra(token, maiorRestante[i])
      if (sim > melhorSim) {
        melhorSim = sim
        melhorIdx = i
      }
    }
    // >=0.8 numa palavra cobre erro de digitação/abreviação sem deixar passar palavra errada
    if (melhorSim >= 0.8) {
      casados++
      maiorRestante.splice(melhorIdx, 1)
    }
  }

  return casados / menor.length
}

function dentroDaJanela(dataRecibo: string, dataTransacao: string, dias: number): boolean {
  const d1 = new Date(dataRecibo + 'T12:00:00')
  const d2 = new Date(dataTransacao + 'T12:00:00')
  const diffDias = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)
  return diffDias >= 0 && diffDias <= dias
}

export function conciliarExtrato(
  transacoesCredito: TransacaoExtrato[],
  recibosPendentes: ReciboPendente[]
): ResultadoMatch[] {
  const resultados: ResultadoMatch[] = []

  for (const transacao of transacoesCredito) {
    const candidatosPorValor = recibosPendentes.filter(
      r =>
        Math.abs(r.valor_a_pagar - transacao.valor) <= TOLERANCIA_VALOR &&
        dentroDaJanela(r.data_referencia, transacao.data, JANELA_DIAS)
    )

    if (candidatosPorValor.length === 0) {
      resultados.push({ tipo: 'sem_correspondencia', transacao })
      continue
    }

    const candidatosComSimilaridade = candidatosPorValor
      .map(recibo => ({ recibo, similaridade: similaridade(recibo.instalador_nome, transacao.nome) }))
      .filter(c => c.similaridade >= SIMILARIDADE_MINIMA_REVISAO)
      .sort((a, b) => b.similaridade - a.similaridade)

    if (candidatosComSimilaridade.length === 0) {
      resultados.push({ tipo: 'sem_correspondencia', transacao })
      continue
    }

    const melhor = candidatosComSimilaridade[0]
    const empateComOSegundo =
      candidatosComSimilaridade.length > 1 &&
      candidatosComSimilaridade[1].similaridade >= melhor.similaridade - 0.05

    if (melhor.similaridade >= SIMILARIDADE_MINIMA_AUTOMATICA && !empateComOSegundo) {
      resultados.push({ tipo: 'automatico', transacao, recibo: melhor.recibo })
    } else {
      resultados.push({
        tipo: 'revisao',
        transacao,
        candidatos: candidatosComSimilaridade.map(c => c.recibo),
        motivo: empateComOSegundo
          ? 'Mais de um recibo pendente com nome parecido para esse valor'
          : 'Nome do remetente não bate com confiança suficiente'
      })
    }
  }

  return resultados
}
