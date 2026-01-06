import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { Check, Upload, Eye, Clock, DollarSign, FileText } from 'lucide-react'

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
      const dataFim = `${ano}-${mes}-31`

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
                    {format(new Date(recibo.data_referencia), 'dd/MM/yyyy', { locale: ptBR })}
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
                    <div className="flex gap-2 justify-center">
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
                <p><strong>Data do Recibo:</strong> {format(new Date(reciboSelecionado.data_referencia), 'dd/MM/yyyy')}</p>
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
    </div>
  )
}
