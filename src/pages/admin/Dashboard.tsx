import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { Link } from 'react-router-dom'
import { DollarSign, Package, Users, FileText, AlertCircle, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Metricas {
  receitaMes: number
  servicosConcluidosMes: number
  instaladoresAtivos: number
  cotacoesPendentes: number
}

interface UltimoServico {
  codigo: string
  cliente_nome: string
  instalador_nome: string | null
  status: string
  data_servico_agendada: string
}

export default function AdminDashboard() {
  const [metricas, setMetricas] = useState<Metricas>({
    receitaMes: 0,
    servicosConcluidosMes: 0,
    instaladoresAtivos: 0,
    cotacoesPendentes: 0
  })
  const [ultimosServicos, setUltimosServicos] = useState<UltimoServico[]>([])
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

      // Calcular início do mês atual
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      // Receita do mês
      const { data: lancamentos } = await supabase
        .from('lancamentos_caixa')
        .select('valor')
        .eq('empresa_id', userData.empresa_id)
        .eq('tipo', 'receita')
        .gte('data_lancamento', startOfMonth.toISOString().split('T')[0])

      const receitaMes = lancamentos?.reduce((sum, l) => sum + Number(l.valor), 0) || 0

      // Serviços concluídos no mês
      const { data: servicos } = await supabase
        .from('servicos')
        .select('id')
        .eq('empresa_id', userData.empresa_id)
        .eq('status', 'concluido')
        .gte('updated_at', startOfMonth.toISOString())

      const servicosConcluidosMes = servicos?.length || 0

      // Instaladores ativos
      const { data: instaladores } = await supabase
        .from('usuarios')
        .select('id')
        .eq('empresa_id', userData.empresa_id)
        .eq('tipo', 'instalador')
        .eq('ativo', true)

      const instaladoresAtivos = instaladores?.length || 0

      // Cotações pendentes (não confirmadas)
      const { data: cotacoes } = await supabase
        .from('cotacoes')
        .select('id')
        .eq('empresa_id', userData.empresa_id)
        .in('status', ['enviada', 'em_negociacao'])

      const cotacoesPendentes = cotacoes?.length || 0

      // Serviços aguardando distribuição
      const { data: servicosDisp } = await supabase
        .from('servicos')
        .select('id')
        .eq('empresa_id', userData.empresa_id)
        .eq('status', 'aguardando_distribuicao')

      setServicosDisponiveis(servicosDisp?.length || 0)

      setMetricas({
        receitaMes,
        servicosConcluidosMes,
        instaladoresAtivos,
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    )
  }

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
              <Users className="h-8 w-8" />
              <span className="text-3xl opacity-30">👷</span>
            </div>
            <div className="text-2xl font-bold">{metricas.instaladoresAtivos}</div>
            <div className="text-sm opacity-90">Instaladores Ativos</div>
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
                        {new Date(servico.data_servico_agendada).toLocaleDateString('pt-BR')}
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
