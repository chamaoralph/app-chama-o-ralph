import { useState, useEffect } from 'react'
import { InstaladorLayout } from '@/components/layout/InstaladorLayout'
import { supabase } from '@/integrations/supabase/client'
import { Link } from 'react-router-dom'
import { Calendar, DollarSign, Package, TrendingUp, Clock, ChevronRight, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useIsMobile } from '@/hooks/use-mobile'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Metricas {
  servicosHoje: number
  aReceberMes: number
  servicosConcluidosMes: number
  proximoServico: {
    id: string
    codigo: string
    data: string
    cliente: string
    endereco: string
    valor: number
  } | null
}

export default function InstaladorDashboard() {
  const [metricas, setMetricas] = useState<Metricas>({
    servicosHoje: 0,
    aReceberMes: 0,
    servicosConcluidosMes: 0,
    proximoServico: null
  })
  const [loading, setLoading] = useState(true)
  const [servicosDisponiveis, setServicosDisponiveis] = useState(0)
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
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endOfDay = new Date(today)
      endOfDay.setHours(23, 59, 59, 999)

      // Serviços hoje
      const { data: servicosHojeData } = await supabase
        .from('servicos')
        .select('id')
        .eq('instalador_id', user.id)
        .gte('data_servico_agendada', today.toISOString())
        .lte('data_servico_agendada', endOfDay.toISOString())

      const servicosHoje = servicosHojeData?.length || 0

      // A receber este mês
      const { data: servicosMes } = await supabase
        .from('servicos')
        .select('valor_mao_obra_instalador, valor_reembolso_despesas')
        .eq('instalador_id', user.id)
        .eq('status', 'aguardando_aprovacao')
        .gte('data_servico_agendada', startOfMonth.toISOString())

      const aReceberMes = servicosMes?.reduce((sum, s) => 
        sum + Number(s.valor_mao_obra_instalador || 0) + Number(s.valor_reembolso_despesas || 0), 0
      ) || 0

      // Serviços concluídos este mês
      const { data: servicosConcluidosData } = await supabase
        .from('servicos')
        .select('id')
        .eq('instalador_id', user.id)
        .eq('status', 'concluido')
        .gte('updated_at', startOfMonth.toISOString())

      const servicosConcluidosMes = servicosConcluidosData?.length || 0

      // Próximo serviço com mais detalhes
      const { data: proximoServicoData } = await supabase
        .from('servicos')
        .select(`
          id,
          codigo,
          data_servico_agendada,
          endereco_completo,
          valor_mao_obra_instalador,
          cliente:clientes(nome)
        `)
        .eq('instalador_id', user.id)
        .in('status', ['atribuido', 'em_andamento'])
        .gte('data_servico_agendada', now.toISOString())
        .order('data_servico_agendada')
        .limit(1)
        .single()

      const proximoServico = proximoServicoData ? {
        id: proximoServicoData.id,
        codigo: proximoServicoData.codigo,
        data: proximoServicoData.data_servico_agendada,
        cliente: (proximoServicoData.cliente as any)?.nome || 'N/A',
        endereco: proximoServicoData.endereco_completo || '',
        valor: proximoServicoData.valor_mao_obra_instalador || 0
      } : null

      // Serviços disponíveis
      const { data: servicosDispData } = await supabase
        .from('servicos')
        .select('id')
        .eq('empresa_id', userData.empresa_id)
        .eq('status', 'disponivel')

      setServicosDisponiveis(servicosDispData?.length || 0)

      setMetricas({
        servicosHoje,
        aReceberMes,
        servicosConcluidosMes,
        proximoServico
      })

    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <InstaladorLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </InstaladorLayout>
    )
  }

  // Layout Mobile
  if (isMobile) {
    return (
      <InstaladorLayout>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Olá! 👋</h1>

          {/* Próximo Serviço em Destaque */}
          {metricas.proximoServico && (
            <Link to="/instalador/minha-agenda">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm opacity-90">Próximo Serviço</span>
                  <ChevronRight className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold mb-1">{metricas.proximoServico.codigo}</h3>
                <p className="text-sm opacity-90 mb-2">👤 {metricas.proximoServico.cliente}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    📅 {format(new Date(metricas.proximoServico.data), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                    R$ {metricas.proximoServico.valor.toFixed(0)}
                  </span>
                </div>
              </div>
            </Link>
          )}

          {/* Métricas em Scroll Horizontal */}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-4 min-w-[140px] flex-shrink-0">
              <DollarSign className="h-6 w-6 mb-2 opacity-80" />
              <div className="text-xl font-bold">R$ {metricas.aReceberMes.toFixed(0)}</div>
              <div className="text-xs opacity-90">A Receber</div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-4 min-w-[140px] flex-shrink-0">
              <Package className="h-6 w-6 mb-2 opacity-80" />
              <div className="text-xl font-bold">{metricas.servicosConcluidosMes}</div>
              <div className="text-xs opacity-90">Concluídos</div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-4 min-w-[140px] flex-shrink-0">
              <Calendar className="h-6 w-6 mb-2 opacity-80" />
              <div className="text-xl font-bold">{metricas.servicosHoje}</div>
              <div className="text-xs opacity-90">Serviços Hoje</div>
            </div>
          </div>

          {/* Ação Principal - Serviços Disponíveis */}
          <Link to="/instalador/servicos-disponiveis">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-3 rounded-full">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Serviços Disponíveis</h3>
                  <p className="text-sm text-gray-500">Novos trabalhos para você</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {servicosDisponiveis > 0 && (
                  <Badge className="bg-green-500 text-white">{servicosDisponiveis}</Badge>
                )}
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </Link>

          {/* Ações Rápidas */}
          <div className="grid grid-cols-2 gap-3">
            <Link to="/instalador/minha-agenda">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center hover:shadow-md transition-shadow">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">Minha Agenda</span>
              </div>
            </Link>
            <Link to="/instalador/extrato">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center hover:shadow-md transition-shadow">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Meu Extrato</span>
              </div>
            </Link>
          </div>
        </div>
      </InstaladorLayout>
    )
  }

  // Layout Desktop (original)
  return (
    <InstaladorLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Meu Dashboard</h1>

        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="h-8 w-8" />
              <span className="text-3xl opacity-30">📅</span>
            </div>
            <div className="text-2xl font-bold">{metricas.servicosHoje}</div>
            <div className="text-sm opacity-90">Serviços Hoje</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-8 w-8" />
              <span className="text-3xl opacity-30">💰</span>
            </div>
            <div className="text-2xl font-bold">R$ {metricas.aReceberMes.toFixed(2)}</div>
            <div className="text-sm opacity-90">A Receber este Mês</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <Package className="h-8 w-8" />
              <span className="text-3xl opacity-30">📦</span>
            </div>
            <div className="text-2xl font-bold">{metricas.servicosConcluidosMes}</div>
            <div className="text-sm opacity-90">Concluídos este Mês</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-8 w-8" />
              <span className="text-3xl opacity-30">⏰</span>
            </div>
            {metricas.proximoServico ? (
              <>
                <div className="text-lg font-bold">{metricas.proximoServico.codigo}</div>
                <div className="text-xs opacity-90">
                  {new Date(metricas.proximoServico.data).toLocaleDateString('pt-BR')}
                </div>
              </>
            ) : (
              <div className="text-sm opacity-90">Nenhum próximo</div>
            )}
            <div className="text-xs opacity-75 mt-1">Próximo Serviço</div>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            Ações Rápidas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/instalador/servicos-disponiveis">
              <Button className="w-full h-20 text-lg bg-blue-600 hover:bg-blue-700 relative">
                🆕 Ver Serviços Disponíveis
                {servicosDisponiveis > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-green-500">
                    {servicosDisponiveis}
                  </Badge>
                )}
              </Button>
            </Link>
            <Link to="/instalador/minha-agenda">
              <Button className="w-full h-20 text-lg bg-purple-600 hover:bg-purple-700">
                📅 Minha Agenda
              </Button>
            </Link>
            <Link to="/instalador/extrato">
              <Button className="w-full h-20 text-lg bg-green-600 hover:bg-green-700">
                💰 Meu Extrato
              </Button>
            </Link>
          </div>
        </div>

        {/* Próximo Serviço Detalhado */}
        {metricas.proximoServico && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">⏰ Próximo Serviço</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm opacity-90">Código</div>
                <div className="text-xl font-bold">{metricas.proximoServico.codigo}</div>
              </div>
              <div>
                <div className="text-sm opacity-90">Cliente</div>
                <div className="text-xl font-bold">{metricas.proximoServico.cliente}</div>
              </div>
              <div>
                <div className="text-sm opacity-90">Data</div>
                <div className="text-xl font-bold">
                  {new Date(metricas.proximoServico.data).toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </InstaladorLayout>
  )
}
