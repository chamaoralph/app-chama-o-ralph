import { useNavigate, Link } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImportacaoCotacoes } from '@/components/admin/ImportacaoCotacoes'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Trash2, XCircle, Pencil, Users, Undo2, RotateCcw, List, Calendar, CalendarDays, Ban, Plus, ListFilter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarioCotacoesSemanal } from '@/components/admin/CalendarioCotacoesSemanal'
import { CalendarioCotacoesMensal } from '@/components/admin/CalendarioCotacoesMensal'
import { SelectorPrecoTV, type TVItem, type TotaisTV, novoItemTV } from '@/components/admin/SelectorPrecoTV'
import { ehInstalacaoTV, formatarTipoServicoComTamanho } from '@/lib/precosTV'
import { CatalogoItem, Fornecedor, calcularRepasseAcessorio, formatarBRL } from '@/lib/orcamento'
import { TermoAceiteCard } from '@/components/admin/TermoAceiteCard'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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
  valor_material: number | null
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
    cep: string | null
    idade: number | null
    tipo_alerta: string | null
    observacao_alerta: string | null
  }
  instalador_nome?: string | null
  instalador_id?: string | null
  tv_tamanho?: string | null
  tvs_itens?: { tamanho?: string | null }[] | null
}

interface EditForm {
  cliente_nome: string
  cliente_telefone: string
  cliente_idade: string
  cep: string
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
  valor_material: string
  descricao_servico: string
  observacoes: string
  origem_suporte: string
  custo_suporte: string
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

// Status possíveis de uma cotação — mesmos valores/labels usados em getStatusBadge,
// usado tanto pra montar o filtro quanto pra saber quais status existem.
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'termo_pendente', label: 'Aguardando Termo' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'reprovada', label: 'Reprovada' },
  { value: 'perdida', label: 'Perdida' },
  { value: 'sem_resposta', label: 'Sem Resposta' },
  { value: 'nao_gerou', label: 'Não Gerou' },
]

