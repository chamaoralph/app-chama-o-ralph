import { useState, useEffect } from 'react'
import { InstaladorLayout } from '@/components/layout/InstaladorLayout'
import { supabase } from '@/integrations/supabase/client'
import { Link } from 'react-router-dom'
import { Calendar, DollarSign, Package, TrendingUp, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Metricas {
  servicosHoje: number
  aReceberMes: number
  servicosConcluidosMes: number
  proximoServico: {
    codigo: string
    data: string
    cliente: string
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

      // Próximo serviço
      const { data: proximoServicoData } = await supabase
        .from('servicos')
        .select(`
          codigo,
          data_servico_agendada,
          cliente:clientes(nome)
        `)
        .eq('instalador_id', user.id)
        .in('status', ['atribuido', 'em_andamento'])
        .gte('data_servico_agendada', now.toISOString())
        .order('data_servico_agendada')
        .limit(1)
        .single()

      const proximoServico = proximoServicoData ? {
        codigo: proximoServicoData.codigo,
        data: proximoServicoData.data_servico_agendada,
        cliente: (proximoServicoData.cliente as any)?.nome || 'N/A'
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </InstaladorLayout>
    )
  }

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
