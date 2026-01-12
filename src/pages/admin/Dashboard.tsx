import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { Link } from 'react-router-dom'
import { DollarSign, Package, Users, FileText, TrendingUp, ChevronRight, Plus, CheckCircle, BarChart3 } from 'lucide-react'
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
  quantidade: number
  valor: number
}

interface DadosInstaladorSemana {
  instalador_id: string
  instalador_nome: string
  dias: Record<number, DadoInstaladorDia> // 1=seg, 2=ter, ..., 6=sab
  total_quantidade: number
  total_valor: number
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
  const [servicosDisponiveis, setServicosDisponiveis] = useState(0)
  const [dadosSemana, setDadosSemana] = useState<DadosSemana | null>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    carregarDados()
  }, [])

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

      // Calcular semana atual (segunda a sábado)
      const hoje = new Date()
      const diaSemana = hoje.getDay()
      const inicioSemana = new Date(hoje)
      // Se for domingo (0), volta 6 dias para segunda anterior
      // Se for outro dia, volta (dia-1) para segunda
      inicioSemana.setDate(hoje.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
      inicioSemana.setHours(0, 0, 0, 0)

      const fimSemana = new Date(inicioSemana)
      fimSemana.setDate(inicioSemana.getDate() + 5) // Sábado
      fimSemana.setHours(23, 59, 59, 999)

      // Calcular número da semana
      const startOfYear = new Date(hoje.getFullYear(), 0, 1)
      const weekNumber = Math.ceil(((hoje.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)

      // Buscar serviços concluídos da semana
      const { data: servicosSemana } = await supabase
        .from('servicos')
        .select(`
          instalador_id,
          valor_total,
          data_servico_agendada,
          instalador:usuarios!fk_servicos_instalador(nome)
        `)
        .eq('empresa_id', userData.empresa_id)
        .eq('status', 'concluido')
        .gte('data_servico_agendada', inicioSemana.toISOString())
        .lte('data_servico_agendada', fimSemana.toISOString())
        .not('instalador_id', 'is', null)

      // Agrupar por instalador e dia
      const instaladoresMap: Record<string, DadosInstaladorSemana> = {}

      servicosSemana?.forEach((s: any) => {
        if (!s.instalador_id) return
        
        const dataServico = new Date(s.data_servico_agendada)
        const diaSemanaServico = dataServico.getDay() // 0=dom, 1=seg, ..., 6=sab

        if (!instaladoresMap[s.instalador_id]) {
          instaladoresMap[s.instalador_id] = {
            instalador_id: s.instalador_id,
            instalador_nome: s.instalador?.nome || 'Sem nome',
            dias: {},
            total_quantidade: 0,
            total_valor: 0
          }
        }

        if (!instaladoresMap[s.instalador_id].dias[diaSemanaServico]) {
          instaladoresMap[s.instalador_id].dias[diaSemanaServico] = { quantidade: 0, valor: 0 }
        }

        instaladoresMap[s.instalador_id].dias[diaSemanaServico].quantidade += 1
        instaladoresMap[s.instalador_id].dias[diaSemanaServico].valor += Number(s.valor_total) || 0
        instaladoresMap[s.instalador_id].total_quantidade += 1
        instaladoresMap[s.instalador_id].total_valor += Number(s.valor_total) || 0
      })

      setDadosSemana({
        numero_semana: weekNumber,
        inicio: inicioSemana,
        fim: fimSemana,
        instaladores: Object.values(instaladoresMap).sort((a, b) => b.total_valor - a.total_valor)
      })

    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const diasSemana = [
    { key: 1, label: 'segunda' },
    { key: 2, label: 'terça' },
    { key: 3, label: 'quarta' },
    { key: 4, label: 'quinta' },
    { key: 5, label: 'sexta' },
    { key: 6, label: 'sábado' }
  ]

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
          {dadosSemana && dadosSemana.instaladores.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3">📊 Semana {dadosSemana.numero_semana}</h2>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-gray-600 sticky left-0 bg-gray-50">Instalador</th>
                        {diasSemana.map(dia => (
                          <th key={dia.key} className="px-2 py-2 text-center font-medium text-gray-600 min-w-[60px]">
                            {dia.label.slice(0, 3)}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center font-medium text-gray-600 bg-gray-100">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dadosSemana.instaladores.map((instalador, idx) => (
                        <tr key={instalador.instalador_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-2 py-2 font-medium text-gray-900 sticky left-0 bg-inherit whitespace-nowrap">
                            {instalador.instalador_nome.split(' ')[0]}
                          </td>
                          {diasSemana.map(dia => {
                            const dados = instalador.dias[dia.key]
                            return (
                              <td key={dia.key} className="px-2 py-2 text-center">
                                {dados ? (
                                  <div>
                                    <div className="font-bold text-gray-900">{dados.quantidade}</div>
                                    <div className="text-gray-500 text-[10px]">{formatarValorCurto(dados.valor)}</div>
                                  </div>
                                ) : (
                                  <span className="text-gray-300">-</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="px-2 py-2 text-center bg-gray-100">
                            <div className="font-bold text-gray-900">{instalador.total_quantidade}</div>
                            <div className="text-green-600 text-[10px] font-medium">{formatarValorCurto(instalador.total_valor)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

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
        {dadosSemana && dadosSemana.instaladores.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">📊 Semana {dadosSemana.numero_semana} - Serviços por Instalador</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instalador</th>
                    {diasSemana.map(dia => (
                      <th key={dia.key} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        {dia.label}<br />
                        <span className="text-[10px] text-gray-400 font-normal">{getDataDia(dia.key)}</span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-gray-100">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dadosSemana.instaladores.map((instalador, idx) => (
                    <tr key={instalador.instalador_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{instalador.instalador_nome}</td>
                      {diasSemana.map(dia => {
                        const dados = instalador.dias[dia.key]
                        return (
                          <td key={dia.key} className="px-4 py-3 text-center">
                            {dados ? (
                              <div>
                                <span className="font-bold text-gray-900">{dados.quantidade}</span>
                                <span className="text-gray-500 mx-1">-</span>
                                <span className="text-green-600 font-medium">R${dados.valor.toFixed(0)}</span>
                              </div>
                            ) : (
                              <span className="text-gray-300">0 - R$0</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-center bg-gray-100">
                        <div className="font-bold text-gray-900">{instalador.total_quantidade} serviços</div>
                        <div className="text-green-600 font-medium">R${instalador.total_valor.toFixed(2)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
