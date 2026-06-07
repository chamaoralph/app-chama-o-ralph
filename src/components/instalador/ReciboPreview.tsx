import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ServicoRecibo {
  id: string
  codigo: string
  cliente_nome: string
  tipo_servico: string[]
  valor_mao_obra_instalador: number
  valor_reembolso_despesas: number
  custo_suporte: number
  valor_recebido_cliente: number
  recebimento_cliente: string | null
}

interface ReciboPreviewProps {
  instaladorNome: string
  dataReferencia: Date
  servicos: ServicoRecibo[]
}

function calcServico(s: ServicoRecibo) {
  const reembInst = s.valor_reembolso_despesas || 0
  const reembEmp = s.custo_suporte || 0
  const maoObra = s.valor_mao_obra_instalador || 0
  // totalEmp/totalInst são calculados a partir do 50% fixo — independente de quem recebeu
  const totalEmp = maoObra + reembEmp
  const totalInst = maoObra + reembInst
  // recebimento_cliente afeta apenas o saldo final (quem já tem o dinheiro em mãos)
  const recebido = s.valor_recebido_cliente || 0
  const recebInst = s.recebimento_cliente === 'instalador' ? recebido : 0
  const recebEmp = s.recebimento_cliente === 'empresa' ? recebido : 0
  return { reembInst, reembEmp, recebido, recebInst, recebEmp, totalEmp, totalInst }
}

const fmt = (v: number) => `R$ ${v.toFixed(2)}`

