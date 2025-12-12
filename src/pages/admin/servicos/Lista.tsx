import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { UserPlus, Users, CheckCircle } from 'lucide-react'

interface Servico {
  id: string
  codigo: string
  empresa_id: string
  cliente_id: string
  instalador_id: string | null
  tipo_servico: string[]
  status: string
  created_at: string
  data_servico_agendada: string
  valor_total: number
  valor_mao_obra_instalador: number | null
  observacoes_instalador: string | null
  clientes: {
    nome: string
  }
  usuarios?: {
    nome: string
  }
}

interface Instalador {
  id: string
  nome: string
  ativo: boolean
}

export default function ListaServicos() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [servicos, setServicos] = useState<Servico[]>([])
  const [instaladores, setInstaladores] = useState<Instalador[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estado para seleção em massa
  const [servicosSelecionados, setServicosSelecionados] = useState<Set<string>>(new Set())
  
  // Estado para modal de atribuição
  const [modalAberto, setModalAberto] = useState(false)
  const [instaladorSelecionado, setInstaladorSelecionado] = useState<string>("")
  const [servicoParaAtribuir, setServicoParaAtribuir] = useState<string | null>(null) // null = em massa

  useEffect(() => {
    fetchServicos()
    fetchInstaladores()
  }, [user])

  async function fetchServicos() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          *,
          clientes(nome),
          usuarios!fk_servicos_instalador(nome)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setServicos(data as any || [])
    } catch (err) {
      console.error('Erro ao buscar serviços:', err)
      setError('Erro ao carregar serviços')
    } finally {
      setLoading(false)
    }
  }

  async function fetchInstaladores() {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, ativo')
        .eq('tipo', 'instalador')
        .eq('ativo', true)
        .order('nome')

      if (error) throw error
      setInstaladores(data || [])
    } catch (err) {
      console.error('Erro ao buscar instaladores:', err)
    }
  }

  async function disponibilizarServico(servicoId: string) {
    try {
      const { error } = await supabase
        .from('servicos')
        .update({ status: 'disponivel' })
        .eq('id', servicoId)

      if (error) throw error

      toast({
        title: "Serviço disponibilizado",
        description: "O serviço foi disponibilizado para os instaladores",
      })

      fetchServicos()
    } catch (err) {
      console.error('Erro ao disponibilizar serviço:', err)
      toast({
        title: "Erro",
        description: "Não foi possível disponibilizar o serviço",
        variant: "destructive",
      })
    }
  }

  function abrirModalAtribuicao(servicoId: string | null) {
    setServicoParaAtribuir(servicoId)
    setInstaladorSelecionado("")
    setModalAberto(true)
  }

  async function confirmarAtribuicao() {
    if (!instaladorSelecionado) {
      toast({ title: "Selecione um instalador", variant: "destructive" })
      return
    }

    try {
      const idsParaAtribuir = servicoParaAtribuir 
        ? [servicoParaAtribuir] 
        : Array.from(servicosSelecionados)

      const { error } = await supabase
        .from('servicos')
        .update({ 
          instalador_id: instaladorSelecionado,
          status: 'atribuido'
        })
        .in('id', idsParaAtribuir)

      if (error) throw error

      toast({
        title: "Instalador atribuído",
        description: `${idsParaAtribuir.length} serviço(s) atribuído(s) com sucesso`,
      })

      setModalAberto(false)
      setServicosSelecionados(new Set())
      fetchServicos()
    } catch (err) {
      console.error('Erro ao atribuir instalador:', err)
      toast({
        title: "Erro",
        description: "Não foi possível atribuir o instalador",
        variant: "destructive",
      })
    }
  }

  function toggleSelecao(servicoId: string) {
    const novaSelecao = new Set(servicosSelecionados)
    if (novaSelecao.has(servicoId)) {
      novaSelecao.delete(servicoId)
    } else {
      novaSelecao.add(servicoId)
    }
    setServicosSelecionados(novaSelecao)
  }

  function toggleSelecionarTodos() {
    if (servicosSelecionados.size === servicos.length) {
      setServicosSelecionados(new Set())
    } else {
      setServicosSelecionados(new Set(servicos.map(s => s.id)))
    }
  }

  async function finalizarComoAdmin(servicoId: string) {
    try {
      const { error } = await supabase
        .from('servicos')
        .update({ 
          status: 'concluido',
          observacoes_instalador: 'Finalizado pelo administrador'
        })
        .eq('id', servicoId)

      if (error) throw error

      toast({
        title: "Serviço finalizado",
        description: "O serviço foi finalizado pelo administrador",
      })

      fetchServicos()
    } catch (err) {
      console.error('Erro ao finalizar serviço:', err)
      toast({
        title: "Erro",
        description: "Não foi possível finalizar o serviço",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string, observacoes?: string | null) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      aguardando_distribuicao: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Aguardando Distribuição' },
      disponivel: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Disponível' },
      atribuido: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Atribuído' },
      em_andamento: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Em Andamento' },
      aguardando_aprovacao: { bg: 'bg-cyan-100', text: 'text-cyan-800', label: 'Aguardando Aprovação' },
      concluido: { bg: 'bg-green-100', text: 'text-green-800', label: 'Concluído' },
      cancelado: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelado' },
    }
    const badge = badges[status] || badges.aguardando_distribuicao
    const isFinalizadoPeloAdmin = status === 'concluido' && observacoes === 'Finalizado pelo administrador'
    
    return (
      <div className="flex flex-col gap-1">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
          {badge.label}
        </span>
        {isFinalizadoPeloAdmin && (
          <span className="text-xs text-gray-500 italic">
            (pelo admin)
          </span>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Carregando serviços...</div>
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Serviços</h1>
            <p className="text-gray-600 mt-2">Gerencie todos os serviços da empresa</p>
          </div>
          
          {servicosSelecionados.size > 0 && (
            <Button 
              onClick={() => abrirModalAtribuicao(null)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Users className="w-4 h-4 mr-2" />
              Definir Instalador ({servicosSelecionados.size})
            </Button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <Checkbox
                      checked={servicosSelecionados.size === servicos.length && servicos.length > 0}
                      onCheckedChange={toggleSelecionarTodos}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Serviço
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Instalador
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Agendada
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {servicos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        <p className="text-lg font-medium">Nenhum serviço cadastrado</p>
                        <p className="text-sm mt-1">Confirme uma cotação para criar um serviço</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  servicos.map((servico) => (
                    <tr key={servico.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <Checkbox
                          checked={servicosSelecionados.has(servico.id)}
                          onCheckedChange={() => toggleSelecao(servico.id)}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{servico.codigo}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{servico.clientes.nome}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {servico.tipo_servico?.join(', ') || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {servico.usuarios?.nome || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(servico.status, servico.observacoes_instalador)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          R$ {Number(servico.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(servico.data_servico_agendada).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        {servico.status === 'aguardando_distribuicao' && (
                          <button
                            onClick={() => disponibilizarServico(servico.id)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Disponibilizar
                          </button>
                        )}
                        {!servico.instalador_id && (
                          <button
                            onClick={() => abrirModalAtribuicao(servico.id)}
                            className="text-purple-600 hover:text-purple-800 font-medium"
                          >
                            <UserPlus className="w-4 h-4 inline mr-1" />
                            Definir Instalador
                          </button>
                        )}
                        {servico.status === 'em_andamento' && (
                          <button
                            onClick={() => finalizarComoAdmin(servico.id)}
                            className="text-green-600 hover:text-green-800 font-medium"
                          >
                            <CheckCircle className="w-4 h-4 inline mr-1" />
                            Finalizar
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/admin/servicos/${servico.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
          <div>
            Mostrando {servicos.length} serviço(s) | {servicosSelecionados.size} selecionado(s)
          </div>
        </div>
      </div>

      {/* Modal de Atribuição */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Definir Instalador
              {servicoParaAtribuir 
                ? "" 
                : ` (${servicosSelecionados.size} serviços)`
              }
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <Label>Selecione o Instalador</Label>
            <Select value={instaladorSelecionado} onValueChange={setInstaladorSelecionado}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Escolha um instalador..." />
              </SelectTrigger>
              <SelectContent>
                {instaladores.map(instalador => (
                  <SelectItem key={instalador.id} value={instalador.id}>
                    {instalador.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarAtribuicao} disabled={!instaladorSelecionado}>
              Confirmar Atribuição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
