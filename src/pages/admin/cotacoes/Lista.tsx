import { useNavigate, Link } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImportacaoCotacoes } from '@/components/admin/ImportacaoCotacoes'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Trash2, XCircle, Pencil, Users, Undo2, List, Calendar, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarioCotacoesSemanal } from '@/components/admin/CalendarioCotacoesSemanal'
import { CalendarioCotacoesMensal } from '@/components/admin/CalendarioCotacoesMensal'

type VisualizacaoTipo = 'lista' | 'semanal' | 'mensal'

interface Cotacao {
  id: string
  cliente_id: string
  tipo_servico: string[]
  status: string
  created_at: string
  data_servico_desejada: string | null
  horario_inicio: string | null
  horario_fim: string | null
  valor_estimado: number | null
  ocasiao: string | null
  origem_lead: string | null
  descricao_servico: string | null
  observacoes: string | null
  clientes: {
    id: string
    nome: string
    telefone: string
    endereco_completo: string | null
    bairro: string | null
    idade: number | null
    tipo_alerta: string | null
    observacao_alerta: string | null
  }
}

interface EditForm {
  cliente_nome: string
  cliente_telefone: string
  cliente_idade: string
  endereco_completo: string
  bairro: string
  origem_lead: string
  ocasiao: string
  data_servico_desejada: string
  horario_inicio: string
  duracao: string
  data_criacao: string
  tipo_servico: string
  tipo_servico_outro: string
  valor_estimado: string
  observacoes: string
}

interface TipoServico {
  id: string
  nome: string
}

// Horários disponíveis de 8:00 às 19:00 em intervalos de 30 minutos
const horariosDisponiveis = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00'
]

// Durações disponíveis
const duracoesDisponiveis = [
  { valor: '30', label: '30 minutos' },
  { valor: '60', label: '1 hora' },
  { valor: '90', label: '1h 30min' },
  { valor: '120', label: '2 horas' },
  { valor: '150', label: '2h 30min' },
  { valor: '180', label: '3 horas' },
  { valor: '240', label: '4 horas' },
  { valor: '300', label: '5 horas' },
  { valor: '360', label: '6 horas' },
  { valor: '420', label: '7 horas' },
  { valor: '480', label: '8 horas' },
]