export function ReciboPreview({ instaladorNome, dataReferencia, servicos }: ReciboPreviewProps) {
  const calcs = servicos.map(s => ({ s, ...calcServico(s) }))

  const totals = calcs.reduce(
    (acc, c) => ({
      maoObra: acc.maoObra + (c.s.valor_mao_obra_instalador || 0),
      reembInst: acc.reembInst + c.reembInst,
      reembEmp: acc.reembEmp + c.reembEmp,
      recebInst: acc.recebInst + c.recebInst,
      recebEmp: acc.recebEmp + c.recebEmp,
      totalEmp: acc.totalEmp + c.totalEmp,
      totalInst: acc.totalInst + c.totalInst,
    }),
    { maoObra: 0, reembInst: 0, reembEmp: 0, recebInst: 0, recebEmp: 0, totalEmp: 0, totalInst: 0 }
  )

  const totalRecebidoPeloInstalador = totals.recebInst
  const saldo = totals.totalInst - totalRecebidoPeloInstalador
  const servicosComReembolso = calcs.filter(c => c.reembInst > 0 || c.reembEmp > 0)

  const s = {
    container: { width: '800px', padding: '28px', backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#1f2937' },
    header: { borderBottom: '2px solid #1f2937', paddingBottom: '14px', marginBottom: '20px' },
    title: { fontSize: '22px', fontWeight: 'bold', textAlign: 'center' as const, color: '#1f2937', marginBottom: '6px' },
    subtitle: { textAlign: 'center' as const, color: '#4b5563', fontSize: '13px' },
    section: { marginBottom: '20px', padding: '14px', backgroundColor: '#f9fafb', borderRadius: '8px' },
    sectionTitle: { fontSize: '14px', fontWeight: '700', marginBottom: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#374151' },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '10px' },
    th: { border: '1px solid #d1d5db', padding: '5px 4px', textAlign: 'left' as const, backgroundColor: '#e5e7eb', fontWeight: '700' },
    thR: { border: '1px solid #d1d5db', padding: '5px 4px', textAlign: 'right' as const, backgroundColor: '#e5e7eb', fontWeight: '700' },
    td: { border: '1px solid #d1d5db', padding: '5px 4px', textAlign: 'left' as const },
    tdR: { border: '1px solid #d1d5db', padding: '5px 4px', textAlign: 'right' as const },
    tdTotal: { border: '1px solid #d1d5db', padding: '5px 4px', textAlign: 'right' as const, backgroundColor: '#f3f4f6', fontWeight: '700' },
    summaryRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' },
    totalRow: { display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #374151', paddingTop: '8px', marginTop: '8px' },
    totalLabel: { fontSize: '16px', fontWeight: 'bold' },
    totalValueGreen: { fontSize: '16px', fontWeight: 'bold', color: '#16a34a' },
    totalValueRed: { fontSize: '16px', fontWeight: 'bold', color: '#dc2626' },
    footer: { borderTop: '2px solid #d1d5db', paddingTop: '14px', marginTop: '20px', textAlign: 'center' as const },
    footerText: { fontSize: '11px', color: '#6b7280', marginBottom: '6px' },
  }

  return (
    <div id="recibo-content" style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>RECIBO DE SERVIÇOS EXECUTADOS</h1>
        <div style={s.subtitle}>
          <p>Data: {format(dataReferencia, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
      </div>

      {/* Instalador */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Instalador</h2>
        <p style={{ fontSize: '13px' }}><strong>Nome:</strong> {instaladorNome}</p>
        <p style={{ fontSize: '13px' }}><strong>Período:</strong> Serviços do dia {format(dataReferencia, 'dd/MM/yyyy')}</p>
      </div>

      {/* Tabela de Serviços */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ ...s.sectionTitle, marginBottom: '10px' }}>Serviços Realizados</h2>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Código</th>
              <th style={s.th}>Cliente</th>
              <th style={s.th}>Tipo</th>
              <th style={s.thR}>M. Obra</th>
              <th style={s.thR}>Reemb. Inst.</th>
              <th style={s.thR}>Reemb. Emp.</th>
              <th style={s.thR}>Receb. Inst.</th>
              <th style={s.thR}>Receb. Emp.</th>
              <th style={{ ...s.thR, backgroundColor: '#dbeafe' }}>Total Emp.</th>
              <th style={{ ...s.thR, backgroundColor: '#dcfce7' }}>Total Inst.</th>
            </tr>
          </thead>
          <tbody>
            {calcs.map(({ s: sv, reembInst, reembEmp, recebInst, recebEmp, totalEmp, totalInst }) => (
              <tr key={sv.id}>
                <td style={{ ...s.td, fontWeight: '600' }}>{sv.codigo}</td>
                <td style={s.td}>{sv.cliente_nome}</td>
                <td style={s.td}>{sv.tipo_servico.join(', ')}</td>
                <td style={s.tdR}>{fmt(sv.valor_mao_obra_instalador || 0)}</td>
                <td style={s.tdR}>{reembInst > 0 ? fmt(reembInst) : '—'}</td>
                <td style={s.tdR}>{reembEmp > 0 ? fmt(reembEmp) : '—'}</td>
                <td style={{ ...s.tdR, color: recebInst > 0 ? '#ea580c' : '#9ca3af' }}>{recebInst > 0 ? fmt(recebInst) : '—'}</td>
                <td style={{ ...s.tdR, color: recebEmp > 0 ? '#2563eb' : '#9ca3af' }}>{recebEmp > 0 ? fmt(recebEmp) : '—'}</td>
                <td style={{ ...s.tdTotal, backgroundColor: '#eff6ff' }}>{fmt(totalEmp)}</td>
                <td style={{ ...s.tdTotal, backgroundColor: '#f0fdf4' }}>{fmt(totalInst)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ ...s.tdTotal, textAlign: 'center' as const }}>TOTAIS</td>
              <td style={s.tdTotal}>{fmt(totals.maoObra)}</td>
              <td style={s.tdTotal}>{fmt(totals.reembInst)}</td>
              <td style={s.tdTotal}>{fmt(totals.reembEmp)}</td>
              <td style={{ ...s.tdTotal, color: '#ea580c' }}>{fmt(totals.recebInst)}</td>
              <td style={{ ...s.tdTotal, color: '#2563eb' }}>{fmt(totals.recebEmp)}</td>
              <td style={{ ...s.tdTotal, backgroundColor: '#dbeafe' }}>{fmt(totals.totalEmp)}</td>
              <td style={{ ...s.tdTotal, backgroundColor: '#dcfce7' }}>{fmt(totals.totalInst)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Detalhamento de Reembolsos */}
      {servicosComReembolso.length > 0 && (
        <div style={s.section}>
          <h2 style={s.sectionTitle}>Detalhamento de Reembolsos</h2>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Código</th>
                <th style={s.th}>Cliente</th>
                <th style={s.th}>Tipo</th>
                <th style={s.th}>Responsável</th>
                <th style={s.thR}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {servicosComReembolso.map(({ s: sv, reembInst, reembEmp }) => (
                <>
                  {reembInst > 0 && (
                    <tr key={`${sv.id}-inst`}>
                      <td style={{ ...s.td, fontWeight: '600' }}>{sv.codigo}</td>
                      <td style={s.td}>{sv.cliente_nome}</td>
                      <td style={s.td}>{sv.tipo_servico.join(', ')}</td>
                      <td style={{ ...s.td, color: '#ea580c', fontWeight: '600' }}>Instalador</td>
                      <td style={s.tdR}>{fmt(reembInst)}</td>
                    </tr>
                  )}
                  {reembEmp > 0 && (
                    <tr key={`${sv.id}-emp`}>
                      <td style={{ ...s.td, fontWeight: '600' }}>{sv.codigo}</td>
                      <td style={s.td}>{sv.cliente_nome}</td>
                      <td style={s.td}>{sv.tipo_servico.join(', ')}</td>
                      <td style={{ ...s.td, color: '#2563eb', fontWeight: '600' }}>Empresa</td>
                      <td style={s.tdR}>{fmt(reembEmp)}</td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ ...s.tdTotal, textAlign: 'center' as const }}>TOTAL REEMBOLSOS</td>
                <td style={s.tdTotal}>{fmt(totals.reembInst + totals.reembEmp)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Resumo Financeiro */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Resumo Financeiro</h2>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          <div style={{ flex: 1, padding: '10px', backgroundColor: '#eff6ff', borderRadius: '6px', textAlign: 'center' as const }}>
            <p style={{ fontSize: '11px', color: '#1d4ed8', marginBottom: '4px' }}>Total Empresa</p>
            <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#1d4ed8' }}>{fmt(totals.totalEmp)}</p>
          </div>
          <div style={{ flex: 1, padding: '10px', backgroundColor: '#f0fdf4', borderRadius: '6px', textAlign: 'center' as const }}>
            <p style={{ fontSize: '11px', color: '#15803d', marginBottom: '4px' }}>Total Instalador</p>
            <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#15803d' }}>{fmt(totals.totalInst)}</p>
          </div>
        </div>

        {totalRecebidoPeloInstalador > 0 && (
          <div style={{ ...s.summaryRow, color: '#ea580c' }}>
            <span>Já recebido em mãos pelo instalador:</span>
            <span style={{ fontWeight: '600' }}>− {fmt(totalRecebidoPeloInstalador)}</span>
          </div>
        )}

        <div style={s.totalRow}>
          {saldo >= 0 ? (
            <>
              <span style={s.totalLabel}>EMPRESA DEVE PAGAR:</span>
              <span style={s.totalValueGreen}>{fmt(saldo)}</span>
            </>
          ) : (
            <>
              <span style={s.totalLabel}>INSTALADOR DEVE DEVOLVER:</span>
              <span style={s.totalValueRed}>{fmt(Math.abs(saldo))}</span>
            </>
          )}
        </div>
      </div>

      {/* Rodapé */}
      <div style={s.footer}>
        <p style={s.footerText}>Recibo gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
        <p style={{ ...s.footerText, fontStyle: 'italic' }}>Por favor, envie este recibo por email para confirmação dos valores.</p>
      </div>
    </div>
  )
}
