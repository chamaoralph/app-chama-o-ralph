import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ServicoRecibo {
  id: string
  codigo: string
  cliente_nome: string
  tipo_servico: string[]
  valor_mao_obra_instalador: number
  valor_reembolso_despesas: number
}

interface ReciboPreviewProps {
  instaladorNome: string
  dataReferencia: Date
  servicos: ServicoRecibo[]
}

export function ReciboPreview({ instaladorNome, dataReferencia, servicos }: ReciboPreviewProps) {
  const totalMaoObra = servicos.reduce((sum, s) => sum + s.valor_mao_obra_instalador, 0)
  const totalReembolso = servicos.reduce((sum, s) => sum + s.valor_reembolso_despesas, 0)
  const totalGeral = totalMaoObra + totalReembolso

  // Estilos inline para garantir captura correta pelo html2canvas
  const styles = {
    container: {
      width: '800px',
      padding: '32px',
      backgroundColor: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      color: '#1f2937'
    },
    header: {
      borderBottom: '2px solid #1f2937',
      paddingBottom: '16px',
      marginBottom: '24px'
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      textAlign: 'center' as const,
      color: '#1f2937',
      marginBottom: '8px'
    },
    subtitle: {
      textAlign: 'center' as const,
      color: '#4b5563'
    },
    section: {
      marginBottom: '24px',
      padding: '16px',
      backgroundColor: '#f9fafb',
      borderRadius: '8px'
    },
    sectionTitle: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '8px'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontSize: '12px'
    },
    th: {
      border: '1px solid #d1d5db',
      padding: '8px',
      textAlign: 'left' as const,
      backgroundColor: '#f3f4f6',
      fontWeight: '600'
    },
    thRight: {
      border: '1px solid #d1d5db',
      padding: '8px',
      textAlign: 'right' as const,
      backgroundColor: '#f3f4f6',
      fontWeight: '600'
    },
    td: {
      border: '1px solid #d1d5db',
      padding: '8px',
      textAlign: 'left' as const
    },
    tdRight: {
      border: '1px solid #d1d5db',
      padding: '8px',
      textAlign: 'right' as const
    },
    summaryRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '8px'
    },
    totalRow: {
      display: 'flex',
      justifyContent: 'space-between',
      borderTop: '1px solid #d1d5db',
      paddingTop: '8px',
      marginTop: '8px'
    },
    totalLabel: {
      fontSize: '18px',
      fontWeight: 'bold'
    },
    totalValue: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#16a34a'
    },
    footer: {
      borderTop: '2px solid #d1d5db',
      paddingTop: '16px',
      marginTop: '24px',
      textAlign: 'center' as const
    },
    footerText: {
      fontSize: '12px',
      color: '#6b7280',
      marginBottom: '8px'
    }
  }

  return (
    <div id="recibo-content" style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>RECIBO DE SERVIÇOS EXECUTADOS</h1>
        <div style={styles.subtitle}>
          <p>Data: {format(dataReferencia, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
      </div>

      {/* Dados do Instalador */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Instalador</h2>
        <p><strong>Nome:</strong> {instaladorNome}</p>
        <p><strong>Período:</strong> Serviços do dia {format(dataReferencia, 'dd/MM/yyyy')}</p>
      </div>

      {/* Tabela de Serviços */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ ...styles.sectionTitle, marginBottom: '12px' }}>Serviços Realizados</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Código</th>
              <th style={styles.th}>Cliente</th>
              <th style={styles.th}>Tipo</th>
              <th style={styles.thRight}>M. Obra</th>
              <th style={styles.thRight}>Reemb.</th>
              <th style={styles.thRight}>Total</th>
            </tr>
          </thead>
          <tbody>
            {servicos.map((servico) => {
              const total = servico.valor_mao_obra_instalador + servico.valor_reembolso_despesas
              return (
                <tr key={servico.id}>
                  <td style={{ ...styles.td, fontWeight: '500' }}>{servico.codigo}</td>
                  <td style={styles.td}>{servico.cliente_nome}</td>
                  <td style={styles.td}>{servico.tipo_servico.join(', ')}</td>
                  <td style={styles.tdRight}>R$ {servico.valor_mao_obra_instalador.toFixed(2)}</td>
                  <td style={styles.tdRight}>R$ {servico.valor_reembolso_despesas.toFixed(2)}</td>
                  <td style={{ ...styles.tdRight, fontWeight: '500' }}>R$ {total.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Resumo Financeiro */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Resumo Financeiro</h2>
        <div style={styles.summaryRow}>
          <span>Total Mão de Obra:</span>
          <span style={{ fontWeight: '500' }}>R$ {totalMaoObra.toFixed(2)}</span>
        </div>
        <div style={styles.summaryRow}>
          <span>Total Reembolsos:</span>
          <span style={{ fontWeight: '500' }}>R$ {totalReembolso.toFixed(2)}</span>
        </div>
        <div style={styles.totalRow}>
          <span style={styles.totalLabel}>TOTAL A RECEBER:</span>
          <span style={styles.totalValue}>R$ {totalGeral.toFixed(2)}</span>
        </div>
      </div>

      {/* Rodapé */}
      <div style={styles.footer}>
        <p style={styles.footerText}>
          Recibo gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
        </p>
        <p style={{ ...styles.footerText, fontStyle: 'italic' }}>
          Por favor, envie este recibo por email para confirmação dos valores.
        </p>
      </div>
    </div>
  )
}
