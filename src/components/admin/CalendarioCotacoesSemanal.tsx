import { ChevronLeft, ChevronRight, Clock, MapPin, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { addWeeks, subWeeks, startOfWeek, addDays, format, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface Cotacao {
  id: string
  cliente_id: string
  tipo_servico: string[]
  status: string
  created_at: string
  data_servico_desejada: string | null
  horario_inicio: string | null
  horario_fim: string | null
  valor_estimado: number | null
  ocasiao: string | null
  origem_lead: string | null
  descricao_servico: string | null
  observacoes: string | null
  clientes: {
    id: string
    nome: string
    telefone: string
    endereco_completo: string | null
    bairro: string | null
    idade: number | null
    tipo_alerta: string | null
    observacao_alerta: string | null
  }
}

interface CalendarioCotacoesSemanalProps {
  cotacoes: Cotacao[]
  onAprovar: (id: string) => void
  onEditar: (cotacao: Cotacao) => void
}

// Função para extrair data sem problemas de timezone
function parseDataServico(dataStr: string): Date {
  const [datePart] = dataStr.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pendente: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    aprovada: 'bg-green-100 border-green-300 text-green-800',
    perdida: 'bg-red-100 border-red-300 text-red-800',
    nao_gerou: 'bg-orange-100 border-orange-300 text-orange-800',
  }
  return colors[status] || colors.pendente
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pendente: 'Pendente',
    aprovada: 'Aprovada',
    perdida: 'Perdida',
    nao_gerou: 'Não Gerou',
  }
  return labels[status] || status
}

export function CalendarioCotacoesSemanal({ cotacoes, onAprovar, onEditar }: CalendarioCotacoesSemanalProps) {
  const [dataReferencia, setDataReferencia] = useState(new Date())
  const [cotacaoSelecionada, setCotacaoSelecionada] = useState<Cotacao | null>(null)
  
  // Início da semana (segunda-feira)
  const inicioSemana = startOfWeek(dataReferencia, { weekStartsOn: 1 })
  
  // Dias da semana (segunda a sábado)
  const diasSemana = Array.from({ length: 6 }, (_, i) => addDays(inicioSemana, i))

  const irParaHoje = () => setDataReferencia(new Date())
  const semanaAnterior = () => setDataReferencia(subWeeks(dataReferencia, 1))
  const proximaSemana = () => setDataReferencia(addWeeks(dataReferencia, 1))

  // Agrupar cotações por data
  const cotacoesPorDia = diasSemana.map(dia => {
    const cotacoesDoDia = cotacoes
      .filter(c => {
        if (!c.data_servico_desejada) return false
        const dataCotacao = parseDataServico(c.data_servico_desejada)
        return isSameDay(dataCotacao, dia)
      })
      .sort((a, b) => {
        const horaA = a.horario_inicio || '00:00'
        const horaB = b.horario_inicio || '00:00'
        return horaA.localeCompare(horaB)
      })
    return { dia, cotacoes: cotacoesDoDia }
  })

  const hoje = new Date()

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* Header com navegação */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={semanaAnterior}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={irParaHoje}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={proximaSemana}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          {format(inicioSemana, "dd 'de' MMMM", { locale: ptBR })} - {format(addDays(inicioSemana, 5), "dd 'de' MMMM yyyy", { locale: ptBR })}
        </h3>
      </div>

      {/* Grid do calendário */}
      <div className="grid grid-cols-6 gap-2">
        {cotacoesPorDia.map(({ dia, cotacoes: cotacoesDoDia }) => {
          const isHoje = isSameDay(dia, hoje)
          
          return (
            <div key={dia.toISOString()} className="min-h-[200px]">
              {/* Header do dia */}
              <div className={`text-center py-2 rounded-t-lg ${isHoje ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                <div className="text-xs font-medium uppercase">
                  {format(dia, 'EEE', { locale: ptBR })}
                </div>
                <div className={`text-lg font-bold ${isHoje ? 'text-white' : 'text-gray-900'}`}>
                  {format(dia, 'd')}
                </div>
              </div>
              
              {/* Cotações do dia */}
              <div className="border border-t-0 rounded-b-lg p-1 space-y-1 min-h-[160px] bg-gray-50">
                {cotacoesDoDia.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-4">
                    Sem cotações
                  </div>
                ) : (
                  cotacoesDoDia.map((cotacao) => (
                    <div
                      key={cotacao.id}
                      onClick={() => setCotacaoSelecionada(cotacao)}
                      className={`p-2 rounded border cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(cotacao.status)}`}
                    >
                      <div className="text-xs font-medium truncate">
                        {cotacao.clientes.nome}
                      </div>
                      {cotacao.horario_inicio && (
                        <div className="text-xs opacity-75 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {cotacao.horario_inicio.substring(0, 5)}
                        </div>
                      )}
                      <div className="text-xs truncate mt-1">
                        {cotacao.tipo_servico?.join(', ')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Sheet de detalhes */}
      <Sheet open={!!cotacaoSelecionada} onOpenChange={() => setCotacaoSelecionada(null)}>
        <SheetContent>
          {cotacaoSelecionada && (
            <>
              <SheetHeader>
                <SheetTitle>Detalhes da Cotação</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="font-medium">{cotacaoSelecionada.clientes.nome}</p>
                    <p className="text-sm text-gray-500">{cotacaoSelecionada.clientes.telefone}</p>
                  </div>
                </div>

                {cotacaoSelecionada.clientes.bairro && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-gray-500" />
                    <p className="text-sm">{cotacaoSelecionada.clientes.bairro}</p>
                  </div>
                )}

                {cotacaoSelecionada.data_servico_desejada && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-500" />
                    <p className="text-sm">
                      {format(parseDataServico(cotacaoSelecionada.data_servico_desejada), "dd/MM/yyyy", { locale: ptBR })}
                      {cotacaoSelecionada.horario_inicio && ` às ${cotacaoSelecionada.horario_inicio.substring(0, 5)}`}
                      {cotacaoSelecionada.horario_fim && ` - ${cotacaoSelecionada.horario_fim.substring(0, 5)}`}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-gray-700">Tipo de Serviço</p>
                  <p className="text-sm">{cotacaoSelecionada.tipo_servico?.join(', ') || '-'}</p>
                </div>

                {cotacaoSelecionada.valor_estimado && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Valor Estimado</p>
                    <p className="text-sm font-bold text-green-600">
                      R$ {cotacaoSelecionada.valor_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-gray-700">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(cotacaoSelecionada.status)}`}>
                    {getStatusLabel(cotacaoSelecionada.status)}
                  </span>
                </div>

                {cotacaoSelecionada.descricao_servico && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Descrição</p>
                    <p className="text-sm text-gray-600">{cotacaoSelecionada.descricao_servico}</p>
                  </div>
                )}

                {cotacaoSelecionada.observacoes && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Observações</p>
                    <p className="text-sm text-gray-600">{cotacaoSelecionada.observacoes}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      onEditar(cotacaoSelecionada)
                      setCotacaoSelecionada(null)
                    }}
                    className="flex-1"
                  >
                    Editar
                  </Button>
                  {cotacaoSelecionada.status === 'pendente' && (
                    <Button 
                      onClick={() => {
                        onAprovar(cotacaoSelecionada.id)
                        setCotacaoSelecionada(null)
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      Aprovar
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