// Formata data sem conversão de timezone (DD/MM/YYYY)
function formatarDataBR(dataString: string | null): string {
  if (!dataString) return '-';
  const [dataPart] = dataString.split('T');
  const [ano, mes, dia] = dataPart.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Função para calcular horário fim
function calcularHorarioFim(horarioInicio: string, duracaoMinutos: string): string {
  if (!horarioInicio) return ''
  const [h, m] = horarioInicio.split(':').map(Number)
  const totalMinutos = h * 60 + m + parseInt(duracaoMinutos)
  const novaHora = Math.floor(totalMinutos / 60)
  const novosMinutos = totalMinutos % 60
  return `${String(novaHora).padStart(2, '0')}:${String(novosMinutos).padStart(2, '0')}`
}

export default function ListaCotacoes() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cotacaoParaExcluir, setCotacaoParaExcluir] = useState<string | null>(null)
  const [cotacaoParaNaoGerou, setCotacaoParaNaoGerou] = useState<string | null>(null)
  const [cotacaoParaEditar, setCotacaoParaEditar] = useState<Cotacao | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    cliente_nome: '',
    cliente_telefone: '',
    cliente_idade: '',
    endereco_completo: '',
    bairro: '',
    origem_lead: '',
    ocasiao: '',
    data_servico_desejada: '',
    horario_inicio: '',
    duracao: '60',
    data_criacao: '',
    tipo_servico: '',
    tipo_servico_outro: '',
    valor_estimado: '',
    observacoes: ''
  })
  const [editLoading, setEditLoading] = useState(false)
  const [motivoNaoGerou, setMotivoNaoGerou] = useState<string>('')
  const [observacaoNaoGerou, setObservacaoNaoGerou] = useState<string>('')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState(10)
  const [ordenacao, setOrdenacao] = useState<{ campo: string; direcao: 'asc' | 'desc' }>({
    campo: 'created_at',
    direcao: 'desc'
  })
  const [tiposServico, setTiposServico] = useState<TipoServico[]>([])
  const [showOutroInput, setShowOutroInput] = useState(false)
  const [visualizacao, setVisualizacao] = useState<VisualizacaoTipo>('lista')

  useEffect(() => {
    fetchCotacoes()
    fetchTiposServico()
  }, [user])

  async function fetchTiposServico() {
    const { data } = await supabase
      .from('tipos_servico')
      .select('id, nome')
      .eq('ativo', true)
      .order('ordem')
    setTiposServico(data || [])
  }

  async function fetchCotacoes() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('cotacoes')
        .select('*, clientes(*)')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setCotacoes(data || [])
    } catch (err) {
      console.error('Erro ao buscar cotações:', err)
      setError('Erro ao carregar cotações')
    } finally {
      setLoading(false)
    }
  }

  function abrirEdicao(cotacao: Cotacao) {
    // Calcular duração baseada no horário início/fim
    let duracao = '60'
    if (cotacao.horario_inicio && cotacao.horario_fim) {
      const [h1, m1] = cotacao.horario_inicio.split(':').map(Number)
      const [h2, m2] = cotacao.horario_fim.split(':').map(Number)
      const minutos = (h2 * 60 + m2) - (h1 * 60 + m1)
      if (minutos > 0) duracao = String(minutos)
    }

    // Verificar se tipo_servico é um dos tipos cadastrados ou "Outro"
    const tipoAtual = cotacao.tipo_servico?.[0] || ''
    const ehTipoCadastrado = tiposServico.some(t => t.nome === tipoAtual)
    
    setEditForm({
      cliente_nome: cotacao.clientes.nome || '',
      cliente_telefone: cotacao.clientes.telefone || '',
      cliente_idade: cotacao.clientes.idade?.toString() || '',
      endereco_completo: cotacao.clientes.endereco_completo || '',
      bairro: cotacao.clientes.bairro || '',
      origem_lead: cotacao.origem_lead || '',
      ocasiao: cotacao.ocasiao || '',
      data_servico_desejada: cotacao.data_servico_desejada || '',
      horario_inicio: cotacao.horario_inicio?.substring(0, 5) || '',
      duracao: duracao,
      data_criacao: cotacao.created_at ? cotacao.created_at.split('T')[0] : '',
      tipo_servico: ehTipoCadastrado ? tipoAtual : (tipoAtual ? 'Outros' : ''),
      tipo_servico_outro: ehTipoCadastrado ? '' : tipoAtual,
      valor_estimado: cotacao.valor_estimado?.toString() || '',
      observacoes: cotacao.observacoes || ''
    })
    setShowOutroInput(!ehTipoCadastrado && !!tipoAtual)
    setCotacaoParaEditar(cotacao)
  }

  async function salvarEdicao() {
    if (!cotacaoParaEditar) return
    setEditLoading(true)

    try {
      // Atualizar cliente
      const { error: erroCliente } = await supabase
        .from('clientes')
        .update({
          nome: editForm.cliente_nome,
          telefone: editForm.cliente_telefone,
          idade: editForm.cliente_idade ? parseInt(editForm.cliente_idade) : null,
          endereco_completo: editForm.endereco_completo,
          bairro: editForm.bairro,
        })
        .eq('id', cotacaoParaEditar.cliente_id)

      if (erroCliente) throw erroCliente

      // Definir tipo de serviço final
      const tipoServicoFinal = editForm.tipo_servico === 'Outros' && editForm.tipo_servico_outro 
        ? editForm.tipo_servico_outro 
        : editForm.tipo_servico

      // Calcular horário fim automaticamente
      const horarioFim = editForm.horario_inicio 
        ? calcularHorarioFim(editForm.horario_inicio, editForm.duracao) 
        : null

      // Atualizar cotação
      const { error: erroCotacao } = await supabase
        .from('cotacoes')
        .update({
          tipo_servico: tipoServicoFinal ? [tipoServicoFinal] : null,
          data_servico_desejada: editForm.data_servico_desejada || null,
          horario_inicio: editForm.horario_inicio || null,
          horario_fim: horarioFim,
          created_at: editForm.data_criacao ? new Date(editForm.data_criacao).toISOString() : undefined,
          valor_estimado: editForm.valor_estimado ? parseFloat(editForm.valor_estimado) : null,
          origem_lead: editForm.origem_lead || null,
          ocasiao: editForm.ocasiao || null,
          observacoes: editForm.observacoes || null,
        })
        .eq('id', cotacaoParaEditar.id)

      if (erroCotacao) throw erroCotacao

      toast({
        title: "Cotação atualizada",
        description: "Os dados foram salvos com sucesso.",
      })

      setCotacaoParaEditar(null)
      setShowOutroInput(false)
      fetchCotacoes()
    } catch (err) {
      console.error('Erro ao atualizar cotação:', err)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a cotação.",
        variant: "destructive"
      })
    } finally {
      setEditLoading(false)
    }
  }

  async function confirmarCotacao(id: string) {
    try {
      const { error } = await supabase
        .from('cotacoes')
        .update({ status: 'confirmada' })
        .eq('id', id)
      
      if (error) {
        console.error('Erro:', error)
        toast({
          title: "❌ Erro ao confirmar",
          description: error.message,
          variant: "destructive",
        })
        return
      }
      
      toast({
        title: "✅ Cotação confirmada!",
        description: "A cotação foi confirmada com sucesso.",
      })
      fetchCotacoes()
      
    } catch (err) {
      console.error('Erro catch:', err)
      toast({
        title: "❌ Erro inesperado",
        description: String(err),
        variant: "destructive",
      })
    }
  }

  async function excluirCotacao(id: string) {
    try {
      const { error } = await supabase
        .from('cotacoes')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      toast({
        title: "Cotação excluída",
        description: "A cotação foi removida com sucesso.",
      })
      
      fetchCotacoes()
    } catch (err) {
      console.error('Erro ao excluir cotação:', err)
      toast({
        title: "Erro",
        description: "Não foi possível excluir a cotação.",
        variant: "destructive"
      })
    }
  }

  async function marcarNaoGerou() {
    if (!cotacaoParaNaoGerou || !motivoNaoGerou) return

    try {
      const { error } = await supabase
        .from('cotacoes')
        .update({ 
          status: 'nao_gerou',
          observacoes: `${motivoNaoGerou}${observacaoNaoGerou ? ': ' + observacaoNaoGerou : ''}`
        })
        .eq('id', cotacaoParaNaoGerou)
      
      if (error) throw error
      
      toast({
        title: "Status atualizado",
        description: "A cotação foi marcada como não gerou serviço.",
      })
      
      setCotacaoParaNaoGerou(null)
      setMotivoNaoGerou('')
      setObservacaoNaoGerou('')
      fetchCotacoes()
    } catch (err) {
      console.error('Erro ao atualizar cotação:', err)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a cotação.",
        variant: "destructive"
      })
    }
  }

  async function reprovarCotacao(cotacaoId: string) {
    try {
      // Verificar se existe serviço associado e qual é o status
      const { data: servico, error: erroServico } = await supabase
        .from('servicos')
        .select('id, status')
        .eq('cotacao_id', cotacaoId)
        .maybeSingle()

      if (erroServico) throw erroServico

      if (servico) {
        // Só permite reprovar se o serviço ainda não foi iniciado
        const statusPermitidos = ['disponivel', 'solicitado']
        if (!statusPermitidos.includes(servico.status || '')) {
          toast({
            title: "❌ Não é possível reprovar",
            description: `O serviço já está com status "${servico.status}". Só é possível reprovar se estiver disponível ou solicitado.`,
            variant: "destructive"
          })
          return
        }

        // Deletar o serviço associado
        const { error: erroDeletar } = await supabase
          .from('servicos')
          .delete()
          .eq('id', servico.id)

        if (erroDeletar) throw erroDeletar
      }

      // Voltar cotação para pendente
      const { error: erroAtualizar } = await supabase
        .from('cotacoes')
        .update({ status: 'pendente' })
        .eq('id', cotacaoId)

      if (erroAtualizar) throw erroAtualizar

      toast({
        title: "✅ Cotação reprovada",
        description: "A cotação voltou para pendente e o serviço foi removido."
      })

      fetchCotacoes()
    } catch (err) {
      console.error('Erro ao reprovar cotação:', err)
      toast({
        title: "❌ Erro",
        description: "Não foi possível reprovar a cotação.",
        variant: "destructive"
      })
    }
  }

  const handleOrdenar = (campo: string) => {
    if (ordenacao.campo === campo) {
      setOrdenacao({ campo, direcao: ordenacao.direcao === 'asc' ? 'desc' : 'asc' })
    } else {
      setOrdenacao({ campo, direcao: 'asc' })
    }
  }

  const cotacoesOrdenadas = [...cotacoes].sort((a, b) => {
    const campo = ordenacao.campo as keyof Cotacao
    let valorA = a[campo]
    let valorB = b[campo]

    if (campo === 'clientes') {
      valorA = a.clientes?.nome
      valorB = b.clientes?.nome
    }

    if (valorA === null || valorA === undefined) return 1
    if (valorB === null || valorB === undefined) return -1
    
    if (typeof valorA === 'string' && typeof valorB === 'string') {
      return ordenacao.direcao === 'asc' 
        ? valorA.localeCompare(valorB)
        : valorB.localeCompare(valorA)
    }
    
    return ordenacao.direcao === 'asc' 
      ? (valorA > valorB ? 1 : -1)
      : (valorB > valorA ? 1 : -1)
  })

  const totalPaginas = Math.ceil(cotacoesOrdenadas.length / itensPorPagina)
  const indexInicio = (paginaAtual - 1) * itensPorPagina
  const indexFim = indexInicio + itensPorPagina
  const cotacoesPaginadas = cotacoesOrdenadas.slice(indexInicio, indexFim)

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      pendente: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendente' },
      aprovada: { bg: 'bg-green-100', text: 'text-green-800', label: 'Aprovada' },
      perdida: { bg: 'bg-red-100', text: 'text-red-800', label: 'Perdida' },
      sem_resposta: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Sem Resposta' },
      nao_gerou: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Não Gerou' },
    }
    const badge = badges[status] || badges.pendente
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Carregando cotações...</div>
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
            <h1 className="text-3xl font-bold text-gray-900">Cotações</h1>
            <p className="text-gray-600 mt-2">Gerencie todas as cotações de serviços</p>
          </div>
          <div className="flex gap-3">
            <Link to="/admin/clientes">
              <Button variant="outline">
                <Users className="w-4 h-4 mr-2" />
                Ver Clientes
              </Button>
            </Link>
            <button
              onClick={() => navigate('/admin/cotacoes/nova')}
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              + Nova Cotação
            </button>
          </div>
        </div>

        <Tabs defaultValue="lista" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="lista">Lista de Cotações</TabsTrigger>
            <TabsTrigger value="importacao">Importação em Massa</TabsTrigger>
          </TabsList>

          <TabsContent value="lista">
            {/* Botões de visualização */}
            <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={visualizacao === 'lista' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVisualizacao('lista')}
                >
                  <List className="w-4 h-4 mr-2" />
                  Lista
                </Button>
                <Button
                  variant={visualizacao === 'semanal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVisualizacao('semanal')}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Semanal
                </Button>
                <Button
                  variant={visualizacao === 'mensal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVisualizacao('mensal')}
                >
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Mensal
                </Button>
              </div>
              
              {visualizacao === 'lista' && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Mostrar</span>
                    <Select value={String(itensPorPagina)} onValueChange={(v) => {
                      setItensPorPagina(Number(v))
                      setPaginaAtual(1)
                    }}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-gray-600">por página</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Total: {cotacoes.length} cotações
                  </div>
                </div>
              )}
              
              {visualizacao !== 'lista' && (
                <div className="text-sm text-gray-600">
                  Total: {cotacoes.length} cotações
                </div>
              )}
            </div>

            {/* Visualização em Calendário Semanal */}
            {visualizacao === 'semanal' && (
              <CalendarioCotacoesSemanal
                cotacoes={cotacoes}
                onAprovar={async (id) => {
                  await supabase.from('cotacoes').update({ status: 'aprovada' }).eq('id', id)
                  toast({ title: '✅ Cotação aprovada!' })
                  fetchCotacoes()
                }}
                onEditar={abrirEdicao}
              />
            )}

            {/* Visualização em Calendário Mensal */}
            {visualizacao === 'mensal' && (
              <CalendarioCotacoesMensal
                cotacoes={cotacoes}
                onAprovar={async (id) => {
                  await supabase.from('cotacoes').update({ status: 'aprovada' }).eq('id', id)
                  toast({ title: '✅ Cotação aprovada!' })
                  fetchCotacoes()
                }}
                onEditar={abrirEdicao}
              />
            )}

            {/* Visualização em Lista */}
            {visualizacao === 'lista' && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleOrdenar('data_servico_desejada')}
                      >
                        <div className="flex items-center gap-1">
                          Data Serviço
                          {ordenacao.campo === 'data_servico_desejada' && (
                            <span>{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleOrdenar('clientes')}
                      >
                        <div className="flex items-center gap-1">
                          Cliente
                          {ordenacao.campo === 'clientes' && (
                            <span>{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Telefone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Serviço
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bairro
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleOrdenar('valor_estimado')}
                      >
                        <div className="flex items-center gap-1">
                          Valor
                          {ordenacao.campo === 'valor_estimado' && (
                            <span>{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleOrdenar('status')}
                      >
                        <div className="flex items-center gap-1">
                          Status
                          {ordenacao.campo === 'status' && (
                            <span>{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleOrdenar('created_at')}
                      >
                        <div className="flex items-center gap-1">
                          Data Cotação
                          {ordenacao.campo === 'created_at' && (
                            <span>{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {cotacoes.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center">
                            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-lg font-medium">Nenhuma cotação cadastrada</p>
                            <p className="text-sm mt-1">Clique em "Nova Cotação" para começar</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      cotacoesPaginadas.map((cotacao) => (
                        <tr key={cotacao.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {formatarDataBR(cotacao.data_servico_desejada)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-bold ${
                              cotacao.clientes.tipo_alerta === 'problematico' 
                                ? 'text-red-600' 
                                : cotacao.clientes.tipo_alerta === 'atencao' 
                                  ? 'text-amber-600' 
                                  : 'text-gray-900 font-medium'
                            }`} title={cotacao.clientes.observacao_alerta || undefined}>
                              {cotacao.clientes.tipo_alerta === 'problematico' && '💀 '}
                              {cotacao.clientes.tipo_alerta === 'atencao' && '⚠️ '}
                              {cotacao.clientes.nome}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{cotacao.clientes.telefone || '-'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {cotacao.tipo_servico?.join(', ') || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{cotacao.clientes.bairro || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {cotacao.valor_estimado 
                                ? `R$ ${Number(cotacao.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                                : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(cotacao.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {formatarDataBR(cotacao.created_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => abrirEdicao(cotacao)}
                                size="sm"
                                variant="outline"
                              >
                                <Pencil className="w-4 h-4 mr-1" />
                                Editar
                              </Button>
                              {cotacao.status === 'pendente' && (
                                <>
                                  <Button
                                    onClick={() => {
                                      if (confirm('Aprovar esta cotação?')) {
                                        supabase
                                          .from('cotacoes')
                                          .update({ status: 'aprovada' })
                                          .eq('id', cotacao.id)
                                          .then(() => {
                                            toast({ title: "Cotação aprovada!" })
                                            fetchCotacoes()
                                          })
                                      }
                                    }}
                                    size="sm"
                                    variant="default"
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    Aprovar
                                  </Button>
                                  <Button
                                    onClick={() => setCotacaoParaNaoGerou(cotacao.id)}
                                    size="sm"
                                    variant="outline"
                                    className="text-orange-600 hover:text-orange-700"
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Não Gerou
                                  </Button>
                                </>
                              )}
                              {cotacao.status === 'aprovada' && (
                                <Button
                                  onClick={() => {
                                    if (confirm('Reprovar esta cotação? O serviço associado será removido (se ainda não iniciado).')) {
                                      reprovarCotacao(cotacao.id)
                                    }
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                >
                                  <Undo2 className="w-4 h-4 mr-1" />
                                  Reprovar
                                </Button>
                              )}
                              <Button
                                onClick={() => setCotacaoParaExcluir(cotacao.id)}
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            )}
            {visualizacao === 'lista' && totalPaginas > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Página {paginaAtual} de {totalPaginas}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                    disabled={paginaAtual === 1}
                    size="sm"
                    variant="outline"
                  >
                    Anterior
                  </Button>
                  <Button
                    onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaAtual === totalPaginas}
                    size="sm"
                    variant="outline"
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="importacao">
            <ImportacaoCotacoes />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={!!cotacaoParaEditar} onOpenChange={() => setCotacaoParaEditar(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cotação</DialogTitle>
            <DialogDescription>
              Atualize os dados da cotação e do cliente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div>
              <h3 className="text-lg font-semibold mb-4">Dados do Cliente</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input 
                    value={editForm.cliente_nome}
                    onChange={(e) => setEditForm({...editForm, cliente_nome: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input 
                    value={editForm.cliente_telefone}
                    onChange={(e) => setEditForm({...editForm, cliente_telefone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Idade</Label>
                  <Input 
                    type="number"
                    value={editForm.cliente_idade}
                    onChange={(e) => setEditForm({...editForm, cliente_idade: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input 
                    value={editForm.bairro}
                    onChange={(e) => setEditForm({...editForm, bairro: e.target.value})}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Endereço Completo</Label>
                  <Input 
                    value={editForm.endereco_completo}
                    onChange={(e) => setEditForm({...editForm, endereco_completo: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Dados do Serviço</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Criação (dd/mm/aaaa)</Label>
                  <Input 
                    type="date"
                    value={editForm.data_criacao}
                    onChange={(e) => setEditForm({...editForm, data_criacao: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Desejada (dd/mm/aaaa)</Label>
                  <Input 
                    type="date"
                    value={editForm.data_servico_desejada}
                    onChange={(e) => setEditForm({...editForm, data_servico_desejada: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horário Início</Label>
                  <Select 
                    value={editForm.horario_inicio} 
                    onValueChange={(v) => setEditForm({...editForm, horario_inicio: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {horariosDisponiveis.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duração</Label>
                  <Select 
                    value={editForm.duracao} 
                    onValueChange={(v) => setEditForm({...editForm, duracao: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {duracoesDisponiveis.map((d) => (
                        <SelectItem key={d.valor} value={d.valor}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editForm.horario_inicio && (
                    <p className="text-sm text-muted-foreground">
                      Término previsto: {calcularHorarioFim(editForm.horario_inicio, editForm.duracao)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Valor Estimado</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={editForm.valor_estimado}
                    onChange={(e) => setEditForm({...editForm, valor_estimado: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select 
                    value={editForm.origem_lead} 
                    onValueChange={(v) => setEditForm({...editForm, origem_lead: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Google">Google</SelectItem>
                      <SelectItem value="Indicação">Indicação</SelectItem>
                      <SelectItem value="Já era cliente">Já era cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ocasião</Label>
                  <Input 
                    value={editForm.ocasiao}
                    onChange={(e) => setEditForm({...editForm, ocasiao: e.target.value})}
                    placeholder="Ex: Mudança, Instalação nova"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Serviço</Label>
                  <Select 
                    value={editForm.tipo_servico} 
                    onValueChange={(v) => {
                      setEditForm({...editForm, tipo_servico: v})
                      setShowOutroInput(v === 'Outros')
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposServico.map((tipo) => (
                        <SelectItem key={tipo.id} value={tipo.nome}>{tipo.nome}</SelectItem>
                      ))}
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {showOutroInput && (
                  <div className="space-y-2">
                    <Label>Especifique o serviço</Label>
                    <Input 
                      value={editForm.tipo_servico_outro}
                      onChange={(e) => setEditForm({...editForm, tipo_servico_outro: e.target.value})}
                      placeholder="Ex: Instalação de câmera..."
                    />
                  </div>
                )}
                <div className="col-span-2 space-y-2">
                  <Label>Observações</Label>
                  <Textarea 
                    value={editForm.observacoes}
                    onChange={(e) => setEditForm({...editForm, observacoes: e.target.value})}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCotacaoParaEditar(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarEdicao} disabled={editLoading}>
              {editLoading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!cotacaoParaExcluir} onOpenChange={() => setCotacaoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta cotação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cotacaoParaExcluir) {
                  excluirCotacao(cotacaoParaExcluir)
                  setCotacaoParaExcluir(null)
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Não Gerou Serviço */}
      <Dialog open={!!cotacaoParaNaoGerou} onOpenChange={() => setCotacaoParaNaoGerou(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Não Gerou Serviço</DialogTitle>
            <DialogDescription>
              Selecione o motivo pelo qual esta cotação não gerou um serviço.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo</label>
              <Select value={motivoNaoGerou} onValueChange={setMotivoNaoGerou}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_gerou_longe">Local muito longe</SelectItem>
                  <SelectItem value="nao_gerou_caro">Cliente achou caro</SelectItem>
                  <SelectItem value="nao_gerou_cliente_sumiu">Cliente sumiu/não respondeu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Observações (opcional)</label>
              <Textarea
                value={observacaoNaoGerou}
                onChange={(e) => setObservacaoNaoGerou(e.target.value)}
                placeholder="Adicione observações adicionais sobre esta cotação..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCotacaoParaNaoGerou(null)
              setMotivoNaoGerou('')
              setObservacaoNaoGerou('')
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={marcarNaoGerou}
              disabled={!motivoNaoGerou}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
