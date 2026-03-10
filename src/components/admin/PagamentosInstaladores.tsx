import { useState, useEffect } from 'react'
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
import { Check, Upload, Eye, Clock, DollarSign, FileText, Pencil, Plus, Trash2 } from 'lucide-react'
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
  status_pagamento: string
  data_pagamento: string | null
  comprovante_pix_url: string | null
}

export function PagamentosInstaladores() {
  const [recibos, setRecibos] = useState<ReciboComInstalador[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  
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
  const [salvandoManual, setSalvandoManual] = useState(false)
  const [instaladoresAtivos, setInstaladoresAtivos] = useState<{id: string, nome: string}[]>([])

  // Cálculos
  const totalPendente = recibos
    .filter(r => r.status_pagamento === 'pendente')
    .reduce((sum, r) => sum + r.valor_total, 0)
  
  const totalPago = recibos
    .filter(r => r.status_pagamento === 'pago')
    .reduce((sum, r) => sum + r.valor_total, 0)

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

      // Filtrar por mês
      const [ano, mes] = filtroMes.split('-')
      const dataInicio = `${ano}-${mes}-01`
      const ultimoDia = endOfMonth(new Date(parseInt(ano), parseInt(mes) - 1, 1))
      const dataFim = format(ultimoDia, 'yyyy-MM-dd')

      const { data, error } = await supabase
        .from('recibos_diarios')
        .select(`
          id,
          data_referencia,
          instalador_id,
          quantidade_servicos,
          valor_mao_obra,
          valor_reembolso,
          valor_total,
          status_pagamento,
          data_pagamento,
          comprovante_pix_url
        `)
        .eq('empresa_id', userData.empresa_id)
        .gte('data_referencia', dataInicio)
        .lte('data_referencia', dataFim)
        .order('data_referencia', { ascending: false })

      if (error) throw error

      // Buscar nomes dos instaladores
      const instaladorIds = [...new Set((data || []).map(r => r.instalador_id))]
      const { data: instaladores } = await supabase
        .from('usuarios')
        .select('id, nome')
        .in('id', instaladorIds)

      const instaladoresMap = new Map(instaladores?.map(i => [i.id, i.nome]) || [])

      const recibosFormatados: ReciboComInstalador[] = (data || []).map(r => ({
        id: r.id,
        data_referencia: r.data_referencia,
        instalador_id: r.instalador_id,
        instalador_nome: instaladoresMap.get(r.instalador_id) || 'Desconhecido',
        quantidade_servicos: r.quantidade_servicos,
        valor_mao_obra: Number(r.valor_mao_obra),
        valor_reembolso: Number(r.valor_reembolso),
        valor_total: Number(r.valor_total),
        status_pagamento: r.status_pagamento || 'pendente',
        data_pagamento: r.data_pagamento,
        comprovante_pix_url: r.comprovante_pix_url
      }))

      setRecibos(recibosFormatados)
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

      toast({
        title: 'Sucesso',
        description: 'Pagamento registrado e despesa lançada no caixa!'
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

      // Atualizar lançamentos no caixa com a nova data de pagamento
      const dataReferenciaFormatada = format(new Date(reciboSelecionado.data_referencia + 'T12:00:00'), 'dd/MM/yyyy')
      
      // Atualizar despesa de mão de obra
      await supabase
        .from('lancamentos_caixa')
        .update({ data_lancamento: dataPagamento })
        .eq('categoria', 'Pagamento Instalador')
        .ilike('descricao', `%${dataReferenciaFormatada}%`)
        .ilike('descricao', `%${reciboSelecionado.instalador_nome}%`)
      
      // Atualizar despesa de reembolso (se houver)
      if (reciboSelecionado.valor_reembolso > 0) {
        await supabase
          .from('lancamentos_caixa')
          .update({ data_lancamento: dataPagamento })
          .eq('categoria', 'Reembolso Materiais')
          .ilike('descricao', `%${dataReferenciaFormatada}%`)
          .ilike('descricao', `%${reciboSelecionado.instalador_nome}%`)
      }

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
        })
        .eq('id', reciboSelecionado.id)

      if (error) throw error

      // Se recibo já pago, atualizar lançamentos no caixa
      if (reciboSelecionado.status_pagamento === 'pago') {
        const dataReferenciaFormatada = format(new Date(reciboSelecionado.data_referencia + 'T12:00:00'), 'dd/MM/yyyy')

        // Atualizar valor da mão de obra no caixa
        await supabase
          .from('lancamentos_caixa')
          .update({ valor: editValorMaoObra })
          .eq('categoria', 'Pagamento Instalador')
          .ilike('descricao', `%${dataReferenciaFormatada}%`)
          .ilike('descricao', `%${reciboSelecionado.instalador_nome}%`)

        // Atualizar reembolso no caixa
        if (editValorReembolso > 0) {
          await supabase
            .from('lancamentos_caixa')
            .update({ valor: editValorReembolso })
            .eq('categoria', 'Reembolso Materiais')
            .ilike('descricao', `%${dataReferenciaFormatada}%`)
            .ilike('descricao', `%${reciboSelecionado.instalador_nome}%`)
        } else {
          // Se reembolso zerado, deletar lançamento de reembolso
          await supabase
            .from('lancamentos_caixa')
            .delete()
            .eq('categoria', 'Reembolso Materiais')
            .ilike('descricao', `%${dataReferenciaFormatada}%`)
            .ilike('descricao', `%${reciboSelecionado.instalador_nome}%`)
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

      // Se pago, deletar lançamentos correspondentes no caixa
      if (reciboApagar.status_pagamento === 'pago') {
        const dataReferenciaFormatada = format(new Date(reciboApagar.data_referencia + 'T12:00:00'), 'dd/MM/yyyy')

        await supabase
          .from('lancamentos_caixa')
          .delete()
          .eq('categoria', 'Pagamento Instalador')
          .ilike('descricao', `%${dataReferenciaFormatada}%`)
          .ilike('descricao', `%${reciboApagar.instalador_nome}%`)

        if (reciboApagar.valor_reembolso > 0) {
          await supabase
            .from('lancamentos_caixa')
            .delete()
            .eq('categoria', 'Reembolso Materiais')
            .ilike('descricao', `%${dataReferenciaFormatada}%`)
            .ilike('descricao', `%${reciboApagar.instalador_nome}%`)
        }
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
    if (filtroStatus === 'todos') return true
    return r.status_pagamento === filtroStatus
  })

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-8 w-8" />
            <span className="text-3xl opacity-30">⏳</span>
          </div>
          <div className="text-2xl font-bold">R$ {totalPendente.toFixed(2)}</div>
          <div className="text-sm opacity-90">Pendente de Pagamento</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-8 w-8" />
            <span className="text-3xl opacity-30">✅</span>
          </div>
          <div className="text-2xl font-bold">R$ {totalPago.toFixed(2)}</div>
          <div className="text-sm opacity-90">Pago no Mês</div>
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
            <option value="pago">Pagos</option>
          </select>
        </div>
        <div className="ml-auto">
          <Button onClick={abrirModalManual}>
            <Plus className="h-4 w-4 mr-1" />
            Lançar Recibo Manual
          </Button>
        </div>
      </div>

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
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recibosFiltrados.map((recibo) => (
                <TableRow key={recibo.id}>
                  <TableCell>
                    {formatarDataBR(recibo.data_referencia)}
                  </TableCell>
                  <TableCell className="font-medium">{recibo.instalador_nome}</TableCell>
                  <TableCell className="text-center">{recibo.quantidade_servicos}</TableCell>
                  <TableCell className="text-right">R$ {recibo.valor_mao_obra.toFixed(2)}</TableCell>
                  <TableCell className="text-right">R$ {recibo.valor_reembolso.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-bold">R$ {recibo.valor_total.toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={recibo.status_pagamento === 'pago' ? 'default' : 'secondary'}>
                      {recibo.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}
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
                        <Button
                          size="sm"
                          onClick={() => abrirModalPagamento(recibo)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Pagar
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirModalEdicao(recibo)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Pgto
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
                              Pago em {format(new Date(recibo.data_pagamento), 'dd/MM')}
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
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal de Pagamento */}
      <Dialog open={modalPagamento} onOpenChange={setModalPagamento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
          </DialogHeader>
          
          {reciboSelecionado && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p><strong>Instalador:</strong> {reciboSelecionado.instalador_nome}</p>
                <p><strong>Data do Recibo:</strong> {formatarDataBR(reciboSelecionado.data_referencia)}</p>
                <p><strong>Mão de Obra:</strong> R$ {reciboSelecionado.valor_mao_obra.toFixed(2)}</p>
                <p><strong>Reembolso:</strong> R$ {reciboSelecionado.valor_reembolso.toFixed(2)}</p>
                <p className="text-lg font-bold text-primary">
                  Total a Pagar: R$ {reciboSelecionado.valor_total.toFixed(2)}
                </p>
              </div>

              <div>
                <Label htmlFor="dataPagamento">Data do Pagamento *</Label>
                <Input
                  id="dataPagamento"
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="comprovante">Comprovante PIX (opcional)</Label>
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
                ⚡ Ao confirmar, uma despesa será registrada automaticamente no Caixa.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPagamento(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarPagamento} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Confirmar Pagamento'}
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

      {/* Modal de Edição de Pagamento */}
      <Dialog open={modalEdicao} onOpenChange={setModalEdicao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pagamento</DialogTitle>
          </DialogHeader>
          
          {reciboSelecionado && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p><strong>Instalador:</strong> {reciboSelecionado.instalador_nome}</p>
                <p><strong>Data do Recibo:</strong> {formatarDataBR(reciboSelecionado.data_referencia)}</p>
                <p className="text-lg font-bold text-primary">
                  Total: R$ {reciboSelecionado.valor_total.toFixed(2)}
                </p>
              </div>

              <div>
                <Label htmlFor="dataPagamentoEdit">Data do Pagamento *</Label>
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
    </div>
  )
}
