import { useState, useEffect } from 'react'
import { InstaladorLayout } from '@/components/layout/InstaladorLayout'
import { supabase } from '@/integrations/supabase/client'
import { DollarSign, Package, TrendingUp, CheckCircle, FileDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { subDays, format } from 'date-fns'

interface Servico {
  id: string
  codigo: string
  data_servico_agendada: string
  status: string
  tipo_servico: string[]
  valor_mao_obra_instalador: number
  valor_reembolso_despesas: number
  cliente_nome: string
  cliente_telefone: string
}

export default function MeuExtrato() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [tipoPeriodo, setTipoPeriodo] = useState('ultimo_mes')

  // Cálculos dos cards
  const aReceber = servicos
    .filter(s => s.status === 'aguardando_aprovacao')
    .reduce((sum, s) => sum + s.valor_mao_obra_instalador + s.valor_reembolso_despesas, 0)

  const jaRecebido = servicos
    .filter(s => s.status === 'concluido')
    .reduce((sum, s) => sum + s.valor_mao_obra_instalador + s.valor_reembolso_despesas, 0)

  const totalServicos = servicos.length

  const totalGanho = servicos.reduce(
    (sum, s) => sum + s.valor_mao_obra_instalador + s.valor_reembolso_despesas,
    0
  )

  useEffect(() => {
    carregarServicos()
  }, [filtroStatus, tipoPeriodo])

  async function carregarServicos() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('servicos')
        .select(`
          *,
          cliente:clientes(nome, telefone)
        `)
        .eq('instalador_id', user.id)

      // Aplicar filtro de status
      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus)
      }

      // Aplicar filtro de período
      const hoje = new Date()
      let dataInicio: Date | null = null
      
      switch(tipoPeriodo) {
        case 'ultima_semana':
          dataInicio = subDays(hoje, 7)
          break
        case 'ultimo_mes':
          dataInicio = subDays(hoje, 30)
          break
        case 'ultimos_3_meses':
          dataInicio = subDays(hoje, 90)
          break
        case 'ultimos_6_meses':
          dataInicio = subDays(hoje, 180)
          break
        case 'todos':
          dataInicio = null
          break
      }
      
      if (dataInicio) {
        query = query
          .gte('data_servico_agendada', dataInicio.toISOString())
          .lte('data_servico_agendada', hoje.toISOString())
      }

      const { data, error } = await query.order('data_servico_agendada', { ascending: false })

      if (error) throw error

      const servicosFormatados = data?.map((s: any) => ({
        id: s.id,
        codigo: s.codigo,
        data_servico_agendada: s.data_servico_agendada,
        status: s.status,
        tipo_servico: s.tipo_servico,
        valor_mao_obra_instalador: s.valor_mao_obra_instalador || 0,
        valor_reembolso_despesas: s.valor_reembolso_despesas || 0,
        cliente_nome: s.cliente?.nome || 'N/A',
        cliente_telefone: s.cliente?.telefone || 'N/A',
      })) || []

      setServicos(servicosFormatados)
    } catch (error) {
      console.error('Erro ao carregar serviços:', error)
    } finally {
      setLoading(false)
    }
  }

  function getStatusBadge(status: string) {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'atribuido': { label: 'Atribuído', variant: 'secondary' },
      'em_andamento': { label: 'Em Andamento', variant: 'default' },
      'aguardando_aprovacao': { label: 'Aguardando Aprovação', variant: 'outline' },
      'concluido': { label: 'Concluído', variant: 'default' }
    }
    const config = statusMap[status] || { label: status, variant: 'outline' }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  function exportarCSV() {
    const headers = ['Data', 'Código', 'Cliente', 'Status', 'Tipo de Serviço', 'Mão de Obra', 'Reembolso', 'Total']
    
    const rows = servicosFiltrados.map(s => [
      format(new Date(s.data_servico_agendada), 'dd/MM/yyyy'),
      s.codigo,
      s.cliente_nome,
      s.status,
      s.tipo_servico.join('; '),
      s.valor_mao_obra_instalador.toFixed(2),
      s.valor_reembolso_despesas.toFixed(2),
      (s.valor_mao_obra_instalador + s.valor_reembolso_despesas).toFixed(2)
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `extrato_servicos_${format(new Date(), 'yyyy-MM-dd')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const servicosFiltrados = servicos

  return (
    <InstaladorLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">💰 Meu Extrato</h1>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-8 w-8" />
              <span className="text-3xl opacity-30">💰</span>
            </div>
            <div className="text-2xl font-bold">R$ {aReceber.toFixed(2)}</div>
            <div className="text-sm opacity-90">Aguardando Aprovação</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="h-8 w-8" />
              <span className="text-3xl opacity-30">✅</span>
            </div>
            <div className="text-2xl font-bold">R$ {jaRecebido.toFixed(2)}</div>
            <div className="text-sm opacity-90">Já Recebido</div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <Package className="h-8 w-8" />
              <span className="text-3xl opacity-30">📦</span>
            </div>
            <div className="text-2xl font-bold">{totalServicos}</div>
            <div className="text-sm opacity-90">Total de Serviços</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-8 w-8" />
              <span className="text-3xl opacity-30">💵</span>
            </div>
            <div className="text-2xl font-bold">R$ {totalGanho.toFixed(2)}</div>
            <div className="text-sm opacity-90">Total Ganho (Histórico)</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-2">Status</label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="atribuido">Atribuído</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="aguardando_aprovacao">Aguardando Aprovação</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-2">Período</label>
              <Select value={tipoPeriodo} onValueChange={setTipoPeriodo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ultima_semana">Última Semana</SelectItem>
                  <SelectItem value="ultimo_mes">Último Mês</SelectItem>
                  <SelectItem value="ultimos_3_meses">Últimos 3 Meses</SelectItem>
                  <SelectItem value="ultimos_6_meses">Últimos 6 Meses</SelectItem>
                  <SelectItem value="todos">Todos os Períodos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={exportarCSV}
              className="flex items-center gap-2"
              disabled={servicosFiltrados.length === 0}
            >
              <FileDown className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : servicosFiltrados.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum serviço encontrado neste período</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mão de Obra</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reembolso</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {servicosFiltrados.map((servico) => {
                      const total = servico.valor_mao_obra_instalador + servico.valor_reembolso_despesas
                      return (
                        <tr key={servico.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">
                            {new Date(servico.data_servico_agendada).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">{servico.codigo}</td>
                          <td className="px-4 py-3 text-sm">{servico.cliente_nome}</td>
                          <td className="px-4 py-3 text-sm">{getStatusBadge(servico.status)}</td>
                          <td className="px-4 py-3 text-sm">{servico.tipo_servico.join(', ')}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            R$ {servico.valor_mao_obra_instalador.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            R$ {servico.valor_reembolso_despesas.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold">
                            R$ {total.toFixed(2)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-sm font-bold text-right">TOTAL:</td>
                      <td className="px-4 py-3 text-sm font-bold text-right">
                        R$ {servicosFiltrados.reduce((s, srv) => s + srv.valor_mao_obra_instalador, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-right">
                        R$ {servicosFiltrados.reduce((s, srv) => s + srv.valor_reembolso_despesas, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-right text-green-600">
                        R$ {servicosFiltrados.reduce((s, srv) => s + srv.valor_mao_obra_instalador + srv.valor_reembolso_despesas, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </InstaladorLayout>
  )
}
