import { ChevronLeft, ChevronRight, Clock, User, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameMonth, isSameDay } from 'date-fns'
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

interface CalendarioCotacoesMensalProps {
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

const getStatusDot = (status: string) => {
  const colors: Record<string, string> = {
    pendente: 'bg-yellow-500',
    aprovada: 'bg-green-500',
    perdida: 'bg-red-500',
    nao_gerou: 'bg-orange-500',
  }
  return colors[status] || colors.pendente
}

export function CalendarioCotacoesMensal({ cotacoes, onAprovar, onEditar }: CalendarioCotacoesMensalProps) {
  const [dataReferencia, setDataReferencia] = useState(new Date())
  const [cotacaoSelecionada, setCotacaoSelecionada] = useState<Cotacao | null>(null)
  const [diaSelecionado, setDiaSelecionado] = useState<{ dia: Date; cotacoes: Cotacao[] } | null>(null)
  
  const inicioMes = startOfMonth(dataReferencia)
  const fimMes = endOfMonth(dataReferencia)
  const inicioCalendario = startOfWeek(inicioMes, { weekStartsOn: 1 })
  const fimCalendario = endOfWeek(fimMes, { weekStartsOn: 1 })
  
  // Gerar todos os dias do calendário
  const dias: Date[] = []
  let diaAtual = inicioCalendario
  while (diaAtual <= fimCalendario) {
    dias.push(diaAtual)
    diaAtual = addDays(diaAtual, 1)
  }

  const irParaHoje = () => setDataReferencia(new Date())
  const mesAnterior = () => setDataReferencia(subMonths(dataReferencia, 1))
  const proximoMes = () => setDataReferencia(addMonths(dataReferencia, 1))

  // Agrupar cotações por data
  const getCotacoesDoDia = (dia: Date) => {
    return cotacoes
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
  }

  const hoje = new Date()
  const diasSemana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* Header com navegação */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={mesAnterior}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={irParaHoje}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={proximoMes}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 capitalize">
          {format(dataReferencia, "MMMM 'de' yyyy", { locale: ptBR })}
        </h3>
      </div>

      {/* Header dos dias da semana */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {diasSemana.map(dia => (
          <div key={dia} className="text-center text-xs font-medium text-gray-500 py-2">
            {dia}
          </div>
        ))}
      </div>

      {/* Grid do calendário */}
      <div className="grid grid-cols-7 gap-1">
        {dias.map((dia) => {
          const cotacoesDoDia = getCotacoesDoDia(dia)
          const isHoje = isSameDay(dia, hoje)
          const isMesAtual = isSameMonth(dia, dataReferencia)
          
          return (
            <div 
              key={dia.toISOString()} 
              className={`min-h-[80px] p-1 border rounded cursor-pointer hover:bg-gray-50 transition-colors ${
                isHoje ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              } ${!isMesAtual ? 'opacity-40' : ''}`}
              onClick={() => cotacoesDoDia.length > 0 && setDiaSelecionado({ dia, cotacoes: cotacoesDoDia })}
            >
              <div className={`text-sm font-medium mb-1 ${isHoje ? 'text-blue-600' : 'text-gray-700'}`}>
                {format(dia, 'd')}
              </div>
              
              {/* Indicadores de cotações */}
              <div className="space-y-0.5">
                {cotacoesDoDia.slice(0, 3).map((cotacao) => (
                  <div
                    key={cotacao.id}
                    className={`text-xs px-1 py-0.5 rounded truncate ${getStatusColor(cotacao.status)}`}
                    title={cotacao.clientes.nome}
                  >
                    {cotacao.clientes.nome.split(' ')[0]}
                  </div>
                ))}
                {cotacoesDoDia.length > 3 && (
                  <div className="text-xs text-gray-500 text-center">
                    +{cotacoesDoDia.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Sheet de cotações do dia */}
      <Sheet open={!!diaSelecionado} onOpenChange={() => setDiaSelecionado(null)}>
        <SheetContent>
          {diaSelecionado && (
            <>
              <SheetHeader>
                <SheetTitle>
                  Cotações - {format(diaSelecionado.dia, "dd 'de' MMMM", { locale: ptBR })}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-3">
                {diaSelecionado.cotacoes.map((cotacao) => (
                  <div 
                    key={cotacao.id}
                    onClick={() => {
                      setDiaSelecionado(null)
                      setCotacaoSelecionada(cotacao)
                    }}
                    className={`p-3 rounded-lg border cursor-pointer hover:opacity-80 ${getStatusColor(cotacao.status)}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{cotacao.clientes.nome}</span>
                      <span className="text-xs">{getStatusLabel(cotacao.status)}</span>
                    </div>
                    <div className="text-sm mt-1">
                      {cotacao.tipo_servico?.join(', ')}
                    </div>
                    {cotacao.horario_inicio && (
                      <div className="text-xs flex items-center gap-1 mt-1 opacity-75">
                        <Clock className="w-3 h-3" />
                        {cotacao.horario_inicio.substring(0, 5)}
                        {cotacao.horario_fim && ` - ${cotacao.horario_fim.substring(0, 5)}`}
                      </div>
                    )}
                    {cotacao.clientes.bairro && (
                      <div className="text-xs flex items-center gap-1 mt-1 opacity-75">
                        <MapPin className="w-3 h-3" />
                        {cotacao.clientes.bairro}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet de detalhes da cotação */}
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
