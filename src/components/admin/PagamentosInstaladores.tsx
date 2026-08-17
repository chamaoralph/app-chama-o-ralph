import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { format, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatarDataBR } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { Check, Upload, Eye, Clock, DollarSign, FileText, Pencil, Plus, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ReciboComInstalador {
  id: string
  data_referencia: string
  instalador_id: string
  instalador_nome: string
  quantidade_servicos: number
  valor_mao_obra: number
  valor_reembolso: number
  valor_total: number
  valor_recebido_cliente: number
  /** mão de obra + reembolso − recebido em mãos pelo instalador. > 0 = empresa deve pagar; < 0 = instalador deve devolver */
  saldo: number
  status_pagamento: string
  data_pagamento: string | null
  comprovante_pix_url: string | null
}

/** Categorias que já existiram em lancamentos_caixa para o pagamento de um recibo diário (inclui legado). */
const CATEGORIAS_LANCAMENTO_RECIBO = ['Pagamento Instalador', 'Reembolso Materiais', 'Recebimento Instalador']

interface ReciboFaltante {
  instalador_id: string
  instalador_nome: string
  data: string // yyyy-MM-dd
  servicos: {
    id: string
    valor_mao_obra_instalador: number
    valor_reembolso_despesas: number
    valor_recebido_cliente: number
  }[]
  totalMaoObra: number
  totalReembolso: number
  totalRecebidoCliente: number
  totalGeral: number
}

export function PagamentosInstaladores() {
  const [recibos, setRecibos] = useState<ReciboComInstalador[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroDirecao, setFiltroDirecao] = useState('todos') // todos | a_pagar | a_receber
  
  // Modal de pagamento
  const [modalPagamento, setModalPagamento] = useState(false)
  const [reciboSelecionado, setReciboSelecionado] = useState<ReciboComInstalador | null>(null)
  const [dataPagamento, setDataPagamento] = useState('')
  const [comprovante, setComprovante] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  
  // Modal de comprovante
  const [modalComprovante, setModalComprovante] = useState(false)
  const [urlComprovante, setUrlComprovante] = useState('')

  // Modal de detalhes
  const [modalDetalhes, setModalDetalhes] = useState(false)
  const [servicosDetalhes, setServicosDetalhes] = useState<any[]>([])
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false)

  // Modal de edição de pagamento
  const [modalEdicao, setModalEdicao] = useState(false)
  const [editandoPagamento, setEditandoPagamento] = useState(false)

  // Modal de edição de valores
  const [modalEditarValores, setModalEditarValores] = useState(false)
  const [editValorMaoObra, setEditValorMaoObra] = useState(0)
  const [editValorReembolso, setEditValorReembolso] = useState(0)
  const [editQtdServicos, setEditQtdServicos] = useState(0)
  const [editValorTotal, setEditValorTotal] = useState(0)
  const [editValorRecebido, setEditValorRecebido] = useState(0)
  const [salvandoEdicaoValores, setSalvandoEdicaoValores] = useState(false)

  // Exclusão de recibo
  const [alertApagar, setAlertApagar] = useState(false)
  const [reciboApagar, setReciboApagar] = useState<ReciboComInstalador | null>(null)
  const [apagando, setApagando] = useState(false)

  // Modal de lançamento manual
  const [modalManual, setModalManual] = useState(false)
  const [manualData, setManualData] = useState('')
  const [manualInstaladorId, setManualInstaladorId] = useState('')
  const [manualQtdServicos, setManualQtdServicos] = useState(0)
  const [manualValorMaoObra, setManualValorMaoObra] = useState(0)
  const [manualValorReembolso, setManualValorReembolso] = useState(0)
  const [manualValorTotal, setManualValorTotal] = useState(0)
  const [manualValorRecebido, setManualValorRecebido] = useState(0)
  const [salvandoManual, setSalvandoManual] = useState(false)
  const [instaladoresAtivos, setInstaladoresAtivos] = useState<{id: string, nome: string}[]>([])

  // Recibos faltantes
  const [recibosFaltantes, setRecibosFaltantes] = useState<ReciboFaltante[]>([])
  const [gerandoRecibo, setGerandoRecibo] = useState<string | null>(null) // data+instalador_id key
  const [gerandoTodos, setGerandoTodos] = useState(false)
  const [empresaId, setEmpresaId] = useState<string | null>(null)

  // Cálculos — separados por direção: saldo > 0 é a empresa que deve pagar o instalador,
  // saldo < 0 é o instalador que deve devolver/pagar a empresa.
  const totalAPagarPendente = recibos
    .filter(r => r.status_pagamento === 'pendente' && r.saldo > 0)
    .reduce((sum, r) => sum + r.saldo, 0)

  const totalAReceberPendente = recibos
    .filter(r => r.status_pagamento === 'pendente' && r.saldo < 0)
    .reduce((sum, r) => sum + Math.abs(r.saldo), 0)

  const totalPagoNoMes = recibos
    .filter(r => r.status_pagamento === 'pago' && r.saldo > 0)
    .reduce((sum, r) => sum + r.saldo, 0)

  const totalRecebidoNoMes = recibos
    .filter(r => r.status_pagamento === 'pago' && r.saldo < 0)
    .reduce((sum, r) => sum + Math.abs(r.saldo), 0)

  useEffect(() => {
    const mesAtual = format(new Date(), 'yyyy-MM')
    setFiltroMes(mesAtual)
  }, [])

  useEffect(() => {
    if (filtroMes) {
      carregarRecibos()
    }
  }, [filtroMes])

  async function carregarRecibos() {
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
      setEmpresaId(userData.empresa_id)

      // Filtrar por mês
      const [ano, mes] = filtroMes.split('-')
      const dataInicio = `${ano}-${mes}-01`
      const ultimoDia = endOfMonth(new Date(parseInt(ano), parseInt(mes) - 1, 1))
      const dataFim = format(ultimoDia, 'yyyy-MM-dd')

      // Buscar recibos e serviços concluídos em paralelo
      const [recibosRes, servicosRes] = await Promise.all([
        supabase
          .from('recibos_diarios')
          .select(`
            id, data_referencia, instalador_id, quantidade_servicos,
            valor_mao_obra, valor_reembolso, valor_total, valor_recebido_cliente,
            status_pagamento, data_pagamento, comprovante_pix_url
          `)
          .eq('empresa_id', userData.empresa_id)
          .gte('data_referencia', dataInicio)
          .lte('data_referencia', dataFim)
          .order('data_referencia', { ascending: false }),
        supabase
          .from('servicos')
          .select('id, instalador_id, data_conclusao, valor_mao_obra_instalador, valor_reembolso_despesas, valor_recebido_cliente')
          .eq('empresa_id', userData.empresa_id)
          .eq('status', 'concluido')
          .not('data_conclusao', 'is', null)
          .not('instalador_id', 'is', null)
          .gte('data_conclusao', `${ano}-${mes}-01T00:00:00`)
          .lt('data_conclusao', format(new Date(parseInt(ano), parseInt(mes), 1), "yyyy-MM-dd'T'HH:mm:ss"))
      ])

      if (recibosRes.error) throw recibosRes.error

      const data = recibosRes.data || []
      const servicosConcluidos = servicosRes.data || []

      // Buscar nomes dos instaladores (de recibos + serviços)
      const idsSet = new Set<string>([
        ...data.map(r => r.instalador_id),
        ...servicosConcluidos.map(s => s.instalador_id).filter(Boolean) as string[]
      ])
      const allInstaladorIds = Array.from(idsSet)
      
      const { data: instaladores } = allInstaladorIds.length > 0
        ? await supabase.from('usuarios').select('id, nome').in('id', allInstaladorIds)
        : { data: [] }

      const instaladoresMap = new Map<string, string>(instaladores?.map(i => [i.id, i.nome] as [string, string]) || [])

      const recibosFormatados: ReciboComInstalador[] = data.map(r => {
        const valorMaoObra = Number(r.valor_mao_obra)
        const valorReembolso = Number(r.valor_reembolso)
        const valorRecebidoCliente = Number(r.valor_recebido_cliente) || 0
        return {
          id: r.id,
          data_referencia: r.data_referencia,
          instalador_id: r.instalador_id,
          instalador_nome: instaladoresMap.get(r.instalador_id) || 'Desconhecido',
          quantidade_servicos: r.quantidade_servicos,
          valor_mao_obra: valorMaoObra,
          valor_reembolso: valorReembolso,
          valor_total: Number(r.valor_total),
          valor_recebido_cliente: valorRecebidoCliente,
          saldo: valorMaoObra + valorReembolso - valorRecebidoCliente,
          status_pagamento: r.status_pagamento || 'pendente',
          data_pagamento: r.data_pagamento,
          comprovante_pix_url: r.comprovante_pix_url
        }
      })

      setRecibos(recibosFormatados)

      // --- Detecção de recibos faltantes ---
      // Criar set de chaves existentes: "instalador_id|data_referencia"
      const recibosExistentesSet = new Set(
        data.map(r => `${r.instalador_id}|${r.data_referencia}`)
      )

      // Agrupar serviços por instalador + dia (fuso Brasília: -3h)
      const grupos = new Map<string, ReciboFaltante>()
      
      for (const s of servicosConcluidos) {
        if (!s.instalador_id || !s.data_conclusao) continue
        
        // Converter data_conclusao para fuso Brasília
        const dtConclusao = new Date(s.data_conclusao)
        const dtBrasilia = new Date(dtConclusao.getTime() - 3 * 60 * 60 * 1000)
        const dataRef = dtBrasilia.toISOString().slice(0, 10)
        
        const chave = `${s.instalador_id}|${dataRef}`
        
        // Se já existe recibo, pular
        if (recibosExistentesSet.has(chave)) continue
        
        if (!grupos.has(chave)) {
          grupos.set(chave, {
            instalador_id: s.instalador_id,
            instalador_nome: instaladoresMap.get(s.instalador_id) || 'Desconhecido',
            data: dataRef,
            servicos: [],
            totalMaoObra: 0,
            totalReembolso: 0,
            totalRecebidoCliente: 0,
            totalGeral: 0
          })
        }
        
        const grupo = grupos.get(chave)!
        const maoObra = Number(s.valor_mao_obra_instalador || 0)
        const reembolso = Number(s.valor_reembolso_despesas || 0)
        const recebidoCliente = Number(s.valor_recebido_cliente || 0)
        
        grupo.servicos.push({
          id: s.id,
          valor_mao_obra_instalador: maoObra,
          valor_reembolso_despesas: reembolso,
          valor_recebido_cliente: recebidoCliente
        })
        grupo.totalMaoObra += maoObra
        grupo.totalReembolso += reembolso
        grupo.totalRecebidoCliente += recebidoCliente
        grupo.totalGeral = grupo.totalMaoObra + grupo.totalReembolso
      }

      // Ordenar por data desc
      const faltantes = Array.from(grupos.values()).sort((a, b) => b.data.localeCompare(a.data))
      setRecibosFaltantes(faltantes)

    } catch (error) {
      console.error('Erro ao carregar recibos:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os recibos',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  async function gerarReciboFaltante(faltante: ReciboFaltante) {
    if (!empresaId) return
    const chave = `${faltante.data}|${faltante.instalador_id}`
    setGerandoRecibo(chave)
    
    try {
      const { error } = await supabase
        .from('recibos_diarios')
        .insert({
          empresa_id: empresaId,
          instalador_id: faltante.instalador_id,
          data_referencia: faltante.data,
          valor_mao_obra: faltante.totalMaoObra,
          valor_reembolso: faltante.totalReembolso,
          valor_total: faltante.totalGeral,
          quantidade_servicos: faltante.servicos.length,
          servicos_ids: faltante.servicos.map(s => s.id),
          valor_recebido_cliente: faltante.totalRecebidoCliente,
          status_pagamento: 'pendente'
        })

      if (error) throw error

      toast({ title: 'Sucesso', description: `Recibo gerado para ${faltante.instalador_nome} em ${format(new Date(faltante.data + 'T12:00:00'), 'dd/MM/yyyy')}` })
      carregarRecibos()
    } catch (error) {
      console.error('Erro ao gerar recibo:', error)
      toast({ title: 'Erro', description: 'Não foi possível gerar o recibo', variant: 'destructive' })
    } finally {
      setGerandoRecibo(null)
    }
  }

  async function gerarTodosRecibosFaltantes() {
    if (!empresaId || recibosFaltantes.length === 0) return
    setGerandoTodos(true)

    try {
      const inserts = recibosFaltantes.map(f => ({
        empresa_id: empresaId,
        instalador_id: f.instalador_id,
        data_referencia: f.data,
        valor_mao_obra: f.totalMaoObra,
        valor_reembolso: f.totalReembolso,
        valor_total: f.totalGeral,
        quantidade_servicos: f.servicos.length,
        servicos_ids: f.servicos.map(s => s.id),
        valor_recebido_cliente: f.totalRecebidoCliente,
        status_pagamento: 'pendente'
      }))

      const { error } = await supabase.from('recibos_diarios').insert(inserts)
      if (error) throw error

      toast({ title: 'Sucesso', description: `${inserts.length} recibo(s) gerado(s) com sucesso!` })
      carregarRecibos()
    } catch (error) {
      console.error('Erro ao gerar recibos:', error)
      toast({ title: 'Erro', description: 'Não foi possível gerar os recibos', variant: 'destructive' })
    } finally {
      setGerandoTodos(false)
    }
  }

  function abrirModalPagamento(recibo: ReciboComInstalador) {
    setReciboSelecionado(recibo)
    setDataPagamento(format(new Date(), 'yyyy-MM-dd'))
    setComprovante(null)
    setModalPagamento(true)
  }

  async function confirmarPagamento() {
    if (!reciboSelecionado || !dataPagamento) {
      toast({
        title: 'Atenção',
        description: 'Informe a data do pagamento',
        variant: 'destructive'
      })
      return
    }

    try {
      setSalvando(true)

      let comprovanteUrl: string | null = null

      // Upload do comprovante se houver
      if (comprovante) {
        const fileName = `${reciboSelecionado.instalador_id}/${Date.now()}_${comprovante.name}`
        const { error: uploadError } = await supabase.storage
          .from('comprovantes')
          .upload(fileName, comprovante)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('comprovantes')
          .getPublicUrl(fileName)
        
        comprovanteUrl = urlData.publicUrl
      }

      // Atualizar recibo
      const { error } = await supabase
        .from('recibos_diarios')
        .update({
          status_pagamento: 'pago',
          data_pagamento: dataPagamento,
          comprovante_pix_url: comprovanteUrl
        })
        .eq('id', reciboSelecionado.id)

      if (error) throw error

      const recebendoDoInstalador = reciboSelecionado.saldo < 0
      toast({
        title: 'Sucesso',
        description: recebendoDoInstalador
          ? 'Recebimento confirmado e receita lançada no caixa!'
          : 'Pagamento registrado e despesa lançada no caixa!'
      })

      setModalPagamento(false)
      carregarRecibos()
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar o pagamento',
        variant: 'destructive'
      })
    } finally {
      setSalvando(false)
    }
  }

  async function verComprovante(url: string) {
    // Para buckets privados, precisamos de uma signed URL
    const path = url.split('/comprovantes/')[1]
    if (!path) {
      window.open(url, '_blank')
      return
    }

    const { data, error } = await supabase.storage
      .from('comprovantes')
      .createSignedUrl(path, 3600) // 1 hora

    if (error || !data?.signedUrl) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o comprovante',
        variant: 'destructive'
      })
      return
    }

    setUrlComprovante(data.signedUrl)
    setModalComprovante(true)
  }

  function abrirModalEdicao(recibo: ReciboComInstalador) {
    setReciboSelecionado(recibo)
    setDataPagamento(recibo.data_pagamento || '')
    setComprovante(null)
    setModalEdicao(true)
  }

  async function salvarEdicaoPagamento() {
    if (!reciboSelecionado || !dataPagamento) {
      toast({
        title: 'Atenção',
        description: 'Informe a data do pagamento',
        variant: 'destructive'
      })
      return
    }

    try {
      setEditandoPagamento(true)

      let comprovanteUrl = reciboSelecionado.comprovante_pix_url

      if (comprovante) {
        const fileName = `${reciboSelecionado.instalador_id}/${Date.now()}_${comprovante.name}`
        const { error: uploadError } = await supabase.storage
          .from('comprovantes')
          .upload(fileName, comprovante)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('comprovantes')
          .getPublicUrl(fileName)
        
        comprovanteUrl = urlData.publicUrl
      }

      // Atualizar recibo
      const { error } = await supabase
        .from('recibos_diarios')
        .update({
          data_pagamento: dataPagamento,
          comprovante_pix_url: comprovanteUrl
        })
        .eq('id', reciboSelecionado.id)

      if (error) throw error

      // Atualizar lançamento(s) no caixa com a nova data (cobre categorias legadas e a atual)
      const dataReferenciaFormatada = format(new Date(reciboSelecionado.data_referencia + 'T12:00:00'), 'dd/MM/yyyy')

      await supabase
        .from('lancamentos_caixa')
        .update({ data_lancamento: dataPagamento })
        .in('categoria', CATEGORIAS_LANCAMENTO_RECIBO)
        .ilike('descricao', `%${dataReferenciaFormatada}%`)
        .ilike('descricao', `%${reciboSelecionado.instalador_nome}%`)

      toast({
        title: 'Sucesso',
        description: 'Pagamento atualizado!'
      })

      setModalEdicao(false)
      carregarRecibos()
    } catch (error) {
      console.error('Erro ao editar pagamento:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o pagamento',
        variant: 'destructive'
      })
    } finally {
      setEditandoPagamento(false)
    }
  }

  async function verDetalhes(recibo: ReciboComInstalador) {
    setReciboSelecionado(recibo)
    setCarregandoDetalhes(true)
    setModalDetalhes(true)
    setServicosDetalhes([])

    try {
      // Buscar os serviços usando os IDs do array servicos_ids do recibo
      const { data: reciboData } = await supabase
        .from('recibos_diarios')
        .select('servicos_ids')
        .eq('id', recibo.id)
        .single()

      if (!reciboData?.servicos_ids || reciboData.servicos_ids.length === 0) {
        return
      }

      const { data: servicos } = await supabase
        .from('servicos')
        .select(`
          id, codigo, tipo_servico, valor_total,
          valor_mao_obra_instalador, valor_reembolso_despesas,
          cliente_id
        `)
        .in('id', reciboData.servicos_ids)

      // Buscar nomes dos clientes
      const clienteIds = servicos?.map(s => s.cliente_id) || []
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, nome')
        .in('id', clienteIds)

      const clientesMap = new Map(clientes?.map(c => [c.id, c.nome]))
      
      const servicosFormatados = servicos?.map(s => ({
        ...s,
        cliente_nome: clientesMap.get(s.cliente_id) || 'Cliente'
      })) || []

      setServicosDetalhes(servicosFormatados)
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error)
    } finally {
      setCarregandoDetalhes(false)
    }
  }

  async function abrirModalManual() {
    setManualData(format(new Date(), 'yyyy-MM-dd'))
    setManualInstaladorId('')
    setManualQtdServicos(0)
    setManualValorMaoObra(0)
    setManualValorReembolso(0)
    setManualValorTotal(0)
    setManualValorRecebido(0)

    // Carregar instaladores ativos
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()
      if (!userData) return

      const { data: inst } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('empresa_id', userData.empresa_id)
        .eq('tipo', 'instalador')
        .eq('ativo', true)
        .order('nome')

      setInstaladoresAtivos(inst || [])
    } catch (e) {
      console.error('Erro ao carregar instaladores:', e)
    }

    setModalManual(true)
  }

  async function salvarReciboManual() {
    if (!manualData || !manualInstaladorId) {
      toast({ title: 'Atenção', description: 'Preencha a data e selecione o instalador', variant: 'destructive' })
      return
    }
    if (manualValorTotal <= 0) {
      toast({ title: 'Atenção', description: 'O valor total deve ser maior que zero', variant: 'destructive' })
      return
    }

    try {
      setSalvandoManual(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()
      if (!userData) return

      const { error } = await supabase
        .from('recibos_diarios')
        .insert({
          empresa_id: userData.empresa_id,
          instalador_id: manualInstaladorId,
          data_referencia: manualData,
          quantidade_servicos: manualQtdServicos,
          valor_mao_obra: manualValorMaoObra,
          valor_reembolso: manualValorReembolso,
          valor_total: manualValorTotal,
          valor_recebido_cliente: manualValorRecebido,
          servicos_ids: [],
          status_pagamento: 'pendente'
        })

      if (error) throw error

      toast({ title: 'Sucesso', description: 'Recibo manual lançado com sucesso!' })
      setModalManual(false)
      carregarRecibos()
    } catch (error) {
      console.error('Erro ao salvar recibo manual:', error)
      toast({ title: 'Erro', description: 'Não foi possível salvar o recibo', variant: 'destructive' })
    } finally {
      setSalvandoManual(false)
    }
  }
  function abrirEditarValores(recibo: ReciboComInstalador) {
    setReciboSelecionado(recibo)
    setEditValorMaoObra(recibo.valor_mao_obra)
    setEditValorReembolso(recibo.valor_reembolso)
    setEditQtdServicos(recibo.quantidade_servicos)
    setEditValorTotal(recibo.valor_total)
    setEditValorRecebido(recibo.valor_recebido_cliente)
    setModalEditarValores(true)
  }

  async function salvarEdicaoValores() {
    if (!reciboSelecionado) return

    try {
      setSalvandoEdicaoValores(true)

      const { error } = await supabase
        .from('recibos_diarios')
        .update({
          valor_mao_obra: editValorMaoObra,
          valor_reembolso: editValorReembolso,
          quantidade_servicos: editQtdServicos,
          valor_total: editValorTotal,
          valor_recebido_cliente: editValorRecebido,
        })
        .eq('id', reciboSelecionado.id)

      if (error) throw error

      // Se recibo já pago/confirmado, refazer o lançamento no caixa com o saldo líquido novo
      if (reciboSelecionado.status_pagamento === 'pago') {
        const dataReferenciaFormatada = format(new Date(reciboSelecionado.data_referencia + 'T12:00:00'), 'dd/MM/yyyy')
        const novoSaldo = editValorMaoObra + editValorReembolso - editValorRecebido

        // Remove qualquer lançamento anterior deste recibo (categorias legadas + atual)
        await supabase
          .from('lancamentos_caixa')
          .delete()
          .in('categoria', CATEGORIAS_LANCAMENTO_RECIBO)
          .ilike('descricao', `%${dataReferenciaFormatada}%`)
          .ilike('descricao', `%${reciboSelecionado.instalador_nome}%`)

        // Relança com o saldo líquido correto, na direção certa
        if (novoSaldo > 0) {
          await supabase.from('lancamentos_caixa').insert({
            empresa_id: empresaId,
            tipo: 'despesa',
            categoria: 'Pagamento Instalador',
            descricao: `Pagamento recibo ${reciboSelecionado.instalador_nome} - ${dataReferenciaFormatada}`,
            valor: novoSaldo,
            data_lancamento: reciboSelecionado.data_pagamento,
            forma_pagamento: 'PIX'
          })
        } else if (novoSaldo < 0) {
          await supabase.from('lancamentos_caixa').insert({
            empresa_id: empresaId,
            tipo: 'receita',
            categoria: 'Recebimento Instalador',
            descricao: `Recebimento de ${reciboSelecionado.instalador_nome} - ${dataReferenciaFormatada}`,
            valor: Math.abs(novoSaldo),
            data_lancamento: reciboSelecionado.data_pagamento,
            forma_pagamento: 'PIX'
          })
        }
      }

      toast({ title: 'Sucesso', description: 'Valores do recibo atualizados!' })
      setModalEditarValores(false)
      carregarRecibos()
    } catch (error) {
      console.error('Erro ao editar valores:', error)
      toast({ title: 'Erro', description: 'Não foi possível atualizar os valores', variant: 'destructive' })
    } finally {
      setSalvandoEdicaoValores(false)
    }
  }

  function confirmarApagar(recibo: ReciboComInstalador) {
    setReciboApagar(recibo)
    setAlertApagar(true)
  }

  async function apagarRecibo() {
    if (!reciboApagar) return

    try {
      setApagando(true)

      // Se pago/confirmado, deletar lançamento(s) correspondentes no caixa (categorias legadas + atual)
      if (reciboApagar.status_pagamento === 'pago') {
        const dataReferenciaFormatada = format(new Date(reciboApagar.data_referencia + 'T12:00:00'), 'dd/MM/yyyy')

        await supabase
          .from('lancamentos_caixa')
          .delete()
          .in('categoria', CATEGORIAS_LANCAMENTO_RECIBO)
          .ilike('descricao', `%${dataReferenciaFormatada}%`)
          .ilike('descricao', `%${reciboApagar.instalador_nome}%`)
      }

      const { error } = await supabase
        .from('recibos_diarios')
        .delete()
        .eq('id', reciboApagar.id)

      if (error) throw error

      toast({ title: 'Sucesso', description: 'Recibo apagado com sucesso!' })
      setAlertApagar(false)
      setReciboApagar(null)
      carregarRecibos()
    } catch (error) {
      console.error('Erro ao apagar recibo:', error)
      toast({ title: 'Erro', description: 'Não foi possível apagar o recibo', variant: 'destructive' })
    } finally {
      setApagando(false)
    }
  }

  const recibosFiltrados = recibos.filter(r => {
    if (filtroStatus !== 'todos' && r.status_pagamento !== filtroStatus) return false
    if (filtroDirecao === 'a_pagar' && !(r.saldo > 0)) return false
    if (filtroDirecao === 'a_receber' && !(r.saldo < 0)) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-8 w-8" />
            <span className="text-3xl opacity-30">⏳</span>
          </div>
          <div className="text-2xl font-bold">R$ {totalAPagarPendente.toFixed(2)}</div>
          <div className="text-sm opacity-90">Você Deve Pagar</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-8 w-8" />
            <span className="text-3xl opacity-30">⏳</span>
          </div>
          <div className="text-2xl font-bold">R$ {totalAReceberPendente.toFixed(2)}</div>
          <div className="text-sm opacity-90">Instaladores Devem a Você</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-8 w-8" />
            <span className="text-3xl opacity-30">✅</span>
          </div>
          <div className="text-2xl font-bold">R$ {totalPagoNoMes.toFixed(2)}</div>
          <div className="text-sm opacity-90">Pago no Mês</div>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-8 w-8" />
            <span className="text-3xl opacity-30">✅</span>
          </div>
          <div className="text-2xl font-bold">R$ {totalRecebidoNoMes.toFixed(2)}</div>
          <div className="text-sm opacity-90">Recebido no Mês</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card rounded-lg shadow p-4 flex flex-wrap gap-4 items-end">
        <div>
          <Label className="text-sm font-medium mb-2 block">Mês</Label>
          <Input
            type="month"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="w-48"
          />
        </div>
        <div>
          <Label className="text-sm font-medium mb-2 block">Status</Label>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="todos">Todos</option>
            <option value="pendente">Pendentes</option>
            <option value="pago">Pagos/Recebidos</option>
          </select>
        </div>
        <div>
          <Label className="text-sm font-medium mb-2 block">Direção</Label>
          <select
            value={filtroDirecao}
            onChange={(e) => setFiltroDirecao(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="todos">Todos</option>
            <option value="a_pagar">Você deve pagar</option>
            <option value="a_receber">Instalador deve pagar</option>
          </select>
        </div>
        <div className="ml-auto">
          <Button onClick={abrirModalManual}>
            <Plus className="h-4 w-4 mr-1" />
            Lançar Recibo Manual
          </Button>
        </div>
      </div>

      {/* Alerta de Recibos Faltantes */}
      {!loading && recibosFaltantes.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 rounded-lg shadow p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                Recibos Não Gerados ({recibosFaltantes.length} dia{recibosFaltantes.length > 1 ? 's' : ''} sem recibo)
              </h3>
            </div>
            <Button
              size="sm"
              onClick={gerarTodosRecibosFaltantes}
              disabled={gerandoTodos}
              className="gap-1"
            >
              {gerandoTodos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Gerar Todos
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instalador</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">Serviços</TableHead>
                  <TableHead className="text-right">Mão de Obra</TableHead>
                  <TableHead className="text-right">Reembolso</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead className="text-right">Saldo Est.</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recibosFaltantes.map((f) => {
                  const chave = `${f.data}|${f.instalador_id}`
                  const saldoEst = f.totalGeral - f.totalRecebidoCliente
                  return (
                    <TableRow key={chave}>
                      <TableCell className="font-medium">{f.instalador_nome}</TableCell>
                      <TableCell>{format(new Date(f.data + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-center">{f.servicos.length}</TableCell>
                      <TableCell className="text-right">R$ {f.totalMaoObra.toFixed(2)}</TableCell>
                      <TableCell className="text-right">R$ {f.totalReembolso.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {f.totalRecebidoCliente > 0 ? `R$ ${f.totalRecebidoCliente.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${saldoEst >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        R$ {Math.abs(saldoEst).toFixed(2)} {saldoEst >= 0 ? '(a pagar)' : '(a receber)'}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => gerarReciboFaltante(f)}
                            disabled={gerandoRecibo === chave || gerandoTodos}
                          >
                            {gerandoRecibo === chave ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-1" />
                                Gerar
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setRecibosFaltantes(prev => prev.filter(item => `${item.data}|${item.instalador_id}` !== chave))}
                            disabled={gerandoRecibo === chave || gerandoTodos}
                            title="Ignorar este recibo faltante"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-card rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : recibosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum recibo encontrado no período</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Instalador</TableHead>
                <TableHead className="text-center">Serviços</TableHead>
                <TableHead className="text-right">Mão de Obra</TableHead>
                <TableHead className="text-right">Reembolso</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recibosFiltrados.map((recibo) => {
                const aReceberDoInstalador = recibo.saldo < 0
                return (
                <TableRow key={recibo.id}>
                  <TableCell>
                    {formatarDataBR(recibo.data_referencia)}
                  </TableCell>
                  <TableCell className="font-medium">{recibo.instalador_nome}</TableCell>
                  <TableCell className="text-center">{recibo.quantidade_servicos}</TableCell>
                  <TableCell className="text-right">R$ {recibo.valor_mao_obra.toFixed(2)}</TableCell>
                  <TableCell className="text-right">R$ {recibo.valor_reembolso.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {recibo.valor_recebido_cliente > 0 ? (
                      <span className="text-orange-600">R$ {recibo.valor_recebido_cliente.toFixed(2)}</span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className={`text-right font-bold ${aReceberDoInstalador ? 'text-red-600' : 'text-green-600'}`}>
                    R$ {Math.abs(recibo.saldo).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={recibo.status_pagamento === 'pago' ? 'default' : 'secondary'}>
                      {recibo.status_pagamento === 'pago'
                        ? (aReceberDoInstalador ? 'Recebido' : 'Pago')
                        : (aReceberDoInstalador ? 'A Receber' : 'A Pagar')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {/* Botão de Detalhes - sempre visível */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => verDetalhes(recibo)}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Detalhes
                      </Button>

                      {/* Botão Editar Valores - sempre visível */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrirEditarValores(recibo)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Valores
                      </Button>

                      {recibo.status_pagamento === 'pendente' ? (
                        recibo.saldo === 0 ? (
                          <span className="text-xs text-muted-foreground self-center">Quitado</span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => abrirModalPagamento(recibo)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            {aReceberDoInstalador ? 'Confirmar Recebimento' : 'Pagar'}
                          </Button>
                        )
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirModalEdicao(recibo)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            {aReceberDoInstalador ? 'Recebimento' : 'Pgto'}
                          </Button>
                          {recibo.comprovante_pix_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => verComprovante(recibo.comprovante_pix_url!)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Comprovante
                            </Button>
                          )}
                          {recibo.data_pagamento && (
                            <span className="text-xs text-muted-foreground self-center">
                              {aReceberDoInstalador ? 'Recebido em' : 'Pago em'} {format(new Date(recibo.data_pagamento), 'dd/MM')}
                            </span>
                          )}
                        </>
                      )}

                      {/* Botão Apagar - sempre visível */}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => confirmarApagar(recibo)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal de Pagamento / Recebimento */}
      <Dialog open={modalPagamento} onOpenChange={setModalPagamento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reciboSelecionado && reciboSelecionado.saldo < 0 ? 'Confirmar Recebimento' : 'Confirmar Pagamento'}
            </DialogTitle>
          </DialogHeader>
          
          {reciboSelecionado && (() => {
            const receber = reciboSelecionado.saldo < 0
            return (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p><strong>Instalador:</strong> {reciboSelecionado.instalador_nome}</p>
                <p><strong>Data do Recibo:</strong> {formatarDataBR(reciboSelecionado.data_referencia)}</p>
                <p><strong>Mão de Obra:</strong> R$ {reciboSelecionado.valor_mao_obra.toFixed(2)}</p>
                <p><strong>Reembolso:</strong> R$ {reciboSelecionado.valor_reembolso.toFixed(2)}</p>
                {reciboSelecionado.valor_recebido_cliente > 0 && (
                  <p><strong>Recebido em mãos pelo instalador:</strong> R$ {reciboSelecionado.valor_recebido_cliente.toFixed(2)}</p>
                )}
                <p className={`text-lg font-bold ${receber ? 'text-red-600' : 'text-primary'}`}>
                  {receber ? 'Total a Receber' : 'Total a Pagar'}: R$ {Math.abs(reciboSelecionado.saldo).toFixed(2)}
                </p>
              </div>

              <div>
                <Label htmlFor="dataPagamento">Data do {receber ? 'Recebimento' : 'Pagamento'} *</Label>
                <Input
                  id="dataPagamento"
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="comprovante">
                  {receber ? 'Comprovante PIX enviado pelo instalador (opcional)' : 'Comprovante PIX (opcional)'}
                </Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    id="comprovante"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setComprovante(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  {comprovante && (
                    <Badge variant="secondary">
                      <Upload className="h-3 w-3 mr-1" />
                      {comprovante.name.slice(0, 20)}...
                    </Badge>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                {receber
                  ? '⚡ Ao confirmar, uma receita será registrada automaticamente no Caixa.'
                  : '⚡ Ao confirmar, uma despesa será registrada automaticamente no Caixa.'}
              </p>
            </div>
            )
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPagamento(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarPagamento} disabled={salvando}>
              {salvando ? 'Salvando...' : (reciboSelecionado?.saldo ?? 0) < 0 ? 'Confirmar Recebimento' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Comprovante */}
      <Dialog open={modalComprovante} onOpenChange={setModalComprovante}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprovante de Pagamento</DialogTitle>
          </DialogHeader>
          
          <div className="flex justify-center">
            {urlComprovante && (
              urlComprovante.includes('.pdf') ? (
                <a href={urlComprovante} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Abrir PDF em nova aba
                </a>
              ) : (
                <img src={urlComprovante} alt="Comprovante" className="max-h-[60vh] object-contain" />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Pagamento/Recebimento */}
      <Dialog open={modalEdicao} onOpenChange={setModalEdicao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reciboSelecionado && reciboSelecionado.saldo < 0 ? 'Editar Recebimento' : 'Editar Pagamento'}
            </DialogTitle>
          </DialogHeader>

          {reciboSelecionado && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p><strong>Instalador:</strong> {reciboSelecionado.instalador_nome}</p>
                <p><strong>Data do Recibo:</strong> {formatarDataBR(reciboSelecionado.data_referencia)}</p>
                <p className={`text-lg font-bold ${reciboSelecionado.saldo < 0 ? 'text-red-600' : 'text-primary'}`}>
                  Total: R$ {Math.abs(reciboSelecionado.saldo).toFixed(2)}
                </p>
              </div>

              <div>
                <Label htmlFor="dataPagamentoEdit">Data do {reciboSelecionado.saldo < 0 ? 'Recebimento' : 'Pagamento'} *</Label>
                <Input
                  id="dataPagamentoEdit"
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="comprovanteEdit">Novo Comprovante (opcional)</Label>
                <Input
                  id="comprovanteEdit"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setComprovante(e.target.files?.[0] || null)}
                  className="mt-1"
                />
                {reciboSelecionado.comprovante_pix_url && !comprovante && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Já possui comprovante anexado. Selecione outro arquivo para substituir.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEdicao(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarEdicaoPagamento} disabled={editandoPagamento}>
              {editandoPagamento ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes */}
      <Dialog open={modalDetalhes} onOpenChange={setModalDetalhes}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Recibo</DialogTitle>
          </DialogHeader>
          
          {reciboSelecionado && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted p-3 rounded-lg">
                <span className="font-medium">{reciboSelecionado.instalador_nome}</span>
                <span className="text-muted-foreground">{formatarDataBR(reciboSelecionado.data_referencia)}</span>
              </div>

              {carregandoDetalhes ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto rounded-full"></div>
                  <p className="text-sm text-muted-foreground mt-2">Carregando serviços...</p>
                </div>
              ) : servicosDetalhes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum serviço encontrado para este recibo.
                </div>
              ) : (
                <>
                  {/* Tabela com cada serviço */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Código</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Valor Serviço</TableHead>
                          <TableHead className="text-right">Mão de Obra</TableHead>
                          <TableHead className="text-right">Reembolso</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {servicosDetalhes.map((servico) => (
                          <TableRow key={servico.id}>
                            <TableCell className="font-mono text-sm">{servico.codigo}</TableCell>
                            <TableCell>{servico.cliente_nome}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {servico.tipo_servico?.join(', ') || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              R$ {Number(servico.valor_total || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              R$ {Number(servico.valor_mao_obra_instalador || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-blue-600 font-medium">
                              R$ {Number(servico.valor_reembolso_despesas || 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Resumo final */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total Mão de Obra:</span>
                      <span className="font-semibold text-green-600">
                        R$ {reciboSelecionado.valor_mao_obra.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total Reembolso Materiais:</span>
                      <span className="font-semibold text-blue-600">
                        R$ {reciboSelecionado.valor_reembolso.toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="text-lg font-medium">Total a Pagar:</span>
                      <span className="text-xl font-bold text-primary">
                        R$ {reciboSelecionado.valor_total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Lançamento Manual */}
      <Dialog open={modalManual} onOpenChange={setModalManual}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lançar Recibo Manual</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="manualData">Data de Referência *</Label>
              <Input
                id="manualData"
                type="date"
                value={manualData}
                onChange={(e) => setManualData(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="manualInstalador">Instalador *</Label>
              <Select value={manualInstaladorId} onValueChange={setManualInstaladorId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o instalador" />
                </SelectTrigger>
                <SelectContent>
                  {instaladoresAtivos.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="manualQtd">Quantidade de Serviços</Label>
              <Input
                id="manualQtd"
                type="number"
                min="0"
                value={manualQtdServicos}
                onChange={(e) => setManualQtdServicos(parseInt(e.target.value) || 0)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="manualMaoObra">Valor Mão de Obra *</Label>
                <Input
                  id="manualMaoObra"
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualValorMaoObra || ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0
                    setManualValorMaoObra(v)
                    setManualValorTotal(v + manualValorReembolso)
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="manualReembolso">Valor Reembolso</Label>
                <Input
                  id="manualReembolso"
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualValorReembolso || ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0
                    setManualValorReembolso(v)
                    setManualValorTotal(manualValorMaoObra + v)
                  }}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="manualTotal">Valor Total</Label>
              <Input
                id="manualTotal"
                type="number"
                min="0"
                step="0.01"
                value={manualValorTotal || ''}
                onChange={(e) => setManualValorTotal(parseFloat(e.target.value) || 0)}
                className="mt-1 font-bold"
              />
              <p className="text-xs text-muted-foreground mt-1">Calculado automaticamente, mas pode ser editado.</p>
            </div>

            <div>
              <Label htmlFor="manualRecebido">Recebido em Mãos pelo Instalador</Label>
              <Input
                id="manualRecebido"
                type="number"
                min="0"
                step="0.01"
                value={manualValorRecebido || ''}
                onChange={(e) => setManualValorRecebido(parseFloat(e.target.value) || 0)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se o instalador já recolheu esse valor do cliente, informe aqui. Deixe 0 se você é quem paga.
              </p>
            </div>

            {(() => {
              const saldoManual = manualValorTotal - manualValorRecebido
              return (
                <div className="bg-muted p-3 rounded-lg flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {saldoManual >= 0 ? 'Você deve pagar:' : 'Instalador deve pagar:'}
                  </span>
                  <span className={`text-lg font-bold ${saldoManual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    R$ {Math.abs(saldoManual).toFixed(2)}
                  </span>
                </div>
              )
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalManual(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarReciboManual} disabled={salvandoManual}>
              {salvandoManual ? 'Salvando...' : 'Lançar Recibo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Valores */}
      <Dialog open={modalEditarValores} onOpenChange={setModalEditarValores}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Valores do Recibo</DialogTitle>
          </DialogHeader>
          
          {reciboSelecionado && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p><strong>Instalador:</strong> {reciboSelecionado.instalador_nome}</p>
                <p><strong>Data:</strong> {formatarDataBR(reciboSelecionado.data_referencia)}</p>
                <Badge variant={reciboSelecionado.status_pagamento === 'pago' ? 'default' : 'secondary'}>
                  {reciboSelecionado.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}
                </Badge>
                {reciboSelecionado.status_pagamento === 'pago' && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ Este recibo já foi confirmado. O lançamento no caixa será refeito automaticamente.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="editQtd">Quantidade de Serviços</Label>
                <Input
                  id="editQtd"
                  type="number"
                  min="0"
                  value={editQtdServicos}
                  onChange={(e) => setEditQtdServicos(parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editMaoObra">Valor Mão de Obra</Label>
                  <Input
                    id="editMaoObra"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editValorMaoObra || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0
                      setEditValorMaoObra(v)
                      setEditValorTotal(v + editValorReembolso)
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="editReembolso">Valor Reembolso</Label>
                  <Input
                    id="editReembolso"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editValorReembolso || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0
                      setEditValorReembolso(v)
                      setEditValorTotal(editValorMaoObra + v)
                    }}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="editTotal">Valor Total</Label>
                <Input
                  id="editTotal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editValorTotal || ''}
                  onChange={(e) => setEditValorTotal(parseFloat(e.target.value) || 0)}
                  className="mt-1 font-bold"
                />
                <p className="text-xs text-muted-foreground mt-1">Calculado automaticamente, mas pode ser editado.</p>
              </div>

              <div>
                <Label htmlFor="editRecebido">Recebido em Mãos pelo Instalador</Label>
                <Input
                  id="editRecebido"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editValorRecebido || ''}
                  onChange={(e) => setEditValorRecebido(parseFloat(e.target.value) || 0)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Quanto o instalador já recolheu do cliente. Isso define quem deve pra quem.
                </p>
              </div>

              {(() => {
                const saldoEdit = editValorMaoObra + editValorReembolso - editValorRecebido
                return (
                  <div className="bg-muted p-3 rounded-lg flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {saldoEdit >= 0 ? 'Você deve pagar:' : 'Instalador deve pagar:'}
                    </span>
                    <span className={`text-lg font-bold ${saldoEdit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      R$ {Math.abs(saldoEdit).toFixed(2)}
                    </span>
                  </div>
                )
              })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEditarValores(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarEdicaoValores} disabled={salvandoEdicaoValores}>
              {salvandoEdicaoValores ? 'Salvando...' : 'Salvar Valores'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog de Confirmação de Exclusão */}
      <AlertDialog open={alertApagar} onOpenChange={setAlertApagar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar recibo?</AlertDialogTitle>
            <AlertDialogDescription>
              {reciboApagar && (
                <>
                  Tem certeza que deseja apagar o recibo de <strong>{reciboApagar.instalador_nome}</strong> do dia <strong>{formatarDataBR(reciboApagar.data_referencia)}</strong> (R$ {Math.abs(reciboApagar.saldo).toFixed(2)} {reciboApagar.saldo < 0 ? 'a receber' : 'a pagar'})?
                  {reciboApagar.status_pagamento === 'pago' && (
                    <span className="block mt-2 text-destructive font-medium">
                      ⚠️ Este recibo já foi confirmado. O lançamento correspondente no caixa também será removido.
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apagando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={apagarRecibo}
              disabled={apagando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {apagando ? 'Apagando...' : 'Apagar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
