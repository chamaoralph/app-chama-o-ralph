import { useState, useEffect } from 'react'
import { InstaladorLayout } from '@/components/layout/InstaladorLayout'
import { supabase } from '@/integrations/supabase/client'
import { DollarSign, Package, TrendingUp, CheckCircle, FileDown, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { subDays, format } from 'date-fns'
import { GerarReciboModal } from '@/components/instalador/GerarReciboModal'
import { formatarDataBR } from '@/lib/utils'

interface Servico {
  id: string
  codigo: string
  data_servico_agendada: string
  data_conclusao: string | null
  updated_at: string
  status: string
  tipo_servico: string[]
  valor_mao_obra_instalador: number
  valor_reembolso_despesas: number
  custo_suporte: number
  valor_recebido_cliente: number
  recebimento_cliente: string | null
  cliente_nome: string
  cliente_telefone: string
}

export default function MeuExtrato() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [tipoPeriodo, setTipoPeriodo] = useState('ultimo_mes')
  const [dataPersonalizadaDe, setDataPersonalizadaDe] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dataPersonalizadaAte, setDataPersonalizadaAte] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [modalReciboOpen, setModalReciboOpen] = useState(false)
  const [instaladorNome, setInstaladorNome] = useState('')
  const [dataRecibo, setDataRecibo] = useState<Date>(new Date())
  const [recibosGerados, setRecibosGerados] = useState<string[]>([])

  // Verificar se recibo já foi gerado para data selecionada
  const dataSelecionadaStr = format(dataRecibo, 'yyyy-MM-dd')
  const reciboJaGerado = recibosGerados.includes(dataSelecionadaStr)

  // Serviços da data selecionada (para o recibo) - usa data_conclusao convertida para fuso de Brasília
  const servicosDataSelecionada = servicos.filter(s => {
    if (!s.data_conclusao || s.status !== 'concluido') return false
    const dataConclusaoBR = new Date(s.data_conclusao).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    return dataConclusaoBR === dataSelecionadaStr
  })

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
    carregarNomeInstalador()
    carregarRecibosGerados()
  }, [filtroStatus, tipoPeriodo, dataPersonalizadaDe, dataPersonalizadaAte])

  async function carregarRecibosGerados() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('recibos_diarios')
        .select('data_referencia')
        .eq('instalador_id', user.id)

      if (data) {
        setRecibosGerados(data.map(r => r.data_referencia))
      }
    } catch (error) {
      console.error('Erro ao carregar recibos gerados:', error)
    }
  }

  function handleReciboGerado() {
    // Adiciona a data do recibo à lista de recibos gerados
    setRecibosGerados(prev => [...prev, dataSelecionadaStr])
    setModalReciboOpen(false)
  }

  async function carregarNomeInstalador() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', user.id)
        .single()

      if (data) {
        setInstaladorNome(data.nome)
      }
    } catch (error) {
      console.error('Erro ao carregar nome:', error)
    }
  }

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
        case 'personalizado':
          if (dataPersonalizadaDe && dataPersonalizadaAte) {
            query = query
              .gte('data_servico_agendada', new Date(dataPersonalizadaDe + 'T00:00:00').toISOString())
              .lte('data_servico_agendada', new Date(dataPersonalizadaAte + 'T23:59:59').toISOString())
          }
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
        data_conclusao: s.data_conclusao,
        updated_at: s.updated_at,
        status: s.status,
        tipo_servico: s.tipo_servico,
        valor_mao_obra_instalador: s.valor_mao_obra_instalador || 0,
        valor_reembolso_despesas: s.valor_reembolso_despesas || 0,
        custo_suporte: s.custo_suporte || 0,
        valor_recebido_cliente: Number(s.valor_recebido_cliente) || 0,
        recebimento_cliente: s.recebimento_cliente || null,
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
      formatarDataBR(s.data_servico_agendada),
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
    link.setAttribute('download', `extrato_servicos_${format(new Date(), 'dd-MM-yyyy')}.csv`)
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
            <div className="text-sm opacity-90">Pendente de Aprovação</div>
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
                  <SelectItem value="personalizado">Período Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipoPeriodo === 'personalizado' && (
              <div className="flex-1 min-w-[300px]">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2">De</label>
                    <Input
                      type="date"
                      value={dataPersonalizadaDe}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      onChange={(e) => {
                        const val = e.target.value
                        setDataPersonalizadaDe(val)
                        if (val > dataPersonalizadaAte) setDataPersonalizadaAte(val)
                      }}
                    />
                  </div>
                  <span className="pb-2 text-muted-foreground">→</span>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2">Até</label>
                    <Input
                      type="date"
                      value={dataPersonalizadaAte}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      onChange={(e) => {
                        const val = e.target.value
                        setDataPersonalizadaAte(val)
                        if (val < dataPersonalizadaDe) setDataPersonalizadaDe(val)
                      }}
                    />
                  </div>
                </div>
                {dataPersonalizadaDe && dataPersonalizadaAte && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.round((new Date(dataPersonalizadaAte).getTime() - new Date(dataPersonalizadaDe).getTime()) / 86400000) + 1} dia(s) selecionado(s)
                  </p>
                )}
              </div>
            )}

            <Button 
              onClick={exportarCSV}
              variant="outline"
              className="flex items-center gap-2"
              disabled={servicosFiltrados.length === 0}
            >
              <FileDown className="h-4 w-4" />
              Exportar CSV
            </Button>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={format(dataRecibo, 'yyyy-MM-dd')}
                onChange={(e) => setDataRecibo(new Date(e.target.value + 'T12:00:00'))}
                max={format(new Date(), 'yyyy-MM-dd')}
                min={format(subDays(new Date(), 7), 'yyyy-MM-dd')}
                className="w-[160px]"
              />
              <Button
                onClick={() => setModalReciboOpen(true)}
                className="flex items-center gap-2"
                disabled={servicosDataSelecionada.length === 0}
                variant={reciboJaGerado ? 'outline' : 'default'}
              >
                <FileText className="h-4 w-4" />
                {reciboJaGerado ? `Regerar Recibo (${servicosDataSelecionada.length})` : `Gerar Recibo (${servicosDataSelecionada.length})`}
              </Button>
            </div>
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
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Recebido</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {servicosFiltrados.map((servico) => {
                      const total = servico.valor_mao_obra_instalador + servico.valor_reembolso_despesas
                      const recebido = servico.valor_recebido_cliente || 0
                      return (
                        <tr key={servico.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">
                            {formatarDataBR(servico.data_servico_agendada)}
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
                          <td className="px-4 py-3 text-sm text-right">
                            {recebido > 0 ? (
                              <span className="text-orange-600 font-medium">R$ {recebido.toFixed(2)}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold">
                            R$ {total.toFixed(2)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    {(() => {
                      const totalMO = servicosFiltrados.reduce((s, srv) => s + srv.valor_mao_obra_instalador, 0)
                      const totalReemb = servicosFiltrados.reduce((s, srv) => s + srv.valor_reembolso_despesas, 0)
                      const totalRecebido = servicosFiltrados.reduce((s, srv) => s + (srv.valor_recebido_cliente || 0), 0)
                      const totalBruto = totalMO + totalReemb
                      const saldo = totalBruto - totalRecebido
                      return (
                        <>
                          <tr>
                            <td colSpan={5} className="px-4 py-3 text-sm font-bold text-right">TOTAL:</td>
                            <td className="px-4 py-3 text-sm font-bold text-right">R$ {totalMO.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm font-bold text-right">R$ {totalReemb.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm font-bold text-right text-orange-600">
                              R$ {totalRecebido.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-right">R$ {totalBruto.toFixed(2)}</td>
                          </tr>
                          {totalRecebido > 0 && (
                            <tr className="border-t-2 border-gray-300">
                              <td colSpan={8} className="px-4 py-3 text-sm font-bold text-right">
                                {saldo >= 0 ? 'EMPRESA DEVE PAGAR:' : 'INSTALADOR DEVE DEVOLVER:'}
                              </td>
                              <td colSpan={2} className={`px-4 py-3 text-base font-bold text-right ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                R$ {Math.abs(saldo).toFixed(2)}
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })()}
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Modal de Recibo */}
        <GerarReciboModal
          open={modalReciboOpen}
          onOpenChange={setModalReciboOpen}
          servicos={servicosDataSelecionada.map(s => ({
            id: s.id,
            codigo: s.codigo,
            cliente_nome: s.cliente_nome,
            tipo_servico: s.tipo_servico,
            valor_mao_obra_instalador: s.valor_mao_obra_instalador,
            valor_reembolso_despesas: s.valor_reembolso_despesas,
            custo_suporte: s.custo_suporte || 0,
            valor_recebido_cliente: s.valor_recebido_cliente || 0,
            recebimento_cliente: s.recebimento_cliente,
          }))}
          dataReferencia={dataRecibo}
          instaladorNome={instaladorNome}
          onReciboGerado={handleReciboGerado}
        />
      </div>
    </InstaladorLayout>
  )
}
