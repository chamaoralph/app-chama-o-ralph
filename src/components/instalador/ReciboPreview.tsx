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

  return (
    <div 
      id="recibo-content"
      className="bg-white p-8 max-w-[800px] mx-auto"
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      {/* Header */}
      <div className="border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
          RECIBO DE SERVIÇOS EXECUTADOS
        </h1>
        <div className="text-center text-gray-600">
          <p>Data: {format(dataReferencia, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
      </div>

      {/* Dados do Instalador */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Instalador</h2>
        <p className="text-gray-700"><strong>Nome:</strong> {instaladorNome}</p>
        <p className="text-gray-700"><strong>Período:</strong> Serviços do dia {format(dataReferencia, 'dd/MM/yyyy')}</p>
      </div>

      {/* Tabela de Serviços */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Serviços Realizados</h2>
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left text-sm">Código</th>
              <th className="border border-gray-300 px-3 py-2 text-left text-sm">Cliente</th>
              <th className="border border-gray-300 px-3 py-2 text-left text-sm">Tipo</th>
              <th className="border border-gray-300 px-3 py-2 text-right text-sm">Mão de Obra</th>
              <th className="border border-gray-300 px-3 py-2 text-right text-sm">Reembolso</th>
              <th className="border border-gray-300 px-3 py-2 text-right text-sm">Total</th>
            </tr>
          </thead>
          <tbody>
            {servicos.map((servico) => {
              const total = servico.valor_mao_obra_instalador + servico.valor_reembolso_despesas
              return (
                <tr key={servico.id}>
                  <td className="border border-gray-300 px-3 py-2 text-sm font-medium">
                    {servico.codigo}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm">
                    {servico.cliente_nome}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm">
                    {servico.tipo_servico.join(', ')}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm text-right">
                    R$ {servico.valor_mao_obra_instalador.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm text-right">
                    R$ {servico.valor_reembolso_despesas.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm text-right font-medium">
                    R$ {total.toFixed(2)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Resumo Financeiro */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Resumo Financeiro</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Total Mão de Obra:</span>
            <span className="font-medium">R$ {totalMaoObra.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Reembolsos:</span>
            <span className="font-medium">R$ {totalReembolso.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-300 pt-2 mt-2">
            <span className="font-bold text-lg">TOTAL A RECEBER:</span>
            <span className="font-bold text-lg text-green-600">R$ {totalGeral.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div className="border-t-2 border-gray-300 pt-4 mt-6">
        <p className="text-sm text-gray-600 text-center mb-2">
          Recibo gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
        </p>
        <p className="text-sm text-gray-500 text-center italic">
          Por favor, envie este recibo por email para confirmação dos valores.
        </p>
      </div>
    </div>
  )
}