// Formata data sem conversão de timezone (DD/MM/YYYY) - para campos DATE
function formatarDataLocal(dataString: string | null): string {
  if (!dataString) return '-';
  const [dataPart] = dataString.split('T');
  const [ano, mes, dia] = dataPart.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Formata timestamp UTC para DD/MM/YYYY às HH:MM no fuso de São Paulo
// Detecta timestamps "meia-noite UTC" (data pura do n8n) e exibe apenas DD/MM/YYYY
function formatarTimestampBR(dataString: string | null): string {
  if (!dataString) return '-';
  try {
    const date = new Date(dataString);
    const isMidnightUTC = date.getUTCHours() === 0 && 
                          date.getUTCMinutes() === 0 && 
                          date.getUTCSeconds() === 0;

    if (isMidnightUTC) {
      // Data pura — extrair direto da string sem conversão de timezone
      const dataPart = dataString.includes('T') 
        ? dataString.split('T')[0] 
        : dataString.split(' ')[0];
      const [ano, mes, dia] = dataPart.split('-');
      return `${dia}/${mes}/${ano}`;
    }

    return date.toLocaleString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', ' às');
  } catch {
    return formatarDataLocal(dataString);
  }
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
  const [clientesComTermo, setClientesComTermo] = useState<Set<string>>(new Set())
  const [tiposExigemTermo, setTiposExigemTermo] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cotacaoParaExcluir, setCotacaoParaExcluir] = useState<string | null>(null)
  const [cotacaoParaNaoGerou, setCotacaoParaNaoGerou] = useState<string | null>(null)
  const [cotacaoParaAprovarSemTermo, setCotacaoParaAprovarSemTermo] = useState<{ id: string; clienteTemTermo: boolean } | null>(null)
  const [cotacaoParaEditar, setCotacaoParaEditar] = useState<Cotacao | null>(null)
  // Saldo próprio (movimentacoes_suportes) do instalador atribuído à cotação
  // sendo editada — usado pra travar automaticamente "sai do que ele já tem
  // em mãos" ao adicionar um acessório, sem perguntar (regra: ele tem que
  // usar o que a empresa já entregou antes de puxar do estoque central).
  const [saldoInstaladorAtribuido, setSaldoInstaladorAtribuido] = useState<Record<string, number>>({})

  useEffect(() => {
    const instaladorId = cotacaoParaEditar?.instalador_id
    if (!instaladorId) {
      setSaldoInstaladorAtribuido({})
      return
    }
    supabase
      .from('movimentacoes_suportes')
      .select('catalogo_id, tipo_movimento, quantidade')
      .eq('instalador_id', instaladorId)
      .then(({ data }) => {
        const saldo: Record<string, number> = {}
        ;(data || []).forEach((m: any) => {
          if (!m.catalogo_id) return
          if (m.tipo_movimento === 'entrega') saldo[m.catalogo_id] = (saldo[m.catalogo_id] ?? 0) + m.quantidade
          else if (m.tipo_movimento === 'devolucao' || m.tipo_movimento === 'uso') saldo[m.catalogo_id] = (saldo[m.catalogo_id] ?? 0) - m.quantidade
        })
        setSaldoInstaladorAtribuido(saldo)
      })
  }, [cotacaoParaEditar?.instalador_id])

  // Quantas unidades de um catalogo_id já estão travadas como "sai do saldo
  // próprio" nas linhas atuais de itensExtrasEdit — pra saber se a PRÓXIMA
  // linha do mesmo item ainda cabe no saldo dele ou já precisa perguntar.
  function qtdJaTravadaNoSaldoProprio(catalogoId: string) {
    return itensExtrasEdit
      .filter(i => i.catalogoId === catalogoId && i.origemEstoque === 'instalador')
      .reduce((s, i) => s + (i.quantidade ?? 1), 0)
  }
  const [editForm, setEditForm] = useState<EditForm>({
    cliente_nome: '',
    cliente_telefone: '',
    cliente_idade: '',
    cep: '',
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
    valor_material: '',
    descricao_servico: '',
    observacoes: '',
    origem_suporte: '',
    custo_suporte: ''
  })
  const [editLoading, setEditLoading] = useState(false)
  const [cepErroEdit, setCepErroEdit] = useState(false)
  const [buscandoCepEdit, setBuscandoCepEdit] = useState(false)
  const [motivoNaoGerou, setMotivoNaoGerou] = useState<string>('')
  const [observacaoNaoGerou, setObservacaoNaoGerou] = useState<string>('')
  const [paginaAtual, setPaginaAtual] = useState(1)
  // Todos os status marcados por padrão — filtro não esconde nada até o usuário mexer
  const [statusFiltro, setStatusFiltro] = useState<Set<string>>(
    new Set(STATUS_OPTIONS.map(s => s.value))
  )
  function alternarStatusFiltro(value: string) {
    setStatusFiltro(prev => {
      const proximo = new Set(prev)
      if (proximo.has(value)) proximo.delete(value)
      else proximo.add(value)
      return proximo
    })
    setPaginaAtual(1)
  }
  const [itensPorPagina, setItensPorPagina] = useState(10)
  const [ordenacao, setOrdenacao] = useState<{ campo: string; direcao: 'asc' | 'desc' }>({
    campo: 'created_at',
    direcao: 'desc'
  })
  const [tiposServico, setTiposServico] = useState<TipoServico[]>([])
  const [showOutroInput, setShowOutroInput] = useState(false)
  const [visualizacao, setVisualizacao] = useState<VisualizacaoTipo>('lista')
  const [bloqueandoTelefone, setBloqueandoTelefone] = useState<string | null>(null)
  const [empresaIdAtual, setEmpresaIdAtual] = useState<string | null>(null)
  const [tvItensEdit, setTvItensEdit] = useState<TVItem[]>([novoItemTV()])
  const [tvIndisponivelEdit, setTvIndisponivelEdit] = useState(false)
  const [itensExtrasEdit, setItensExtrasEdit] = useState<{
    id: string
    descricao: string
    valor: string
    // Presentes só quando o item veio do catálogo de acessórios (permite repasse 70/30)
    catalogoId?: string
    custoUnitario?: number
    quantidade?: number
    fornecedor?: Fornecedor
    // De qual saldo a peça sai: 'instalador' = saldo próprio do instalador
    // atribuído (entregue por /admin/suportes, usado automaticamente antes
    // de qualquer outra fonte — ver helper saldoInstaladorClaimedAte). Não
    // aparece pra fornecedor='instalador' autodeclarado (comprou por fora).
    origemEstoque?: Fornecedor
    repasseInstalador?: number
    repasseEmpresa?: number
  }[]>([])
  const totalItensExtrasEdit = itensExtrasEdit.reduce((s, i) => s + (parseFloat(i.valor) || 0), 0)
  const [catalogoAcessorios, setCatalogoAcessorios] = useState<CatalogoItem[]>([])
  const [estoqueSaldos, setEstoqueSaldos] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchCotacoes()
    fetchTiposServico()
    fetchAcessorios()
    fetchEstoqueSaldos()
    ;(async () => {
      if (!user) return
      const { data } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      if (data) setEmpresaIdAtual(data.empresa_id)
    })()
  }, [user])

  async function fetchAcessorios() {
    const { data } = await supabase
      .from('catalogo_servicos')
      .select('*')
      .eq('ativo', true)
      .eq('categoria', 'acessorios')
      .order('ordem')

    setCatalogoAcessorios((data || []) as CatalogoItem[])
  }

  async function fetchEstoqueSaldos() {
    const { data } = await supabase
      .from('estoque_saldo')
      .select('catalogo_id, saldo')

    const mapa: Record<string, number> = {}
    for (const linha of (data || []) as { catalogo_id: string; saldo: number }[]) {
      mapa[linha.catalogo_id] = linha.saldo ?? 0
    }
    setEstoqueSaldos(mapa)
  }

  async function fetchTiposServico() {
    const { data } = await supabase
      .from('tipos_servico')
      .select('id, nome, exige_termo, ativo')
      .order('ordem')
    const ativos = (data || []).filter((t: any) => t.ativo)
    setTiposServico(ativos)
    // Set inclui TODOS os tipos com exige_termo=true (mesmo inativos), comparando por nome (case-insensitive)
    const exigem = new Set<string>(
      (data || [])
        .filter((t: any) => t.exige_termo)
        .map((t: any) => String(t.nome || '').trim().toLowerCase())
    )
    setTiposExigemTermo(exigem)
  }

  function cotacaoExigeTermo(tiposCotacao: string[] | null | undefined): boolean {
    if (!tiposCotacao || tiposCotacao.length === 0) return false
    return tiposCotacao.some(t => tiposExigemTermo.has(String(t || '').trim().toLowerCase()))
  }

  async function fetchCotacoes() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('cotacoes')
        .select('*, clientes(*)')
        .order('created_at', { ascending: false })

      if (error) throw error

      const cotacoesRaw = data || []

      // Buscar instalador_id dos serviços vinculados às cotações
      // (não filtramos por .in(cotacaoIds) aqui: com centenas de cotações essa lista de IDs
      // estoura o limite de tamanho de URL do PostgREST e a query falha silenciosamente)
      let instaladorNomePorCotacao: Record<string, string> = {}
      const instaladorIdPorCotacao: Record<string, string> = {}
      if (cotacoesRaw.length > 0) {
        const { data: servData, error: servError } = await supabase
          .from('servicos')
          .select('cotacao_id, instalador_id')
          .not('cotacao_id', 'is', null)
          .not('instalador_id', 'is', null)

        if (servError) console.error('Erro ao buscar instalador dos serviços:', servError)

        if (servData && servData.length > 0) {
          const instaladorIds = [...new Set(servData.map(s => s.instalador_id as string))]
          const { data: usersData } = await supabase
            .from('usuarios')
            .select('id, nome')
            .in('id', instaladorIds)

          const nomeMap: Record<string, string> = {}
          usersData?.forEach(u => { nomeMap[u.id] = u.nome })
          servData.forEach(s => {
            if (s.cotacao_id && s.instalador_id && nomeMap[s.instalador_id]) {
              instaladorNomePorCotacao[s.cotacao_id] = nomeMap[s.instalador_id]
              instaladorIdPorCotacao[s.cotacao_id] = s.instalador_id as string
            }
          })
        }
      }

      setCotacoes(cotacoesRaw.map(c => ({
        ...c,
        instalador_nome: instaladorNomePorCotacao[c.id] ?? null,
        instalador_id: instaladorIdPorCotacao[c.id] ?? null,
      })) as any)

      // Buscar clientes que já assinaram pelo menos 1 termo
      const { data: termos } = await supabase
        .from('termos_aceite')
        .select('cotacao_id')
        .eq('status', 'aceito')
      
      if (termos && termos.length > 0) {
        const cotacaoIds = termos.map(t => t.cotacao_id)
        const { data: cotacoesComTermo } = await supabase
          .from('cotacoes')
          .select('cliente_id')
          .in('id', cotacaoIds)
        
        const clientesSet = new Set<string>(
          (cotacoesComTermo || []).map(c => c.cliente_id).filter(Boolean)
        )
        setClientesComTermo(clientesSet)
      } else {
        setClientesComTermo(new Set())
      }
    } catch (err) {
      console.error('Erro ao buscar cotações:', err)
      setError('Erro ao carregar cotações')
    } finally {
      setLoading(false)
    }
  }

  // Extrai apenas YYYY-MM-DD de uma string de data (com ou sem timezone)
  function extrairDataParaInput(dataStr: string | null | undefined): string {
    if (!dataStr) return ''
    // Remove espaços extras e pega apenas a parte da data
    const trimmed = dataStr.trim()
    // Pode vir como "YYYY-MM-DD", "YYYY-MM-DDTHH:MM" ou "YYYY-MM-DD HH:MM"
    const dataPart = trimmed.includes('T') 
      ? trimmed.split('T')[0] 
      : trimmed.split(' ')[0]
    // Validação básica: deve ter formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPart)) return ''
    return dataPart
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
      cep: cotacao.clientes.cep || '',
      endereco_completo: cotacao.clientes.endereco_completo || '',
      bairro: cotacao.clientes.bairro || '',
      origem_lead: cotacao.origem_lead || '',
      ocasiao: cotacao.ocasiao || '',
      data_servico_desejada: extrairDataParaInput(cotacao.data_servico_desejada),
      horario_inicio: cotacao.horario_inicio?.substring(0, 5) || '',
      duracao: duracao,
      data_criacao: extrairDataParaInput(cotacao.created_at),
      tipo_servico: ehTipoCadastrado ? tipoAtual : (tipoAtual ? 'Outros' : ''),
      tipo_servico_outro: ehTipoCadastrado ? '' : tipoAtual,
      valor_estimado: cotacao.valor_estimado?.toString() || '',
      valor_material: cotacao.valor_material?.toString() || '',
      descricao_servico: cotacao.descricao_servico || '',
      observacoes: cotacao.observacoes || '',
      origem_suporte: (cotacao as any).origem_suporte || '',
      custo_suporte: (cotacao as any).custo_suporte?.toString() || ''
    })
    setShowOutroInput(!ehTipoCadastrado && !!tipoAtual)
    // Carregar tvs_itens existente, ou construir a partir das colunas legadas
    const tvsExistentes = (cotacao as any).tvs_itens as TVItem[] | null
    if (Array.isArray(tvsExistentes) && tvsExistentes.length > 0) {
      setTvItensEdit(tvsExistentes)
    } else if ((cotacao as any).tv_tamanho) {
      setTvItensEdit([{
        ...novoItemTV(),
        tamanho: (cotacao as any).tv_tamanho || '',
        parede: (cotacao as any).tv_parede || '',
        cobertura: (cotacao as any).tv_cobertura || '',
      }])
    } else {
      setTvItensEdit([novoItemTV()])
    }
    setTvIndisponivelEdit(false)
    const itensExistentes = (cotacao as any).itens_extras
    setItensExtrasEdit(
      Array.isArray(itensExistentes)
        ? itensExistentes.map((i: any, idx: number) => ({
            id: `${idx}`,
            descricao: String(i.descricao || ''),
            valor: String(i.valor || ''),
            catalogoId: i.catalogo_id ?? undefined,
            custoUnitario: i.custo_unitario ?? undefined,
            quantidade: i.quantidade ?? undefined,
            fornecedor: i.fornecedor ?? undefined,
            origemEstoque: i.origem_estoque ?? undefined,
          }))
        : []
    )
    setCotacaoParaEditar(cotacao)
    setCepErroEdit(false)
    setBuscandoCepEdit(false)
  }

  async function handleCepChangeEdit(valor: string) {
    const digitos = valor.replace(/\D/g, '').slice(0, 8)
    const formatado = digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos
    setEditForm(prev => ({ ...prev, cep: formatado }))
    setCepErroEdit(false)

    if (digitos.length !== 8) return

    setBuscandoCepEdit(true)
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`)
      const data = await resp.json()

      if (data.erro) {
        setCepErroEdit(true)
      } else {
        const cidadeUf = data.localidade && data.uf ? `${data.localidade} - ${data.uf}` : ''
        const enderecoBase = [data.logradouro, cidadeUf].filter(Boolean).join(', ')
        setEditForm(prev => ({
          ...prev,
          bairro: data.bairro || prev.bairro,
          endereco_completo: enderecoBase || prev.endereco_completo,
        }))
      }
    } catch {
      setCepErroEdit(true)
    } finally {
      setBuscandoCepEdit(false)
    }
  }

  function handleTotaisCalculadosEdit(totais: TotaisTV, indisponivel: boolean) {
    setTvIndisponivelEdit(indisponivel)
    setEditForm(prev => ({
      ...prev,
      valor_estimado: totais.totalMaoObra ? totais.totalMaoObra.toString() : '',
      valor_material: totais.origemSuporte === 'empresa' ? '' : (totais.totalMaterial ? totais.totalMaterial.toString() : ''),
      origem_suporte: totais.origemSuporte,
      custo_suporte: totais.totalCustoSuporte ? totais.totalCustoSuporte.toString() : '',
    }))
  }

  async function salvarEdicao() {
    if (!cotacaoParaEditar) return

    if (itensExtrasEdit.some(i => i.catalogoId && !i.fornecedor)) {
      toast({ title: "Escolha o fornecedor de cada acessório", description: "Empresa ou Instalador, para calcular o repasse.", variant: "destructive" })
      return
    }

    setEditLoading(true)

    try {
      // Atualizar cliente
      const { error: erroCliente } = await supabase
        .from('clientes')
        .update({
          nome: editForm.cliente_nome,
          telefone: editForm.cliente_telefone,
          idade: editForm.cliente_idade ? parseInt(editForm.cliente_idade) : null,
          cep: editForm.cep || null,
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
          valor_estimado: (() => { const base = parseFloat(editForm.valor_estimado) || 0; const total = base + totalItensExtrasEdit; return total > 0 ? total : null })(),
          itens_extras: itensExtrasEdit
            .filter(i => i.descricao.trim() && parseFloat(i.valor) > 0)
            .map(i => {
              const descricao = i.descricao.trim()
              const valor = parseFloat(i.valor)
              if (!i.catalogoId || !i.fornecedor) return { descricao, valor }
              const repasse = calcularRepasseAcessorio(valor, (i.custoUnitario ?? 0) * (i.quantidade ?? 1), i.fornecedor)
              return {
                descricao,
                valor,
                eh_acessorio: true,
                catalogo_id: i.catalogoId,
                quantidade: i.quantidade ?? 1,
                custo_unitario: i.custoUnitario ?? 0,
                fornecedor: i.fornecedor,
                // Só manda origem_estoque quando travado no saldo próprio do
                // instalador atribuído — o banco (sincronizar_servico_ao_
                // editar_cotacao) respeita esse hint e não tenta puxar do
                // estoque central mesmo que ele tenha saldo (ver migration
                // 20260811090000). Sem isso, o banco decide sozinho pelo
                // estoque central disponível.
                ...(i.origemEstoque === 'instalador' ? { origem_estoque: 'instalador' } : {}),
                repasse_instalador: repasse.repasse_instalador,
                repasse_empresa: repasse.repasse_empresa,
              }
            }) as any,
          valor_material: editForm.origem_suporte === 'empresa' ? 0 : (editForm.valor_material ? parseFloat(editForm.valor_material) : null),
          origem_lead: editForm.origem_lead || null,
          ocasiao: editForm.ocasiao || null,
          descricao_servico: editForm.descricao_servico || null,
          observacoes: editForm.observacoes || null,
          origem_suporte: editForm.origem_suporte || null,
          custo_suporte: editForm.custo_suporte ? parseFloat(editForm.custo_suporte) : 0,
          tv_tamanho: tvItensEdit[0]?.tamanho || null,
          tv_parede: tvItensEdit[0]?.parede || null,
          tv_cobertura: tvItensEdit[0]?.cobertura || null,
          tvs_itens: tvItensEdit as any,
        } as any)
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
      const { data: servico, error: erroServico } = await supabase
        .from('servicos')
        .select('id, status')
        .eq('cotacao_id', id)
        .maybeSingle()

      if (erroServico) throw erroServico

      if (servico) {
        const statusPermitidos = ['disponivel', 'solicitado', 'atribuido', 'cancelado']

        if (!statusPermitidos.includes(servico.status || '')) {
          toast({
            title: 'Não é possível excluir',
            description: `Esta cotação já gerou um serviço com status "${servico.status}". Remova ou reverta o serviço antes de excluir a cotação.`,
            variant: 'destructive'
          })
          return
        }

        const { error: erroMovimentacoes } = await supabase
          .from('movimentacoes_suportes')
          .delete()
          .eq('servico_id', servico.id)

        if (erroMovimentacoes) throw erroMovimentacoes

        const { error: erroLancamentos } = await supabase
          .from('lancamentos_caixa')
          .delete()
          .eq('servico_id', servico.id)

        if (erroLancamentos) throw erroLancamentos

        const { error: erroDeletarServico } = await supabase
          .from('servicos')
          .delete()
          .eq('id', servico.id)

        if (erroDeletarServico) throw erroDeletarServico
      }

      const { error } = await supabase
        .from('cotacoes')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Cotação excluída',
        description: servico
          ? 'A cotação e o serviço vinculado foram removidos com sucesso.'
          : 'A cotação foi removida com sucesso.',
      })

      fetchCotacoes()
    } catch (err) {
      console.error('Erro ao excluir cotação:', err)

      const mensagem =
        typeof err === 'object' && err !== null && 'message' in err
          ? String(err.message)
          : 'Não foi possível excluir a cotação.'

      toast({
        title: 'Erro',
        description: mensagem,
        variant: 'destructive'
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

  async function reativarCotacao(cotacaoId: string) {
    try {
      const { error } = await supabase
        .from('cotacoes')
        .update({ status: 'pendente' })
        .eq('id', cotacaoId)

      if (error) throw error

      toast({
        title: "✅ Cotação reativada",
        description: "A cotação voltou para pendente e poderá ser avaliada novamente."
      })

      fetchCotacoes()
    } catch (err) {
      console.error('Erro ao reativar cotação:', err)
      toast({
        title: "❌ Erro",
        description: "Não foi possível reativar a cotação.",
        variant: "destructive"
      })
    }
  }

  async function bloquearTelefone(cotacao: Cotacao) {
    const telefone = cotacao.clientes.telefone
    const nome = cotacao.clientes.nome
    if (!confirm(`Bloquear o número ${telefone} (${nome})?\n\nEste número não criará mais cotações automáticas pelo WhatsApp.`)) return

    setBloqueandoTelefone(cotacao.id)
    try {
      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user?.id)
        .single()

      if (!userData) throw new Error('Empresa não encontrada')

      const { error } = await supabase
        .from('telefones_bloqueados')
        .insert({
          empresa_id: userData.empresa_id,
          telefone: telefone.replace(/\D/g, ''),
          motivo: `Bloqueado da cotação de ${nome}`
        })

      if (error) {
        if (error.code === '23505') {
          toast({ title: '⚠️ Já bloqueado', description: 'Este número já está na lista de bloqueio.' })
        } else {
          throw error
        }
      } else {
        toast({ title: '🚫 Número bloqueado', description: `${telefone} não criará mais cotações automáticas.` })
      }
    } catch (err) {
      console.error('Erro ao bloquear:', err)
      toast({ title: '❌ Erro', description: 'Não foi possível bloquear o número.', variant: 'destructive' })
    } finally {
      setBloqueandoTelefone(null)
    }
  }

  const handleOrdenar = (campo: string) => {
    if (ordenacao.campo === campo) {
      setOrdenacao({ campo, direcao: ordenacao.direcao === 'asc' ? 'desc' : 'asc' })
    } else {
      setOrdenacao({ campo, direcao: 'asc' })
    }
  }

  // Um status fora do STATUS_OPTIONS (ex: valor legado/inesperado) nunca fica
  // escondido silenciosamente — só os status conhecidos respeitam o filtro.
  const statusConhecidos = new Set(STATUS_OPTIONS.map(s => s.value))
  const cotacoesFiltradas = cotacoes.filter(
    c => !statusConhecidos.has(c.status) || statusFiltro.has(c.status)
  )

  const cotacoesOrdenadas = [...cotacoesFiltradas].sort((a, b) => {
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
      termo_pendente: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Aguardando Termo' },
      aprovada: { bg: 'bg-green-100', text: 'text-green-800', label: 'Aprovada' },
      reprovada: { bg: 'bg-red-100', text: 'text-red-800', label: 'Reprovada' },
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

  // Botões de ação de uma cotação — usado tanto na tabela desktop quanto
  // nos cards mobile, pra não duplicar essa lógica cheia de condicionais.
  const renderAcoes = (cotacao: Cotacao) => (
    <div className="flex items-center gap-2 flex-wrap">
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
          {(() => {
            const temValor = (cotacao.valor_estimado ?? 0) > 0
            const exigeTermo = cotacaoExigeTermo(cotacao.tipo_servico)
            const aprovarBtn = (
              <Button
                onClick={() => {
                  if (!temValor) {
                    toast({
                      title: "Valor não preenchido",
                      description: "Preencha o tamanho/parede da TV (ou um valor manual) antes de aprovar. Use o botão Editar.",
                      variant: "destructive",
                    })
                    return
                  }
                  if (exigeTermo) {
                    if (confirm('Aprovar esta cotação? O cliente precisará assinar o termo digital antes do serviço ser liberado para os instaladores.')) {
                      supabase
                        .from('cotacoes')
                        .update({ status: 'termo_pendente' })
                        .eq('id', cotacao.id)
                        .then(() => {
                          toast({ title: "Cotação aprovada!", description: "Abra a cotação para enviar o termo de aceite ao cliente." })
                          fetchCotacoes()
                        })
                    }
                  } else {
                    // Tipo de serviço não exige termo — libera direto
                    supabase
                      .from('cotacoes')
                      .update({ status: 'aprovada' })
                      .eq('id', cotacao.id)
                      .then(() => {
                        toast({ title: "Cotação aprovada!", description: "Serviço liberado para os instaladores (este tipo não exige termo)." })
                        fetchCotacoes()
                      })
                  }
                }}
                size="sm"
                variant="default"
                disabled={!temValor}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aprovar
              </Button>
            )
            if (temValor) return aprovarBtn
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>{aprovarBtn}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Preencha o tamanho/parede da TV (ou valor manual) antes de aprovar. Use Editar.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          })()}
          {cotacaoExigeTermo(cotacao.tipo_servico) && (() => {
            const clienteTemTermo = clientesComTermo.has(cotacao.cliente_id)
            const temValor = (cotacao.valor_estimado ?? 0) > 0
            const habilitado = temValor
            const btn = (
              <Button
                onClick={() => {
                  if (!habilitado) return
                  setCotacaoParaAprovarSemTermo({ id: cotacao.id, clienteTemTermo })
                }}
                size="sm"
                variant="outline"
                disabled={!habilitado}
                className="order-2 md:order-none text-green-700 border-green-300 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aprovar sem termo
              </Button>
            )
            if (habilitado) return btn
            const motivo = "Preencha o tamanho/parede da TV (ou valor manual) antes de aprovar."
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>{btn}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {motivo}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          })()}
          <Button
            onClick={() => setCotacaoParaNaoGerou(cotacao.id)}
            size="sm"
            variant="outline"
            className="order-1 md:order-none text-orange-600 hover:text-orange-700"
          >
            <XCircle className="w-4 h-4 mr-1" />
            Não Gerou
          </Button>
        </>
      )}
      {cotacao.status === 'termo_pendente' && (
        <>
          <Button
            onClick={() => abrirEdicao(cotacao)}
            size="sm"
            variant="default"
            className="bg-orange-600 hover:bg-orange-700"
            title="Abrir cotação para enviar/acompanhar o termo"
          >
            Enviar Termo
          </Button>
          <Button
            onClick={() => {
              if (confirm('Voltar esta cotação para pendente?')) {
                supabase
                  .from('cotacoes')
                  .update({ status: 'pendente' })
                  .eq('id', cotacao.id)
                  .then(() => {
                    toast({ title: "Cotação voltou para pendente" })
                    fetchCotacoes()
                  })
              }
            }}
            size="sm"
            variant="outline"
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
          >
            <Undo2 className="w-4 h-4 mr-1" />
            Reprovar
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
      {(cotacao.status === 'reprovada' || cotacao.status === 'perdida' || cotacao.status === 'nao_gerou') && (
        <Button
          onClick={() => {
            if (confirm('Reativar esta cotação? Ela voltará para pendente e poderá ser avaliada novamente.')) {
              reativarCotacao(cotacao.id)
            }
          }}
          size="sm"
          variant="outline"
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Reativar
        </Button>
      )}
      <Button
        onClick={() => bloquearTelefone(cotacao)}
        size="sm"
        variant="ghost"
        className="order-3 md:order-none text-orange-600 hover:text-orange-700 hover:bg-orange-50"
        disabled={bloqueandoTelefone === cotacao.id}
        title="Bloquear número"
      >
        <Ban className="w-4 h-4" />
      </Button>
      <Button
        onClick={() => setCotacaoParaExcluir(cotacao.id)}
        size="sm"
        variant="ghost"
        className="order-4 md:order-none text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )

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
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6">
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
          <TabsList className="hidden md:grid w-full max-w-md grid-cols-2 mb-6">
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
                  className="hidden md:inline-flex"
                >
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Mensal
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ListFilter className="w-4 h-4 mr-2" />
                      Status
                      {statusFiltro.size < STATUS_OPTIONS.length && (
                        <span className="ml-1.5 bg-blue-100 text-blue-700 text-xs rounded-full px-1.5 py-0.5">
                          {statusFiltro.size}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel className="flex items-center justify-between gap-2">
                      <span>Mostrar status</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs font-normal text-blue-600 hover:underline"
                          onClick={() => { setStatusFiltro(new Set(STATUS_OPTIONS.map(s => s.value))); setPaginaAtual(1) }}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          className="text-xs font-normal text-blue-600 hover:underline"
                          onClick={() => { setStatusFiltro(new Set()); setPaginaAtual(1) }}
                        >
                          Nenhum
                        </button>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {STATUS_OPTIONS.map(opt => (
                      <DropdownMenuCheckboxItem
                        key={opt.value}
                        checked={statusFiltro.has(opt.value)}
                        onCheckedChange={() => alternarStatusFiltro(opt.value)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {opt.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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
                    Total: {cotacoesFiltradas.length}
                    {cotacoesFiltradas.length !== cotacoes.length && <> de {cotacoes.length}</>} cotações
                  </div>
                </div>
              )}

              {visualizacao !== 'lista' && (
                <div className="text-sm text-gray-600">
                  Total: {cotacoesFiltradas.length}
                  {cotacoesFiltradas.length !== cotacoes.length && <> de {cotacoes.length}</>} cotações
                </div>
              )}
            </div>

            {/* Visualização em Calendário Semanal */}
            {visualizacao === 'semanal' && (
              <CalendarioCotacoesSemanal
                cotacoes={cotacoesFiltradas}
                onAprovar={async (id) => {
                  await supabase.from('cotacoes').update({ status: 'termo_pendente' }).eq('id', id)
                  toast({ title: '✅ Cotação aprovada!', description: 'Envie o termo de aceite ao cliente para liberar o serviço.' })
                  fetchCotacoes()
                }}
                onEditar={abrirEdicao}
                onExcluir={excluirCotacao}
              />
            )}

            {/* Visualização em Calendário Mensal */}
            {visualizacao === 'mensal' && (
              <CalendarioCotacoesMensal
                cotacoes={cotacoesFiltradas}
                onAprovar={async (id) => {
                  await supabase.from('cotacoes').update({ status: 'termo_pendente' }).eq('id', id)
                  toast({ title: '✅ Cotação aprovada!', description: 'Envie o termo de aceite ao cliente para liberar o serviço.' })
                  fetchCotacoes()
                }}
                onEditar={abrirEdicao}
                onExcluir={excluirCotacao}
              />
            )}

            {/* Visualização em Lista */}
            {visualizacao === 'lista' && (
              <>
                {/* Mobile: cards, sem tabela de 9 colunas pra rolar de lado */}
                <div className="md:hidden bg-white rounded-lg shadow-md divide-y divide-gray-200">
                  {cotacoesFiltradas.length === 0 ? (
                    <div className="px-6 py-12 text-center text-gray-500">
                      {cotacoes.length === 0 ? (
                        <>
                          <p className="text-lg font-medium">Nenhuma cotação cadastrada</p>
                          <p className="text-sm mt-1">Clique em "Nova Cotação" para começar</p>
                        </>
                      ) : (
                        <p className="text-lg font-medium">Nenhuma cotação com esse filtro de status</p>
                      )}
                    </div>
                  ) : (
                    cotacoesPaginadas.map((cotacao) => (
                      <div key={cotacao.id} className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className={`text-sm font-bold ${
                              cotacao.clientes.tipo_alerta === 'problematico'
                                ? 'text-red-600'
                                : cotacao.clientes.tipo_alerta === 'atencao'
                                  ? 'text-amber-600'
                                  : 'text-gray-900'
                            }`} title={cotacao.clientes.observacao_alerta || undefined}>
                              {cotacao.clientes.tipo_alerta === 'problematico' && '💀 '}
                              {cotacao.clientes.tipo_alerta === 'atencao' && '⚠️ '}
                              {cotacao.clientes.nome}
                            </p>
                            <p className="text-xs text-gray-500">{cotacao.clientes.telefone || '-'}</p>
                          </div>
                          {getStatusBadge(cotacao.status)}
                        </div>
                        <p className="text-sm text-gray-900 mb-2">
                          {formatarTipoServicoComTamanho(cotacao.tipo_servico, cotacao.tv_tamanho, cotacao.tvs_itens) || '-'}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mb-1">
                          <span>📅 {formatarDataLocal(cotacao.data_servico_desejada)}</span>
                          <span>📍 {cotacao.clientes.bairro || '-'}</span>
                          <span>
                            💰 {cotacao.valor_estimado
                              ? `R$ ${Number(cotacao.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              : '-'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mb-3">
                          Cotado em {formatarTimestampBR(cotacao.created_at)}
                        </p>
                        {renderAcoes(cotacao)}
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop: tabela completa com ordenação por coluna */}
                <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
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
                    {cotacoesFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center">
                            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {cotacoes.length === 0 ? (
                              <>
                                <p className="text-lg font-medium">Nenhuma cotação cadastrada</p>
                                <p className="text-sm mt-1">Clique em "Nova Cotação" para começar</p>
                              </>
                            ) : (
                              <p className="text-lg font-medium">Nenhuma cotação com esse filtro de status</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      cotacoesPaginadas.map((cotacao) => (
                        <tr key={cotacao.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {formatarDataLocal(cotacao.data_servico_desejada)}
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
                              {formatarTipoServicoComTamanho(cotacao.tipo_servico, cotacao.tv_tamanho, cotacao.tvs_itens) || '-'}
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
                              {formatarTimestampBR(cotacao.created_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {renderAcoes(cotacao)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  </table>
                </div>
              </div>
              </>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2 space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={editForm.cep}
                    onChange={(e) => handleCepChangeEdit(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  {buscandoCepEdit && (
                    <p className="text-xs text-muted-foreground">Buscando endereço...</p>
                  )}
                  {cepErroEdit && (
                    <p className="text-xs text-red-600">CEP não encontrado. Preencha o endereço manualmente.</p>
                  )}
                </div>
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
                <div className="col-span-1 sm:col-span-2 space-y-2">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <Label>Valor Mão de Obra (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.valor_estimado}
                    onChange={(e) => setEditForm({...editForm, valor_estimado: e.target.value})}
                    placeholder="0,00"
                  />
                  {ehInstalacaoTV(editForm.tipo_servico) && editForm.valor_estimado && (
                    <p className="text-xs text-muted-foreground">💡 Calculado pela calculadora. Edite se necessário.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Valor do Material (R$)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={editForm.origem_suporte === 'empresa' ? '' : editForm.valor_material}
                    onChange={(e) => setEditForm({...editForm, valor_material: e.target.value})}
                    placeholder="0,00"
                    disabled={editForm.origem_suporte === 'empresa'}
                  />
                  {editForm.origem_suporte === 'empresa' && (
                    <p className="text-xs text-muted-foreground">
                      💡 Sem reembolso quando a empresa fornece o suporte
                    </p>
                  )}
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
                      {tiposServico.filter(tipo => tipo.nome && tipo.nome.trim() !== '').map((tipo) => (
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
                {ehInstalacaoTV(editForm.tipo_servico) && (
                  <SelectorPrecoTV
                    empresaId={empresaIdAtual}
                    items={tvItensEdit}
                    onItemsChange={setTvItensEdit}
                    onTotaisChange={handleTotaisCalculadosEdit}
                  />
                )}

                {/* Itens extras */}
                <div className="col-span-1 sm:col-span-2 border rounded-md p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium">Itens Extras</span>
                    <div className="flex gap-2">
                      {catalogoAcessorios.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            const item = catalogoAcessorios.find(c => c.id === e.target.value)
                            if (!item) return
                            const quantidade = 1
                            const valor = item.preco * quantidade
                            const repasse = calcularRepasseAcessorio(valor, item.custo * quantidade, 'empresa')
                            // Se o instalador atribuído a esta cotação já tem
                            // (em mãos) uma unidade desse item que ainda não
                            // foi usada por outra linha desta mesma edição,
                            // trava automático nela — sem perguntar. Regra:
                            // ele usa o que a empresa já entregou antes de
                            // puxar de qualquer outro lugar.
                            const jaTravado = qtdJaTravadaNoSaldoProprio(item.id)
                            const saldoDisponivel = (saldoInstaladorAtribuido[item.id] ?? 0) - jaTravado
                            const travaNoSaldoProprio = !!cotacaoParaEditar?.instalador_id && saldoDisponivel >= quantidade
                            setItensExtrasEdit(prev => [...prev, {
                              id: `${Date.now()}`,
                              descricao: item.nome,
                              valor: valor.toString(),
                              catalogoId: item.id,
                              custoUnitario: item.custo,
                              quantidade,
                              fornecedor: 'empresa',
                              origemEstoque: travaNoSaldoProprio ? 'instalador' : undefined,
                              repasseInstalador: repasse.repasse_instalador,
                              repasseEmpresa: repasse.repasse_empresa,
                            }])
                          }}
                          className="px-2 py-1 border rounded-md text-sm bg-white"
                        >
                          <option value="">+ Acessório do catálogo...</option>
                          {catalogoAcessorios.map(item => {
                            const saldo = estoqueSaldos[item.id] ?? 0
                            // Sem estoque central não bloqueia mais: a peça
                            // pode estar em mãos de um instalador (entregue
                            // por /admin/suportes — continua sendo estoque da
                            // empresa, só descentralizado). Serviços
                            // Disponíveis filtra depois quem pode atender.
                            return (
                              <option key={item.id} value={item.id}>
                                {item.nome} — {saldo > 0 ? `${saldo} em estoque` : 'sem estoque central'}
                              </option>
                            )
                          })}
                        </select>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setItensExtrasEdit(prev => [...prev, { id: `${Date.now()}`, descricao: '', valor: '' }])}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Adicionar Item
                      </Button>
                    </div>
                  </div>
                  {itensExtrasEdit.length === 0 && (
                    <p className="text-xs text-muted-foreground">Ex: suporte extra, material adicional, bronca...</p>
                  )}
                  {itensExtrasEdit.map((item) => (
                    <div key={item.id} className="space-y-1">
                      <div className="flex gap-2 items-center">
                        <Input
                          placeholder="Descrição do item"
                          value={item.descricao}
                          onChange={(e) => setItensExtrasEdit(prev => prev.map(i => i.id === item.id ? { ...i, descricao: e.target.value } : i))}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={item.valor}
                          onChange={(e) => setItensExtrasEdit(prev => prev.map(i => i.id === item.id ? { ...i, valor: e.target.value } : i))}
                          className="w-28"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setItensExtrasEdit(prev => prev.filter(i => i.id !== item.id))}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                      {item.catalogoId && item.origemEstoque === 'instalador' && (
                        <div className="flex items-center gap-2 pl-1">
                          <span className="text-xs text-muted-foreground">
                            ✓ Sai do que {cotacaoParaEditar?.instalador_nome || 'o instalador'} já tem em mãos
                          </span>
                        </div>
                      )}
                      {item.catalogoId && item.origemEstoque !== 'instalador' && (
                        <div className="flex items-center gap-2 pl-1">
                          <span className="text-xs text-muted-foreground">Acessório · Fornecedor:</span>
                          <Button
                            type="button"
                            size="sm"
                            variant={item.fornecedor === 'empresa' ? 'default' : 'outline'}
                            className="h-6 px-2 text-xs"
                            onClick={() => setItensExtrasEdit(prev => prev.map(i => i.id === item.id ? { ...i, fornecedor: 'empresa' } : i))}
                          >
                            Estoque da empresa
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={item.fornecedor === 'instalador' ? 'default' : 'outline'}
                            className="h-6 px-2 text-xs"
                            onClick={() => setItensExtrasEdit(prev => prev.map(i => i.id === item.id ? { ...i, fornecedor: 'instalador' } : i))}
                          >
                            Instalador comprou por fora
                          </Button>
                          {!item.fornecedor && (
                            <span className="text-xs text-amber-600">Escolha quem forneceu</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {itensExtrasEdit.length > 0 && (
                    <div className="text-sm text-right text-muted-foreground border-t pt-2">
                      Mão de obra: R$ {(parseFloat(editForm.valor_estimado) || 0).toFixed(2)}
                      {totalItensExtrasEdit > 0 && <> + Itens extras: R$ {totalItensExtrasEdit.toFixed(2)}</>}
                      <span className="font-semibold text-foreground ml-2">= R$ {((parseFloat(editForm.valor_estimado) || 0) + totalItensExtrasEdit).toFixed(2)}</span>
                      {(() => {
                        const totais = itensExtrasEdit
                          .filter(i => i.catalogoId && i.fornecedor)
                          .reduce((acc, i) => {
                            const r = calcularRepasseAcessorio(parseFloat(i.valor) || 0, (i.custoUnitario ?? 0) * (i.quantidade ?? 1), i.fornecedor!)
                            return { instalador: acc.instalador + r.repasse_instalador, empresa: acc.empresa + r.repasse_empresa }
                          }, { instalador: 0, empresa: 0 })
                        if (totais.instalador === 0 && totais.empresa === 0) return null
                        return (
                          <div className="text-xs mt-1">
                            Repasse acessórios — Instalador: {formatarBRL(totais.instalador)} · Empresa: {formatarBRL(totais.empresa)}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>

                <div className="col-span-1 sm:col-span-2 space-y-2">
                  <Label>Descrição do Serviço (Detalhes)</Label>
                  <Textarea 
                    value={editForm.descricao_servico}
                    onChange={(e) => setEditForm({...editForm, descricao_servico: e.target.value})}
                    placeholder="Detalhes técnicos do serviço..."
                    rows={3}
                  />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-2">
                  <Label>Observações</Label>
                  <Textarea 
                    value={editForm.observacoes}
                    onChange={(e) => setEditForm({...editForm, observacoes: e.target.value})}
                    rows={3}
                  />
                </div>
            </div>
          </div>

          {cotacaoParaEditar && ehInstalacaoTV(editForm.tipo_servico) && (
            <div className="mt-4">
              <TermoAceiteCard
                cotacao={{
                  id: cotacaoParaEditar.id,
                  empresa_id: empresaIdAtual || '',
                  cliente_nome: editForm.cliente_nome,
                  cliente_telefone: editForm.cliente_telefone,
                  cliente_endereco: editForm.endereco_completo,
                }}
                tvsItens={tvItensEdit}
              />
            </div>
          )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCotacaoParaEditar(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarEdicao} disabled={editLoading || tvIndisponivelEdit || itensExtrasEdit.some(i => i.catalogoId && !i.fornecedor)}>
              {editLoading ? 'Salvando...' : tvIndisponivelEdit ? 'Combinação indisponível' : 'Salvar Alterações'}
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

      {/* AlertDialog: Aprovar sem termo */}
      <AlertDialog open={!!cotacaoParaAprovarSemTermo} onOpenChange={() => setCotacaoParaAprovarSemTermo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar sem termo de aceite?</AlertDialogTitle>
            <AlertDialogDescription>
              {cotacaoParaAprovarSemTermo?.clienteTemTermo
                ? "O serviço será liberado imediatamente para os instaladores, sem exigir assinatura digital do cliente."
                : "⚠️ Esse cliente NUNCA assinou um termo. Deseja prosseguir e liberar o serviço sem termo assinado?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={async () => {
                if (!cotacaoParaAprovarSemTermo) return
                const { error } = await supabase
                  .from('cotacoes')
                  .update({ status: 'aprovada' })
                  .eq('id', cotacaoParaAprovarSemTermo.id)
                if (error) {
                  toast({ title: "Erro ao aprovar", description: error.message, variant: "destructive" })
                } else {
                  toast({ title: "Cotação aprovada sem termo!" })
                  fetchCotacoes()
                }
                setCotacaoParaAprovarSemTermo(null)
              }}
            >
              Sim, aprovar
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
                  <SelectItem value="nao_gerou_instalador_atrasou">Instalador atrasou</SelectItem>
                  <SelectItem value="nao_gerou_chamou_outra">Chamou outra pessoa</SelectItem>
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
