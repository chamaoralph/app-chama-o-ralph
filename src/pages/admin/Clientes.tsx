import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { 
  Search, 
  Users, 
  Star, 
  TrendingUp, 
  Phone, 
  Plus, 
  Eye, 
  Edit, 
  FileText,
  ArrowUpDown,
  Crown,
  AlertTriangle,
  UserX,
  User,
  Skull,
  MessageCircle
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

interface Cliente {
  id: string
  nome: string
  telefone: string
  bairro: string | null
  endereco_completo: string | null
  origem_lead: string
  idade: number | null
  created_at: string
  observacao_alerta: string | null
  tipo_alerta: 'problematico' | 'atencao' | null
}

interface Cotacao {
  id: string
  cliente_id: string
  status: string
  valor_estimado: number | null
  tipo_servico: string[] | null
  data_servico_desejada: string | null
  created_at: string
}

interface ClienteComMetricas extends Cliente {
  totalCotacoes: number
  cotacoesAprovadas: number
  cotacoesPendentes: number
  cotacoesNaoGerou: number
  valorTotal: number
  taxaConversao: number
  classificacao: 'vip' | 'bom' | 'regular' | 'atencao' | 'inativo' | 'problematico'
  ultimaInteracao: string | null
  cotacoes: Cotacao[]
}

type OrdenacaoCampo = 'nome' | 'totalCotacoes' | 'valorTotal' | 'taxaConversao'
type OrdenacaoDirecao = 'asc' | 'desc'

export default function AdminClientes() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [busca, setBusca] = useState("")
  const [filtroClassificacao, setFiltroClassificacao] = useState<string>("todos")
  const [filtroBairro, setFiltroBairro] = useState<string>("todos")
  const [ordenacao, setOrdenacao] = useState<{ campo: OrdenacaoCampo; direcao: OrdenacaoDirecao }>({
    campo: 'nome',
    direcao: 'asc'
  })
  
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteComMetricas | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false)
  const [editandoNome, setEditandoNome] = useState(false)
  const [novoNome, setNovoNome] = useState("")
  const [observacoes, setObservacoes] = useState("")
  const [formEdicao, setFormEdicao] = useState({
    nome: "",
    telefone: "",
    bairro: "",
    endereco_completo: "",
    idade: "",
    origem_lead: "",
    tipo_alerta: "normal" as 'normal' | 'problematico' | 'atencao',
    observacao_alerta: ""
  })

  // Fetch clientes
  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('ativo', true)
        .order('nome')
      
      if (error) throw error
      return data as Cliente[]
    },
    enabled: !!user
  })

  // Fetch cotações
  const { data: cotacoes = [], isLoading: loadingCotacoes } = useQuery({
    queryKey: ['cotacoes-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotacoes')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Cotacao[]
    },
    enabled: !!user
  })

  // Calcular métricas por cliente
  const clientesComMetricas: ClienteComMetricas[] = useMemo(() => {
    return clientes.map(cliente => {
      const cotacoesDoCliente = cotacoes.filter(c => c.cliente_id === cliente.id)
      const totalCotacoes = cotacoesDoCliente.length
      const cotacoesAprovadas = cotacoesDoCliente.filter(c => c.status === 'aprovada').length
      const cotacoesPendentes = cotacoesDoCliente.filter(c => c.status === 'pendente').length
      const cotacoesNaoGerou = cotacoesDoCliente.filter(c => c.status === 'nao_gerou').length
      const valorTotal = cotacoesDoCliente
        .filter(c => c.status === 'aprovada')
        .reduce((acc, c) => acc + (c.valor_estimado || 0), 0)
      const taxaConversao = totalCotacoes > 0 ? (cotacoesAprovadas / totalCotacoes) * 100 : 0
      const ultimaInteracao = cotacoesDoCliente.length > 0 
        ? cotacoesDoCliente[0].created_at 
        : null

      // Classificação automática (prioriza tipo_alerta manual)
      let classificacao: ClienteComMetricas['classificacao'] = 'inativo'
      if (cliente.tipo_alerta === 'problematico') {
        classificacao = 'problematico'
      } else if (taxaConversao > 70 || valorTotal > 1000) {
        classificacao = 'vip'
      } else if (taxaConversao > 50 || cotacoesAprovadas >= 3) {
        classificacao = 'bom'
      } else if (cotacoesAprovadas >= 1) {
        classificacao = 'regular'
      } else if (cotacoesNaoGerou > 3) {
        classificacao = 'atencao'
      }

      return {
        ...cliente,
        totalCotacoes,
        cotacoesAprovadas,
        cotacoesPendentes,
        cotacoesNaoGerou,
        valorTotal,
        taxaConversao,
        classificacao,
        ultimaInteracao,
        cotacoes: cotacoesDoCliente
      }
    })
  }, [clientes, cotacoes])

  // Filtrar e ordenar
  const clientesFiltrados = useMemo(() => {
    let resultado = clientesComMetricas

    // Busca
    if (busca) {
      const termoBusca = busca.toLowerCase()
      resultado = resultado.filter(c => 
        c.nome.toLowerCase().includes(termoBusca) ||
        c.telefone.includes(termoBusca)
      )
    }

    // Filtro por classificação
    if (filtroClassificacao !== 'todos') {
      resultado = resultado.filter(c => c.classificacao === filtroClassificacao)
    }

    // Filtro por bairro
    if (filtroBairro !== 'todos') {
      resultado = resultado.filter(c => c.bairro === filtroBairro)
    }

    // Ordenação
    resultado.sort((a, b) => {
      let valorA: number | string
      let valorB: number | string

      switch (ordenacao.campo) {
        case 'nome':
          valorA = a.nome.toLowerCase()
          valorB = b.nome.toLowerCase()
          break
        case 'totalCotacoes':
          valorA = a.totalCotacoes
          valorB = b.totalCotacoes
          break
        case 'valorTotal':
          valorA = a.valorTotal
          valorB = b.valorTotal
          break
        case 'taxaConversao':
          valorA = a.taxaConversao
          valorB = b.taxaConversao
          break
        default:
          return 0
      }

      if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1
      if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1
      return 0
    })

    return resultado
  }, [clientesComMetricas, busca, filtroClassificacao, filtroBairro, ordenacao])

  // Bairros únicos
  const bairros = useMemo(() => {
    const uniqueBairros = [...new Set(clientes.map(c => c.bairro).filter(Boolean))]
    return uniqueBairros.sort()
  }, [clientes])

  // Mutation para atualizar cliente
  const atualizarCliente = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase
        .from('clientes')
        .update({ nome })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes-admin'] })
      queryClient.invalidateQueries({ queryKey: ['cotacoes-admin'] })
      toast({ title: "Nome atualizado com sucesso!" })
      setEditandoNome(false)
    },
    onError: () => {
      toast({ title: "Erro ao atualizar nome", variant: "destructive" })
    }
  })

  // Mutation para atualizar cliente completo
  const atualizarClienteCompleto = useMutation({
    mutationFn: async (dados: { 
      id: string
      nome: string
      telefone: string
      bairro: string | null
      endereco_completo: string | null
      idade: number | null
      origem_lead: string
      tipo_alerta: 'problematico' | 'atencao' | null
      observacao_alerta: string | null
    }) => {
      const { error } = await supabase
        .from('clientes')
        .update({
          nome: dados.nome,
          telefone: dados.telefone,
          bairro: dados.bairro || null,
          endereco_completo: dados.endereco_completo || null,
          idade: dados.idade,
          origem_lead: dados.origem_lead,
          tipo_alerta: dados.tipo_alerta,
          observacao_alerta: dados.observacao_alerta
        })
        .eq('id', dados.id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes-admin'] })
      queryClient.invalidateQueries({ queryKey: ['cotacoes-admin'] })
      toast({ title: "Cliente atualizado com sucesso!" })
      setModalEdicaoAberto(false)
      setModalAberto(false)
    },
    onError: () => {
      toast({ title: "Erro ao atualizar cliente", variant: "destructive" })
    }
  })

  function abrirModalEdicao(cliente: ClienteComMetricas) {
    setFormEdicao({
      nome: cliente.nome,
      telefone: cliente.telefone,
      bairro: cliente.bairro || "",
      endereco_completo: cliente.endereco_completo || "",
      idade: cliente.idade?.toString() || "",
      origem_lead: cliente.origem_lead,
      tipo_alerta: cliente.tipo_alerta || "normal",
      observacao_alerta: cliente.observacao_alerta || ""
    })
    setModalEdicaoAberto(true)
  }

  function salvarEdicaoCliente() {
    if (!clienteSelecionado) return
    atualizarClienteCompleto.mutate({
      id: clienteSelecionado.id,
      nome: formEdicao.nome,
      telefone: formEdicao.telefone,
      bairro: formEdicao.bairro || null,
      endereco_completo: formEdicao.endereco_completo || null,
      idade: formEdicao.idade ? parseInt(formEdicao.idade) : null,
      origem_lead: formEdicao.origem_lead,
      tipo_alerta: formEdicao.tipo_alerta === 'normal' ? null : formEdicao.tipo_alerta,
      observacao_alerta: formEdicao.observacao_alerta || null
    })
  }

  function handleOrdenar(campo: OrdenacaoCampo) {
    setOrdenacao(prev => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === 'asc' ? 'desc' : 'asc'
    }))
  }

  function abrirDetalhe(cliente: ClienteComMetricas) {
    setClienteSelecionado(cliente)
    setNovoNome(cliente.nome)
    setModalAberto(true)
  }

  function getClassificacaoBadge(classificacao: ClienteComMetricas['classificacao'], observacaoAlerta?: string | null) {
    const config = {
      problematico: { icon: Skull, bg: 'bg-red-100', text: 'text-red-800', label: 'Problemático' },
      vip: { icon: Crown, bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'VIP' },
      bom: { icon: Star, bg: 'bg-green-100', text: 'text-green-800', label: 'Bom' },
      regular: { icon: User, bg: 'bg-blue-100', text: 'text-blue-800', label: 'Regular' },
      atencao: { icon: AlertTriangle, bg: 'bg-orange-100', text: 'text-orange-800', label: 'Atenção' },
      inativo: { icon: UserX, bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inativo' }
    }
    const c = config[classificacao]
    const Icon = c.icon
    return (
      <div className="flex flex-col gap-1">
        <Badge className={`${c.bg} ${c.text} gap-1`}>
          <Icon className="w-3 h-3" />
          {c.label}
        </Badge>
        {classificacao === 'problematico' && observacaoAlerta && (
          <span className="text-xs text-red-600 max-w-[150px] truncate" title={observacaoAlerta}>
            ⚠️ {observacaoAlerta}
          </span>
        )}
      </div>
    )
  }

  function getStatusBadge(status: string) {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      pendente: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendente' },
      aprovada: { bg: 'bg-green-100', text: 'text-green-800', label: 'Aprovada' },
      nao_gerou: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Não Gerou' },
      enviada: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Enviada' },
    }
    const badge = badges[status] || badges.pendente
    return (
      <Badge className={`${badge.bg} ${badge.text}`}>
        {badge.label}
      </Badge>
    )
  }

  // Estatísticas gerais
  const estatisticas = useMemo(() => {
    const totalClientes = clientesComMetricas.length
    const clientesVip = clientesComMetricas.filter(c => c.classificacao === 'vip').length
    const valorTotalGeral = clientesComMetricas.reduce((acc, c) => acc + c.valorTotal, 0)
    const taxaConversaoMedia = clientesComMetricas.length > 0
      ? clientesComMetricas.reduce((acc, c) => acc + c.taxaConversao, 0) / clientesComMetricas.length
      : 0

    return { totalClientes, clientesVip, valorTotalGeral, taxaConversaoMedia }
  }, [clientesComMetricas])

  const isLoading = loadingClientes || loadingCotacoes

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
            <p className="text-gray-600">Gerencie sua base de clientes e acompanhe métricas</p>
          </div>
          <Link to="/admin/cotacoes/nova">
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Nova Cotação
            </Button>
          </Link>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total de Clientes</p>
                  <p className="text-2xl font-bold">{estatisticas.totalClientes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Crown className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Clientes VIP</p>
                  <p className="text-2xl font-bold">{estatisticas.clientesVip}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Valor Total</p>
                  <p className="text-2xl font-bold">
                    R$ {estatisticas.valorTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Star className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Taxa Conversão Média</p>
                  <p className="text-2xl font-bold">{estatisticas.taxaConversaoMedia.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[250px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas Classificações</SelectItem>
                  <SelectItem value="problematico">💀 Problemático</SelectItem>
                  <SelectItem value="vip">🌟 VIP</SelectItem>
                  <SelectItem value="bom">⭐ Bom</SelectItem>
                  <SelectItem value="regular">👤 Regular</SelectItem>
                  <SelectItem value="atencao">⚠️ Atenção</SelectItem>
                  <SelectItem value="inativo">❌ Inativo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroBairro} onValueChange={setFiltroBairro}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Bairro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Bairros</SelectItem>
                  {bairros.map(bairro => (
                    <SelectItem key={bairro} value={bairro!}>{bairro}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Clientes */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleOrdenar('nome')}
                      >
                        <div className="flex items-center gap-1">
                          Nome
                          <ArrowUpDown className="w-4 h-4" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Telefone
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleOrdenar('totalCotacoes')}
                      >
                        <div className="flex items-center gap-1">
                          Total Cotações
                          <ArrowUpDown className="w-4 h-4" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleOrdenar('valorTotal')}
                      >
                        <div className="flex items-center gap-1">
                          Valor Total
                          <ArrowUpDown className="w-4 h-4" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleOrdenar('taxaConversao')}
                      >
                        <div className="flex items-center gap-1">
                          Taxa Conversão
                          <ArrowUpDown className="w-4 h-4" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Classificação
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clientesFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p>Nenhum cliente encontrado</p>
                        </td>
                      </tr>
                    ) : (
                      clientesFiltrados.map((cliente) => (
                        <tr key={cliente.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{cliente.nome}</div>
                            {cliente.bairro && (
                              <div className="text-xs text-gray-500">{cliente.bairro}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                              <Phone className="w-4 h-4 text-gray-400" />
                              {cliente.telefone}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{cliente.totalCotacoes}</div>
                            <div className="text-xs text-gray-500">
                              {cliente.cotacoesAprovadas} aprovadas
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              R$ {cliente.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{cliente.taxaConversao.toFixed(1)}%</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getClassificacaoBadge(cliente.classificacao, cliente.observacao_alerta)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirDetalhe(cliente)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver Detalhes
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Detalhes do Cliente */}
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {clienteSelecionado && (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {editandoNome ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={novoNome}
                            onChange={(e) => setNovoNome(e.target.value)}
                            className="w-64"
                          />
                          <Button 
                            size="sm"
                            onClick={() => atualizarCliente.mutate({ 
                              id: clienteSelecionado.id, 
                              nome: novoNome 
                            })}
                          >
                            Salvar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setEditandoNome(false)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <DialogTitle className="text-2xl">{clienteSelecionado.nome}</DialogTitle>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => setEditandoNome(true)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {getClassificacaoBadge(clienteSelecionado.classificacao, clienteSelecionado.observacao_alerta)}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MessageCircle className="w-4 h-4 text-green-600" />
                    <a 
                      href={`https://wa.me/55${clienteSelecionado.telefone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-green-600 hover:underline"
                    >
                      {clienteSelecionado.telefone}
                    </a>
                    {clienteSelecionado.bairro && (
                      <span className="ml-4">📍 {clienteSelecionado.bairro}</span>
                    )}
                  </div>
                </DialogHeader>

                {/* Estatísticas do Cliente */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 my-6">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{clienteSelecionado.totalCotacoes}</p>
                      <p className="text-xs text-gray-600">Total Cotações</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{clienteSelecionado.cotacoesAprovadas}</p>
                      <p className="text-xs text-gray-600">Aprovadas</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-yellow-600">{clienteSelecionado.cotacoesPendentes}</p>
                      <p className="text-xs text-gray-600">Pendentes</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-orange-600">{clienteSelecionado.cotacoesNaoGerou}</p>
                      <p className="text-xs text-gray-600">Não Gerou</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        R$ {clienteSelecionado.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-gray-600">Valor Total</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-indigo-600">
                        R$ {clienteSelecionado.totalCotacoes > 0 
                          ? (clienteSelecionado.valorTotal / clienteSelecionado.cotacoesAprovadas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })
                          : '0'}
                      </p>
                      <p className="text-xs text-gray-600">Ticket Médio</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Última Interação */}
                {clienteSelecionado.ultimaInteracao && (
                  <p className="text-sm text-gray-500 mb-4">
                    Última interação: {new Date(clienteSelecionado.ultimaInteracao).toLocaleDateString('pt-BR')}
                  </p>
                )}

                {/* Botões de Ação */}
                <div className="mb-6 flex gap-3">
                  <Button
                    onClick={() => abrirModalEdicao(clienteSelecionado)}
                    variant="outline"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar Cliente
                  </Button>
                  <Button
                    onClick={() => {
                      navigate(`/admin/cotacoes/nova?cliente=${clienteSelecionado.telefone}&nome=${encodeURIComponent(clienteSelecionado.nome)}`)
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Cotação
                  </Button>
                </div>

                {/* Histórico de Cotações */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Histórico de Cotações</h3>
                  {clienteSelecionado.cotacoes.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Nenhuma cotação registrada</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Serviço</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data Serviço</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {clienteSelecionado.cotacoes.map(cotacao => (
                            <tr key={cotacao.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm">
                                {new Date(cotacao.created_at).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {cotacao.tipo_servico?.join(', ') || '-'}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {cotacao.valor_estimado 
                                  ? `R$ ${cotacao.valor_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                  : '-'}
                              </td>
                              <td className="px-4 py-2">
                                {getStatusBadge(cotacao.status)}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {cotacao.data_servico_desejada 
                                  ? new Date(cotacao.data_servico_desejada).toLocaleDateString('pt-BR')
                                  : '-'}
                              </td>
                              <td className="px-4 py-2">
                                <Link to={`/admin/cotacoes?id=${cotacao.id}`}>
                                  <Button size="sm" variant="ghost">
                                    <FileText className="w-4 h-4 mr-1" />
                                    Ver
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Edição do Cliente */}
        <Dialog open={modalEdicaoAberto} onOpenChange={setModalEdicaoAberto}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Cliente</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-nome">Nome</Label>
                <Input
                  id="edit-nome"
                  value={formEdicao.nome}
                  onChange={(e) => setFormEdicao({ ...formEdicao, nome: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-telefone">Telefone</Label>
                <Input
                  id="edit-telefone"
                  value={formEdicao.telefone}
                  onChange={(e) => setFormEdicao({ ...formEdicao, telefone: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-bairro">Bairro</Label>
                <Input
                  id="edit-bairro"
                  value={formEdicao.bairro}
                  onChange={(e) => setFormEdicao({ ...formEdicao, bairro: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-endereco">Endereço Completo</Label>
                <Input
                  id="edit-endereco"
                  value={formEdicao.endereco_completo}
                  onChange={(e) => setFormEdicao({ ...formEdicao, endereco_completo: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-idade">Idade</Label>
                <Input
                  id="edit-idade"
                  type="number"
                  value={formEdicao.idade}
                  onChange={(e) => setFormEdicao({ ...formEdicao, idade: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-origem">Origem do Lead</Label>
                <Select 
                  value={formEdicao.origem_lead} 
                  onValueChange={(value) => setFormEdicao({ ...formEdicao, origem_lead: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Google">Google</SelectItem>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="Indicação">Indicação</SelectItem>
                    <SelectItem value="Site">Site</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Alerta de Cliente Problemático */}
              <div className="border-t pt-4 mt-4">
                <Label className="text-red-600 font-medium flex items-center gap-2">
                  <Skull className="w-4 h-4" />
                  Status de Alerta
                </Label>
                <Select 
                  value={formEdicao.tipo_alerta} 
                  onValueChange={(value) => setFormEdicao({ ...formEdicao, tipo_alerta: value as 'normal' | 'problematico' | 'atencao' })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Normal (sem alerta)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">✅ Normal (sem alerta)</SelectItem>
                    <SelectItem value="atencao">⚠️ Atenção</SelectItem>
                    <SelectItem value="problematico">💀 Problemático</SelectItem>
                  </SelectContent>
                </Select>
                
                {formEdicao.tipo_alerta && formEdicao.tipo_alerta !== 'normal' && (
                  <div className="mt-2">
                    <Label htmlFor="edit-observacao-alerta">Observação do Alerta</Label>
                    <Textarea
                      id="edit-observacao-alerta"
                      value={formEdicao.observacao_alerta}
                      onChange={(e) => setFormEdicao({ ...formEdicao, observacao_alerta: e.target.value })}
                      placeholder="Descreva o motivo do alerta..."
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalEdicaoAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={salvarEdicaoCliente} disabled={!formEdicao.nome || !formEdicao.telefone}>
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
