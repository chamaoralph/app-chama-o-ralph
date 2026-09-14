/**
 * Parser de extrato bancário no formato OFX (Open Financial Exchange).
 *
 * OFX é SGML/XML — os bancos brasileiros normalmente exportam a variante SGML (OFX 1.x),
 * onde tags de folha (ex: <FITID>, <TRNAMT>) não têm fechamento. Por isso o parser usa
 * regex tolerante a isso, em vez de um parser XML tradicional.
 */

export interface TransacaoExtrato {
  /** ID único da transação dentro do extrato (FITID) — usado pra evitar reprocessar a mesma linha duas vezes. */
  fitid: string
  /** yyyy-MM-dd */
  data: string
  /** Sempre positivo — o sinal já foi resolvido em `tipo`. */
  valor: number
  tipo: 'credito' | 'debito'
  /** Nome do remetente/histórico da transação, como veio no extrato (NAME, com MEMO como fallback). */
  nome: string
}

function getTag(bloco: string, tag: string): string | null {
  // Aceita tanto <TAG>valor</TAG> (OFX 2.x/XML) quanto <TAG>valor (OFX 1.x/SGML, sem fechamento) —
  // por isso corta no próximo '<' ou fim de linha, o que vier primeiro.
  const match = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))
  return match ? match[1].trim() : null
}

function formatarData(dtposted: string): string {
  // DTPOSTED vem como YYYYMMDDHHMMSS[.XXX][gmt offset] — só os 8 primeiros dígitos interessam.
  const digitos = dtposted.replace(/[^0-9]/g, '').slice(0, 8)
  if (digitos.length < 8) return ''
  return `${digitos.slice(0, 4)}-${digitos.slice(4, 6)}-${digitos.slice(6, 8)}`
}

/** Extrai todas as transações (créditos e débitos) de um arquivo OFX. */
export function parseOFX(conteudo: string): TransacaoExtrato[] {
  const blocos = conteudo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || []
  const transacoes: TransacaoExtrato[] = []

  for (const bloco of blocos) {
    const fitid = getTag(bloco, 'FITID')
    const dtposted = getTag(bloco, 'DTPOSTED')
    const trnamtRaw = getTag(bloco, 'TRNAMT')
    const trntype = getTag(bloco, 'TRNTYPE')
    const name = getTag(bloco, 'NAME')
    const memo = getTag(bloco, 'MEMO')

    // Sem FITID, valor ou data não dá pra conciliar com segurança — pula a linha.
    if (!fitid || !dtposted || !trnamtRaw) continue

    const valorNumerico = parseFloat(trnamtRaw.replace(',', '.'))
    if (isNaN(valorNumerico)) continue

    const tipo: 'credito' | 'debito' =
      trntype?.toUpperCase().includes('DEBIT') || valorNumerico < 0 ? 'debito' : 'credito'

    transacoes.push({
      fitid,
      data: formatarData(dtposted),
      valor: Math.abs(valorNumerico),
      tipo,
      nome: (name || memo || '').trim()
    })
  }

  return transacoes
}

/** Só os créditos (dinheiro entrando) — é o que interessa pra conciliar devoluções dos instaladores. */
export function filtrarCreditos(transacoes: TransacaoExtrato[]): TransacaoExtrato[] {
  return transacoes.filter(t => t.tipo === 'credito')
}
