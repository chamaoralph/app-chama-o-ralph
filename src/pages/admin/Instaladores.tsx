import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { Users, UserCheck, UserX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { PagamentosInstaladores } from '@/components/admin/PagamentosInstaladores'
import { formatarDataBR } from '@/lib/utils'
interface Instalador {
  id: string
  nome: string
  telefone: string
  ativo: boolean
  total_servicos: number
  total_ganho: number
}

interface ServicoHistorico {
  codigo: string
  data_servico_agendada: string
  cliente_nome: string
  status: string
  valor: number
}

export default function Instaladores() {
  const [instaladores, setInstaladores] = useState<Instalador[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [modalHistorico, setModalHistorico] = useState(false)
  const [instaladorSelecionado, setInstaladorSelecionado] = useState<Instalador | null>(null)
  const [historico, setHistorico] = useState<ServicoHistorico[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  const totalInstaladores = instaladores.length
  const totalAtivos = instaladores.filter(i => i.ativo).length
  const totalInativos = instaladores.filter(i => !i.ativo).length

  useEffect(() => {
    carregarInstaladores()
  }, [])

  async function carregarInstaladores() {
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

      // Buscar todos instaladores
      const { data: instaladoresData, error: instaladoresError } = await supabase
        .from('usuarios')
        .select('id, nome, telefone, ativo')
        .eq('tipo', 'instalador')
        .eq('empresa_id', userData.empresa_id)
        .order('nome')

      if (instaladoresError) throw instaladoresError

      // Para cada instalador, buscar estatísticas
      const instaladoresComEstatisticas = await Promise.all(
        (instaladoresData || []).map(async (inst) => {
          const { data: servicos } = await supabase
            .from('servicos')
            .select('id, valor_mao_obra_instalador, status')
            .eq('instalador_id', inst.id)

          const totalServicos = servicos?.length || 0
          const totalGanho = servicos
            ?.filter(s => s.status === 'concluido')
            .reduce((sum, s) => sum + (s.valor_mao_obra_instalador || 0), 0) || 0

          return {
            id: inst.id,
            nome: inst.nome,
            telefone: inst.telefone || 'N/A',
            ativo: inst.ativo,
            total_servicos: totalServicos,
            total_ganho: totalGanho
          }
        })
      )

      setInstaladores(instaladoresComEstatisticas)
    } catch (error) {
      console.error('Erro ao carregar instaladores:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os instaladores',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  async function toggleAtivo(instaladorId: string, ativoAtual: boolean) {
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ ativo: !ativoAtual })
        .eq('id', instaladorId)

      if (error) throw error

      toast({
        title: 'Sucesso',
        description: `Instalador ${!ativoAtual ? 'ativado' : 'desativado'} com sucesso`
      })

      carregarInstaladores()
    } catch (error) {
      console.error('Erro ao atualizar instalador:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o instalador',
        variant: 'destructive'
      })
    }
  }

  async function abrirHistorico(instalador: Instalador) {
    setInstaladorSelecionado(instalador)
    setModalHistorico(true)
    setLoadingHistorico(true)

    try {
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          codigo,
          data_servico_agendada,
          status,
          valor_mao_obra_instalador,
          cliente:clientes(nome)
        `)
        .eq('instalador_id', instalador.id)
        .order('data_servico_agendada', { ascending: false })

      if (error) throw error

      const historicoFormatado = data?.map((s: any) => ({
        codigo: s.codigo,
        data_servico_agendada: s.data_servico_agendada,
        cliente_nome: s.cliente?.nome || 'N/A',
        status: s.status,
        valor: s.valor_mao_obra_instalador || 0
      })) || []

      setHistorico(historicoFormatado)
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o histórico',
        variant: 'destructive'
      })
    } finally {
      setLoadingHistorico(false)
    }
  }

  const instaladoresFiltrados = instaladores.filter(inst => {
    if (filtroStatus === 'todos') return true
    if (filtroStatus === 'ativos') return inst.ativo
    if (filtroStatus === 'inativos') return !inst.ativo
    return true
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">👷 Gestão de Instaladores</h1>

        <Tabs defaultValue="lista" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="lista">Lista de Instaladores</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-6 mt-6">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <Users className="h-8 w-8" />
                  <span className="text-3xl opacity-30">👷</span>
                </div>
                <div className="text-2xl font-bold">{totalInstaladores}</div>
                <div className="text-sm opacity-90">Total de Instaladores</div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <UserCheck className="h-8 w-8" />
                  <span className="text-3xl opacity-30">✅</span>
                </div>
                <div className="text-2xl font-bold">{totalAtivos}</div>
                <div className="text-sm opacity-90">Instaladores Ativos</div>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <UserX className="h-8 w-8" />
                  <span className="text-3xl opacity-30">❌</span>
                </div>
                <div className="text-2xl font-bold">{totalInativos}</div>
                <div className="text-sm opacity-90">Instaladores Inativos</div>
              </div>
            </div>

            {/* Filtro */}
            <div className="bg-card rounded-lg shadow p-4">
              <label className="block text-sm font-medium mb-2">Filtrar por Status</label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background"
              >
                <option value="todos">Todos</option>
                <option value="ativos">Ativos</option>
                <option value="inativos">Inativos</option>
              </select>
            </div>

            {/* Tabela */}
            <div className="bg-card rounded-lg shadow overflow-hidden">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Nome</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Telefone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Qtd Serviços</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total Ganho</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {instaladoresFiltrados.map((instalador) => (
                        <tr key={instalador.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 text-sm font-medium">{instalador.nome}</td>
                          <td className="px-4 py-3 text-sm">{instalador.telefone}</td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant={instalador.ativo ? 'default' : 'destructive'}>
                              {instalador.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-right">{instalador.total_servicos}</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                            R$ {instalador.total_ganho.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => abrirHistorico(instalador)}
                              >
                                Ver Histórico
                              </Button>
                              <Button
                                size="sm"
                                variant={instalador.ativo ? 'destructive' : 'default'}
                                onClick={() => toggleAtivo(instalador.id, instalador.ativo)}
                              >
                                {instalador.ativo ? 'Desativar' : 'Ativar'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </TabsContent>

          <TabsContent value="pagamentos" className="mt-6">
            <PagamentosInstaladores />
          </TabsContent>
        </Tabs>

        {/* Modal de Histórico */}
        <Dialog open={modalHistorico} onOpenChange={setModalHistorico}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Histórico de {instaladorSelecionado?.nome}
              </DialogTitle>
            </DialogHeader>
            
            {loadingHistorico ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              <div className="space-y-4">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Data</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Código</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Cliente</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {historico.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm">
                          {formatarDataBR(item.data_servico_agendada)}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium">{item.codigo}</td>
                        <td className="px-4 py-2 text-sm">{item.cliente_nome}</td>
                        <td className="px-4 py-2 text-sm">{item.status}</td>
                        <td className="px-4 py-2 text-sm text-right">R$ {item.valor.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-sm font-bold text-right">TOTAL (Concluídos):</td>
                      <td className="px-4 py-2 text-sm font-bold text-right text-green-600">
                        R$ {historico.filter(h => h.status === 'concluido').reduce((s, h) => s + h.valor, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
