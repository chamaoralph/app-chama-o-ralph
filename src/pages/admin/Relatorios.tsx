import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { DollarSign, TrendingUp, TrendingDown, Award } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ResumoMensal {
  receitaBruta: number
  pagamentoInstaladores: number
  outrasDespesas: number
  lucroLiquido: number
}

interface TopInstalador {
  posicao: number
  nome: string
  qtdServicos: number
  totalGanho: number
}

interface ServicosPorStatus {
  aguardando_distribuicao: number
  disponivel: number
  atribuido: number
  em_andamento: number
  aguardando_aprovacao: number
  concluido: number
}

export default function Relatorios() {
  const [mesAno, setMesAno] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)
  const [resumoMensal, setResumoMensal] = useState<ResumoMensal>({
    receitaBruta: 0,
    pagamentoInstaladores: 0,
    outrasDespesas: 0,
    lucroLiquido: 0
  })
  const [topInstaladores, setTopInstaladores] = useState<TopInstalador[]>([])
  const [servicosPorStatus, setServicosPorStatus] = useState<ServicosPorStatus>({
    aguardando_distribuicao: 0,
    disponivel: 0,
    atribuido: 0,
    em_andamento: 0,
    aguardando_aprovacao: 0,
    concluido: 0
  })

  useEffect(() => {
    carregarDados()
  }, [mesAno])

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

      const [year, month] = mesAno.split('-')
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59)

      // Buscar resumo financeiro do mês
      const { data: lancamentos } = await supabase
        .from('lancamentos_caixa')
        .select('tipo, categoria, valor')
        .eq('empresa_id', userData.empresa_id)
        .gte('data_lancamento', startDate.toISOString().split('T')[0])
        .lte('data_lancamento', endDate.toISOString().split('T')[0])

      const receitaBruta = lancamentos
        ?.filter(l => l.tipo === 'receita')
        .reduce((sum, l) => sum + Number(l.valor), 0) || 0

      const pagamentoInstaladores = lancamentos
        ?.filter(l => l.categoria === 'Pagamento Instalador')
        .reduce((sum, l) => sum + Number(l.valor), 0) || 0

      const outrasDespesas = lancamentos
        ?.filter(l => l.tipo === 'despesa' && l.categoria !== 'Pagamento Instalador')
        .reduce((sum, l) => sum + Number(l.valor), 0) || 0

      const lucroLiquido = receitaBruta - pagamentoInstaladores - outrasDespesas

      setResumoMensal({
        receitaBruta,
        pagamentoInstaladores,
        outrasDespesas,
        lucroLiquido
      })

      // Buscar top 5 instaladores do mês
      const { data: servicos } = await supabase
        .from('servicos')
        .select(`
          instalador_id,
          valor_mao_obra_instalador,
          status,
          updated_at,
          instalador:usuarios!servicos_instalador_id_fkey(nome)
        `)
        .eq('empresa_id', userData.empresa_id)
        .eq('status', 'concluido')
        .gte('updated_at', startDate.toISOString())
        .lte('updated_at', endDate.toISOString())

      // Agrupar por instalador
      const instaladoresMap = new Map()
      servicos?.forEach((s: any) => {
        const id = s.instalador_id
        if (!id) return
        
        if (!instaladoresMap.has(id)) {
          instaladoresMap.set(id, {
            nome: s.instalador?.nome || 'N/A',
            qtdServicos: 0,
            totalGanho: 0
          })
        }
        
        const inst = instaladoresMap.get(id)
        inst.qtdServicos++
        inst.totalGanho += Number(s.valor_mao_obra_instalador || 0)
      })

      const topInstaladores = Array.from(instaladoresMap.values())
        .sort((a, b) => b.totalGanho - a.totalGanho)
        .slice(0, 5)
        .map((inst, idx) => ({
          posicao: idx + 1,
          nome: inst.nome,
          qtdServicos: inst.qtdServicos,
          totalGanho: inst.totalGanho
        }))

      setTopInstaladores(topInstaladores)

      // Buscar serviços por status (todos, não só do mês)
      const { data: todosServicos } = await supabase
        .from('servicos')
        .select('status')
        .eq('empresa_id', userData.empresa_id)

      const statusCounts: ServicosPorStatus = {
        aguardando_distribuicao: 0,
        disponivel: 0,
        atribuido: 0,
        em_andamento: 0,
        aguardando_aprovacao: 0,
        concluido: 0
      }

      todosServicos?.forEach(s => {
        if (s.status in statusCounts) {
          statusCounts[s.status as keyof ServicosPorStatus]++
        }
      })

      setServicosPorStatus(statusCounts)

    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">📊 Relatórios Financeiros</h1>

        {/* Filtro de Mês */}
        <div className="bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium mb-2">Selecionar Mês/Ano</label>
          <input
            type="month"
            value={mesAno}
            onChange={(e) => setMesAno(e.target.value)}
            className="px-3 py-2 border rounded-md"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <>
            {/* SEÇÃO 1 - RESUMO MENSAL */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-600 to-green-700 text-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="h-8 w-8" />
                  <span className="text-3xl opacity-30">💰</span>
                </div>
                <div className="text-2xl font-bold">R$ {resumoMensal.receitaBruta.toFixed(2)}</div>
                <div className="text-sm opacity-90">Receita Bruta</div>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <TrendingDown className="h-8 w-8" />
                  <span className="text-3xl opacity-30">👷</span>
                </div>
                <div className="text-2xl font-bold">R$ {resumoMensal.pagamentoInstaladores.toFixed(2)}</div>
                <div className="text-sm opacity-90">Pagamento Instaladores</div>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <TrendingDown className="h-8 w-8" />
                  <span className="text-3xl opacity-30">💸</span>
                </div>
                <div className="text-2xl font-bold">R$ {resumoMensal.outrasDespesas.toFixed(2)}</div>
                <div className="text-sm opacity-90">Outras Despesas</div>
              </div>

              <div className={`bg-gradient-to-br ${resumoMensal.lucroLiquido >= 0 ? 'from-blue-500 to-blue-600' : 'from-red-600 to-red-700'} text-white rounded-lg shadow-lg p-6`}>
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="h-8 w-8" />
                  <span className="text-3xl opacity-30">💵</span>
                </div>
                <div className="text-2xl font-bold">R$ {resumoMensal.lucroLiquido.toFixed(2)}</div>
                <div className="text-sm opacity-90">Lucro Líquido</div>
              </div>
            </div>

            {/* SEÇÃO 2 - TOP 5 INSTALADORES */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Award className="h-6 w-6 text-yellow-500" />
                Top 5 Instaladores do Mês
              </h2>
              {topInstaladores.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nenhum serviço concluído neste mês</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Posição</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qtd Serviços</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Ganho</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {topInstaladores.map((inst) => (
                        <tr key={inst.posicao} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-bold">
                            {inst.posicao === 1 ? '🏆 #1' : `#${inst.posicao}`}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">{inst.nome}</td>
                          <td className="px-4 py-3 text-sm text-right">{inst.qtdServicos}</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                            R$ {inst.totalGanho.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SEÇÃO 3 - SERVIÇOS POR STATUS */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">📦 Serviços por Status</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {servicosPorStatus.aguardando_distribuicao}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Aguardando Distribuição</div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {servicosPorStatus.disponivel}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Disponíveis</div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {servicosPorStatus.atribuido}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Atribuídos</div>
                </div>

                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {servicosPorStatus.em_andamento}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Em Andamento</div>
                </div>

                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">
                    {servicosPorStatus.aguardando_aprovacao}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Aguardando Aprovação</div>
                </div>

                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {servicosPorStatus.concluido}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Concluídos</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
