import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { Link } from 'react-router-dom'
import { DollarSign, Package, Users, FileText, TrendingUp, ChevronRight, ChevronLeft, Plus, CheckCircle, BarChart3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatarDataBR } from '@/lib/utils'

interface Metricas {
  receitaMes: number
  servicosConcluidosMes: number
  saldoCaixa: number
  cotacoesPendentes: number
}

interface UltimoServico {
  codigo: string
  cliente_nome: string
  instalador_nome: string | null
  status: string
  data_servico_agendada: string
}

interface DadoInstaladorDia {
  atribuidos: number
  atribuidos_valor: number
  realizados: number
  realizados_valor: number
}

interface DadosInstaladorSemana {
  instalador_id: string
  instalador_nome: string
  dias: Record<number, DadoInstaladorDia> // 1=seg, 2=ter, ..., 6=sab
  total_atribuidos: number
  total_atribuidos_valor: number
  total_realizados: number
  total_realizados_valor: number
}

interface DadosSemana {
  numero_semana: number
  inicio: Date
  fim: Date
  instaladores: DadosInstaladorSemana[]
}

export default function AdminDashboard() {
  const [metricas, setMetricas] = useState<Metricas>({
    receitaMes: 0,
    servicosConcluidosMes: 0,
    saldoCaixa: 0,
    cotacoesPendentes: 0
  })
  const [ultimosServicos, setUltimosServicos] = useState<UltimoServico[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSemana, setLoadingSemana] = useState(false)
  const [servicosDisponiveis, setServicosDisponiveis] = useState(0)
  const [dadosSemana, setDadosSemana] = useState<DadosSemana | null>(null)
  const [semanaOffset, setSemanaOffset] = useState(0)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const isMobile = useIsMobile()

  const diasSemana = [
    { key: 1, label: 'segunda' },
    { key: 2, label: 'terça' },
    { key: 3, label: 'quarta' },
    { key: 4, label: 'quinta' },
    { key: 5, label: 'sexta' },
    { key: 6, label: 'sábado' }
  ]

  const carregarDadosSemana = useCallback(async (empId: string, offset: number) => {
    try {
      setLoadingSemana(true)
      
      const hoje = new Date()
      hoje.setDate(hoje.getDate() + (offset * 7))
      
      const diaSemana = hoje.getDay()
      const inicioSemana = new Date(hoje)
      inicioSemana.setDate(hoje.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
      inicioSemana.setHours(0, 0, 0, 0)

      const fimSemana = new Date(inicioSemana)
      fimSemana.setDate(inicioSemana.getDate() + 5)
      fimSemana.setHours(23, 59, 59, 999)

      const startOfYear = new Date(inicioSemana.getFullYear(), 0, 1)
      const weekNumber = Math.ceil(((inicioSemana.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)

      // Buscar serviços ATRIBUÍDOS + EM_ANDAMENTO
      const { data: servicosAtribuidos } = await supabase
        .from('servicos')
        .select(`
          instalador_id,
          valor_total,
          valor_mao_obra_instalador,
          valor_reembolso_despesas,
          data_servico_agendada,
          instalador:usuarios!fk_servicos_instalador(nome)
        `)
        .eq('empresa_id', empId)
        .in('status', ['atribuido', 'em_andamento'])
        .gte('data_servico_agendada', inicioSemana.toISOString())
        .lte('data_servico_agendada', fimSemana.toISOString())
        .not('instalador_id', 'is', null)

      // Buscar serviços CONCLUÍDOS
      const { data: servicosConcluidos } = await supabase
        .from('servicos')
        .select(`
          instalador_id,
          valor_total,
          valor_mao_obra_instalador,
          valor_reembolso_despesas,
          data_servico_agendada,
          instalador:usuarios!fk_servicos_instalador(nome)
        `)
        .eq('empresa_id', empId)
        .eq('status', 'concluido')
        .gte('data_servico_agendada', inicioSemana.toISOString())
        .lte('data_servico_agendada', fimSemana.toISOString())
        .not('instalador_id', 'is', null)

      // Agrupar por instalador e dia
      const instaladoresMap: Record<string, DadosInstaladorSemana> = {}

      const processarServico = (s: any, tipo: 'atribuido' | 'realizado') => {
        if (!s.instalador_id) return
        
        const dataServico = new Date(s.data_servico_agendada)
        const diaSemanaServico = dataServico.getDay()

        if (!instaladoresMap[s.instalador_id]) {
          instaladoresMap[s.instalador_id] = {
            instalador_id: s.instalador_id,
            instalador_nome: s.instalador?.nome || 'Sem nome',
            dias: {},
            total_atribuidos: 0,
            total_atribuidos_valor: 0,
            total_realizados: 0,
            total_realizados_valor: 0
          }
        }

        if (!instaladoresMap[s.instalador_id].dias[diaSemanaServico]) {
          instaladoresMap[s.instalador_id].dias[diaSemanaServico] = {
            atribuidos: 0,
            atribuidos_valor: 0,
            realizados: 0,
            realizados_valor: 0
          }
        }

        // Calcular lucro da empresa (desconta comissão do instalador + reembolso de material)
        const valorTotal = Number(s.valor_total) || 0
        const comissaoInstalador = Number(s.valor_mao_obra_instalador) || 0
        const reembolsoMaterial = Number(s.valor_reembolso_despesas) || 0
        const lucroEmpresa = valorTotal - comissaoInstalador - reembolsoMaterial

        if (tipo === 'atribuido') {
          instaladoresMap[s.instalador_id].dias[diaSemanaServico].atribuidos += 1
          instaladoresMap[s.instalador_id].dias[diaSemanaServico].atribuidos_valor += lucroEmpresa
          instaladoresMap[s.instalador_id].total_atribuidos += 1
          instaladoresMap[s.instalador_id].total_atribuidos_valor += lucroEmpresa
        } else {
          instaladoresMap[s.instalador_id].dias[diaSemanaServico].realizados += 1
          instaladoresMap[s.instalador_id].dias[diaSemanaServico].realizados_valor += lucroEmpresa
          instaladoresMap[s.instalador_id].total_realizados += 1
          instaladoresMap[s.instalador_id].total_realizados_valor += lucroEmpresa
        }
      }

      servicosAtribuidos?.forEach(s => processarServico(s, 'atribuido'))
      servicosConcluidos?.forEach(s => processarServico(s, 'realizado'))

      setDadosSemana({
        numero_semana: weekNumber,
        inicio: inicioSemana,
        fim: fimSemana,
        instaladores: Object.values(instaladoresMap).sort((a, b) => 
          (b.total_realizados_valor + b.total_atribuidos_valor) - (a.total_realizados_valor + a.total_atribuidos_valor)
        )
      })
    } catch (error) {
      console.error('Erro ao carregar dados da semana:', error)
    } finally {
      setLoadingSemana(false)
    }
  }, [])

  useEffect(() => {
    carregarDados()
  }, [])

  useEffect(() => {
    if (empresaId) {
      carregarDadosSemana(empresaId, semanaOffset)
    }
  }, [empresaId, semanaOffset, carregarDadosSemana])

  async function carregarDados() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()

      if (!userData) return

      setEmpresaId(userData.empresa_id)

      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      // Lançamentos do caixa do mês
      const { data: lancamentos } = await supabase
        .from('lancamentos_caixa')
        .select('tipo, valor')
        .eq('empresa_id', userData.empresa_id)
        .gte('data_lancamento', startOfMonth.toISOString().split('T')[0])

      const receitaMes = lancamentos?.filter(l => l.tipo === 'receita').reduce((sum, l) => sum + Number(l.valor), 0) || 0
      const despesasMes = lancamentos?.filter(l => l.tipo === 'despesa').reduce((sum, l) => sum + Number(l.valor), 0) || 0
      const saldoCaixa = receitaMes - despesasMes

      // Serviços concluídos no mês
      const { data: servicos } = await supabase
        .from('servicos')
        .select('id')
        .eq('empresa_id', userData.empresa_id)
        .eq('status', 'concluido')
        .gte('updated_at', startOfMonth.toISOString())

      const servicosConcluidosMes = servicos?.length || 0

      // Cotações pendentes
      const { data: cotacoes } = await supabase
        .from('cotacoes')
        .select('id')
        .eq('empresa_id', userData.empresa_id)
        .in('status', ['enviada', 'em_negociacao'])

      const cotacoesPendentes = cotacoes?.length || 0

      // Serviços aguardando aprovação
      const { data: servicosDisp } = await supabase
        .from('servicos')
        .select('id')
        .eq('empresa_id', userData.empresa_id)
        .in('status', ['solicitado', 'aguardando_aprovacao'])

      setServicosDisponiveis(servicosDisp?.length || 0)

      setMetricas({
        receitaMes,
        servicosConcluidosMes,
        saldoCaixa,
        cotacoesPendentes
      })

      // Últimos 5 serviços
      const { data: ultimosServData } = await supabase
        .from('servicos')
        .select(`
          codigo,
          status,
          data_servico_agendada,
          cliente:clientes(nome),
          instalador:usuarios!servicos_instalador_id_fkey(nome)
        `)
        .eq('empresa_id', userData.empresa_id)
        .order('created_at', { ascending: false })
        .limit(5)

      const servicosFormatados = ultimosServData?.map((s: any) => ({
        codigo: s.codigo,
        cliente_nome: s.cliente?.nome || 'N/A',
        instalador_nome: s.instalador?.nome || null,
        status: s.status,
        data_servico_agendada: s.data_servico_agendada
      })) || []

      setUltimosServicos(servicosFormatados)

    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const irSemanaAnterior = () => {
    setSemanaOffset(prev => prev - 1)
  }

  const irProximaSemana = () => {
    setSemanaOffset(prev => Math.min(prev + 1, 0))
  }

  const formatarValorCurto = (valor: number) => {
    if (valor >= 1000) {
      return `R$${(valor / 1000).toFixed(1)}k`
    }
    return `R$${valor.toFixed(0)}`
  }

  const getDataDia = (diaKey: number) => {
    if (!dadosSemana) return ''
    const data = new Date(dadosSemana.inicio)
    data.setDate(data.getDate() + (diaKey - 1))
    return `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}`
  }

  const formatarPeriodoSemana = () => {
    if (!dadosSemana) return ''
    const inicio = dadosSemana.inicio
    const fim = dadosSemana.fim
    return `${inicio.getDate().toString().padStart(2, '0')}/${(inicio.getMonth() + 1).toString().padStart(2, '0')} - ${fim.getDate().toString().padStart(2, '0')}/${(fim.getMonth() + 1).toString().padStart(2, '0')}`
  }

  function getStatusBadge(status: string) {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'aguardando_distribuicao': { label: 'Aguardando', variant: 'secondary' },
      'disponivel': { label: 'Disponível', variant: 'default' },
      'atribuido': { label: 'Atribuído', variant: 'secondary' },
      'em_andamento': { label: 'Em Andamento', variant: 'default' },
      'aguardando_aprovacao': { label: 'Aguard. Aprovação', variant: 'outline' },
      'concluido': { label: 'Concluído', variant: 'default' }
    }
    const config = statusMap[status] || { label: status, variant: 'outline' }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  // Componente de célula da tabela semanal
  const CelulaSemanal = ({ dados }: { dados?: DadoInstaladorDia }) => {
    if (!dados || (dados.atribuidos === 0 && dados.realizados === 0)) {
      return (
        <div className="text-center text-gray-300">
          <div className="text-xs">📋 0</div>
          <div className="text-xs">✅ 0</div>
        </div>
      )
    }
    return (
      <div className="text-center">
        <div className="text-blue-600 text-xs">
          📋 {dados.atribuidos} - {formatarValorCurto(dados.atribuidos_valor)}
        </div>
        <div className="text-green-600 text-xs font-medium">
          ✅ {dados.realizados} - {formatarValorCurto(dados.realizados_valor)}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </AdminLayout>
    )
  }

  // Layout Mobile
  if (isMobile) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>

          {/* Métricas em Scroll Horizontal */}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-4 min-w-[140px] flex-shrink-0">
              <DollarSign className="h-6 w-6 mb-2 opacity-80" />
              <div className="text-xl font-bold">R$ {metricas.receitaMes.toFixed(0)}</div>
              <div className="text-xs opacity-90">Receita do Mês</div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-4 min-w-[140px] flex-shrink-0">
              <Package className="h-6 w-6 mb-2 opacity-80" />
              <div className="text-xl font-bold">{metricas.servicosConcluidosMes}</div>
              <div className="text-xs opacity-90">Concluídos</div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-4 min-w-[140px] flex-shrink-0">
              <DollarSign className="h-6 w-6 mb-2 opacity-80" />
              <div className="text-xl font-bold">R$ {metricas.saldoCaixa.toFixed(0)}</div>
              <div className="text-xs opacity-90">Saldo</div>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-4 min-w-[140px] flex-shrink-0">
              <FileText className="h-6 w-6 mb-2 opacity-80" />
              <div className="text-xl font-bold">{metricas.cotacoesPendentes}</div>
              <div className="text-xs opacity-90">Cotações Pend.</div>
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="grid grid-cols-2 gap-3">
            <Link to="/admin/cotacoes/nova">
              <div className="bg-blue-600 text-white rounded-xl p-4 text-center hover:bg-blue-700 transition-colors">
                <Plus className="h-8 w-8 mx-auto mb-2" />
                <span className="text-sm font-medium">Nova Cotação</span>
              </div>
            </Link>
            <Link to="/admin/aprovacoes">
              <div className="bg-yellow-600 text-white rounded-xl p-4 text-center hover:bg-yellow-700 transition-colors relative">
                <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                <span className="text-sm font-medium">Aprovações</span>
                {servicosDisponiveis > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-red-500">{servicosDisponiveis}</Badge>
                )}
              </div>
            </Link>
          </div>

          {/* Tabela Semanal de Serviços - Mobile */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Button variant="outline" size="sm" onClick={irSemanaAnterior} disabled={loadingSemana}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-base font-bold text-center">
                📊 Semana {dadosSemana?.numero_semana || '-'}
                <span className="block text-xs font-normal text-gray-500">{formatarPeriodoSemana()}</span>
              </h2>
              <Button variant="outline" size="sm" onClick={irProximaSemana} disabled={semanaOffset >= 0 || loadingSemana}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            {loadingSemana ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
              </div>
            ) : dadosSemana && dadosSemana.instaladores.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-gray-600 sticky left-0 bg-gray-50">Instalador</th>
                        {diasSemana.map(dia => (
                          <th key={dia.key} className="px-2 py-2 text-center font-medium text-gray-600 min-w-[70px]">
                            {dia.label.slice(0, 3)}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center font-medium text-gray-600 bg-gray-100 min-w-[80px]">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dadosSemana.instaladores.map((instalador, idx) => (
                        <tr key={instalador.instalador_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-2 py-2 font-medium text-gray-900 sticky left-0 bg-inherit whitespace-nowrap">
                            {instalador.instalador_nome.split(' ')[0]}
                          </td>
                          {diasSemana.map(dia => (
                            <td key={dia.key} className="px-2 py-2">
                              <CelulaSemanal dados={instalador.dias[dia.key]} />
                            </td>
                          ))}
                          <td className="px-2 py-2 bg-gray-100">
                            <div className="text-center">
                              <div className="text-blue-600 text-xs">
                                📋 {instalador.total_atribuidos} - {formatarValorCurto(instalador.total_atribuidos_valor)}
                              </div>
                              <div className="text-green-600 text-xs font-bold">
                                ✅ {instalador.total_realizados} - {formatarValorCurto(instalador.total_realizados_valor)}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-200 font-bold">
                      <tr>
                        <td className="px-2 py-2 font-bold text-gray-900 sticky left-0 bg-gray-200">TOTAL</td>
                        {diasSemana.map(dia => {
                          const totalDiaAtribuidos = dadosSemana.instaladores.reduce((sum, inst) => sum + (inst.dias[dia.key]?.atribuidos || 0), 0);
                          const totalDiaAtribuidosValor = dadosSemana.instaladores.reduce((sum, inst) => sum + (inst.dias[dia.key]?.atribuidos_valor || 0), 0);
                          const totalDiaRealizados = dadosSemana.instaladores.reduce((sum, inst) => sum + (inst.dias[dia.key]?.realizados || 0), 0);
                          const totalDiaRealizadosValor = dadosSemana.instaladores.reduce((sum, inst) => sum + (inst.dias[dia.key]?.realizados_valor || 0), 0);
                          return (
                            <td key={dia.key} className="px-2 py-2">
                              <div className="text-center">
                                <div className="text-blue-700 text-xs">📋 {totalDiaAtribuidos} - {formatarValorCurto(totalDiaAtribuidosValor)}</div>
                                <div className="text-green-700 text-xs">✅ {totalDiaRealizados} - {formatarValorCurto(totalDiaRealizadosValor)}</div>
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 bg-gray-300">
                          <div className="text-center">
                            <div className="text-blue-700 text-xs">
                              📋 {dadosSemana.instaladores.reduce((sum, inst) => sum + inst.total_atribuidos, 0)} - {formatarValorCurto(dadosSemana.instaladores.reduce((sum, inst) => sum + inst.total_atribuidos_valor, 0))}
                            </div>
                            <div className="text-green-700 text-xs">
                              ✅ {dadosSemana.instaladores.reduce((sum, inst) => sum + inst.total_realizados, 0)} - {formatarValorCurto(dadosSemana.instaladores.reduce((sum, inst) => sum + inst.total_realizados_valor, 0))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center text-gray-500">
                Nenhum serviço nesta semana
              </div>
            )}
          </div>

          {/* Links Rápidos */}
          <div className="space-y-2">
            <Link to="/admin/servicos">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 p-2 rounded-lg">
                    <Package className="h-5 w-5 text-gray-600" />
                  </div>
                  <span className="font-medium text-gray-900">Ver Serviços</span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </Link>
            <Link to="/admin/relatorios">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 p-2 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-gray-600" />
                  </div>
                  <span className="font-medium text-gray-900">Relatórios</span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </Link>
          </div>

          {/* Últimos Serviços - Cards Mobile */}
          <div>
            <h2 className="text-lg font-bold mb-3">Últimos Serviços</h2>
            {ultimosServicos.length === 0 ? (
              <div className="bg-white rounded-xl p-6 text-center text-gray-500">
                Nenhum serviço registrado
              </div>
            ) : (
              <div className="space-y-2">
                {ultimosServicos.map((servico, idx) => (
                  <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-bold text-gray-900">{servico.codigo}</span>
                        <p className="text-sm text-gray-600">{servico.cliente_nome}</p>
                      </div>
                      {getStatusBadge(servico.status)}
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>👷 {servico.instalador_nome || '-'}</span>
                      <span>{formatarDataBR(servico.data_servico_agendada)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    )
  }

  // Layout Desktop (original)
  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard Administrativo</h1>

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-8 w-8" />
              <span className="text-3xl opacity-30">💰</span>
            </div>
            <div className="text-2xl font-bold">R$ {metricas.receitaMes.toFixed(2)}</div>
            <div className="text-sm opacity-90">Receita do Mês</div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <Package className="h-8 w-8" />
              <span className="text-3xl opacity-30">📦</span>
            </div>
            <div className="text-2xl font-bold">{metricas.servicosConcluidosMes}</div>
            <div className="text-sm opacity-90">Serviços Concluídos no Mês</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-8 w-8" />
              <span className="text-3xl opacity-30">💰</span>
            </div>
            <div className="text-2xl font-bold">R$ {metricas.saldoCaixa.toFixed(2)}</div>
            <div className="text-sm opacity-90">Saldo do Mês</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-8 w-8" />
              <span className="text-3xl opacity-30">📝</span>
            </div>
            <div className="text-2xl font-bold">{metricas.cotacoesPendentes}</div>
            <div className="text-sm opacity-90">Cotações Pendentes</div>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            Ações Rápidas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/admin/cotacoes/nova">
              <Button className="w-full h-20 text-lg bg-blue-600 hover:bg-blue-700">
                ➕ Nova Cotação
              </Button>
            </Link>
            <Link to="/admin/aprovacoes">
              <Button className="w-full h-20 text-lg bg-yellow-600 hover:bg-yellow-700 relative">
                ✅ Ver Aprovações
                {servicosDisponiveis > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-red-500">
                    {servicosDisponiveis}
                  </Badge>
                )}
              </Button>
            </Link>
            <Link to="/admin/relatorios">
              <Button className="w-full h-20 text-lg bg-green-600 hover:bg-green-700">
                📊 Ver Relatórios
              </Button>
            </Link>
          </div>
        </div>

        {/* Tabela Semanal de Serviços por Instalador - Desktop */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" onClick={irSemanaAnterior} disabled={loadingSemana}>
              <ChevronLeft className="h-4 w-4 mr-2" /> Anterior
            </Button>
            <h2 className="text-xl font-bold text-center">
              📊 Semana {dadosSemana?.numero_semana || '-'} - Serviços por Instalador
              <span className="block text-sm font-normal text-gray-500">{formatarPeriodoSemana()}</span>
            </h2>
            <Button variant="outline" onClick={irProximaSemana} disabled={semanaOffset >= 0 || loadingSemana}>
              Próxima <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          
          {loadingSemana ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : dadosSemana && dadosSemana.instaladores.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instalador</th>
                    {diasSemana.map(dia => (
                      <th key={dia.key} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[120px]">
                        {dia.label}<br />
                        <span className="text-[10px] text-gray-400 font-normal">{getDataDia(dia.key)}</span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-gray-100 min-w-[130px]">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dadosSemana.instaladores.map((instalador, idx) => (
                    <tr key={instalador.instalador_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{instalador.instalador_nome}</td>
                      {diasSemana.map(dia => (
                        <td key={dia.key} className="px-4 py-3">
                          <CelulaSemanal dados={instalador.dias[dia.key]} />
                        </td>
                      ))}
                      <td className="px-4 py-3 bg-gray-100">
                        <div className="text-center">
                          <div className="text-blue-600 text-sm">
                            📋 {instalador.total_atribuidos} - {formatarValorCurto(instalador.total_atribuidos_valor)}
                          </div>
                          <div className="text-green-600 text-sm font-bold">
                            ✅ {instalador.total_realizados} - {formatarValorCurto(instalador.total_realizados_valor)}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-200 font-bold">
                  <tr>
                    <td className="px-4 py-3 font-bold text-gray-900">TOTAL</td>
                    {diasSemana.map(dia => {
                      const totalDiaAtribuidos = dadosSemana.instaladores.reduce((sum, inst) => sum + (inst.dias[dia.key]?.atribuidos || 0), 0);
                      const totalDiaAtribuidosValor = dadosSemana.instaladores.reduce((sum, inst) => sum + (inst.dias[dia.key]?.atribuidos_valor || 0), 0);
                      const totalDiaRealizados = dadosSemana.instaladores.reduce((sum, inst) => sum + (inst.dias[dia.key]?.realizados || 0), 0);
                      const totalDiaRealizadosValor = dadosSemana.instaladores.reduce((sum, inst) => sum + (inst.dias[dia.key]?.realizados_valor || 0), 0);
                      return (
                        <td key={dia.key} className="px-4 py-3">
                          <div className="text-center">
                            <div className="text-blue-700 text-sm">📋 {totalDiaAtribuidos} - {formatarValorCurto(totalDiaAtribuidosValor)}</div>
                            <div className="text-green-700 text-sm">✅ {totalDiaRealizados} - {formatarValorCurto(totalDiaRealizadosValor)}</div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 bg-gray-300">
                      <div className="text-center">
                        <div className="text-blue-700 text-sm">
                          📋 {dadosSemana.instaladores.reduce((sum, inst) => sum + inst.total_atribuidos, 0)} - {formatarValorCurto(dadosSemana.instaladores.reduce((sum, inst) => sum + inst.total_atribuidos_valor, 0))}
                        </div>
                        <div className="text-green-700 text-sm">
                          ✅ {dadosSemana.instaladores.reduce((sum, inst) => sum + inst.total_realizados, 0)} - {formatarValorCurto(dadosSemana.instaladores.reduce((sum, inst) => sum + inst.total_realizados_valor, 0))}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Nenhum serviço nesta semana
            </div>
          )}

          {/* Legenda */}
          <div className="mt-4 flex items-center justify-center gap-6 text-sm text-gray-600">
            <span>📋 = Atribuídos (agendados)</span>
            <span>✅ = Realizados (concluídos)</span>
          </div>
        </div>

        {/* Últimos Serviços */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">📦 Últimos Serviços</h2>
          {ultimosServicos.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhum serviço registrado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instalador</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ultimosServicos.map((servico, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{servico.codigo}</td>
                      <td className="px-4 py-3 text-sm">{servico.cliente_nome}</td>
                      <td className="px-4 py-3 text-sm">{servico.instalador_nome || '-'}</td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(servico.status)}</td>
                      <td className="px-4 py-3 text-sm">
                        {formatarDataBR(servico.data_servico_agendada)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
