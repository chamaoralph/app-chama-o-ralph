import { useState, useMemo, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Package, Plus, History, Users, Pencil } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Instalador {
  id: string
  nome: string
}

interface CatalogoSuporte {
  id: string
  nome: string
}

interface Movimentacao {
  id: string
  instalador_id: string
  catalogo_id: string | null
  quantidade: number
  tipo_movimento: string
  data_movimento: string
  observacoes: string | null
  created_at: string
  servico_id: string | null
  valor_unitario: number | null
  usuarios?: { nome: string }
  servicos?: { codigo: string } | null
  catalogo_servicos?: { nome: string } | null
}

interface MovimentacaoSaldo {
  instalador_id: string
  catalogo_id: string | null
  tipo_movimento: string
  quantidade: number
}

interface BucketSaldo {
  catalogoId: string | null
  label: string
  saldo: number
}

const BAIXA_FIFO_RESULT_VAZIO = { custo_total: 0, qtd_atendida: 0, qtd_faltante: 0 }

export default function Suportes() {
  const { user } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()

  // Form de entrega
  const [formEntrega, setFormEntrega] = useState({
    instalador_id: '',
    catalogo_id: '',
    quantidade: '1',
    observacoes: ''
  })

  // Estado do modal de edição
  const [editando, setEditando] = useState<Movimentacao | null>(null)
  const [formEdit, setFormEdit] = useState({
    quantidade: '',
    valor_unitario: '',
    observacoes: ''
  })
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  const empresaQuery = useQuery({
    queryKey: ['minha-empresa', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data.empresa_id as string
    },
    enabled: !!user?.id,
  })

  const instaladoresQuery = useQuery({
    queryKey: ['instaladores-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('tipo', 'instalador')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return (data || []) as Instalador[]
    },
  })

  const catalogoSuportesQuery = useQuery({
    queryKey: ['catalogo-suportes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalogo_servicos')
        .select('id, nome')
        .eq('categoria', 'acessorios')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return (data || []) as CatalogoSuporte[]
    },
  })

  const saldoCentralQuery = useQuery({
    queryKey: ['estoque-saldo-suportes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('estoque_saldo').select('catalogo_id, saldo')
      if (error) throw error
      return (data || []) as { catalogo_id: string; saldo: number }[]
    },
  })

  // Todas as movimentações (sem limite) — usadas só pro cálculo de saldo por
  // instalador/modelo. Separado do histórico (que é limitado a 100) pra não
  // dar saldo errado quando a empresa já passou de 100 movimentações.
  const movimentacoesSaldoQuery = useQuery({
    queryKey: ['movimentacoes-suportes-saldo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('movimentacoes_suportes')
        .select('instalador_id, catalogo_id, tipo_movimento, quantidade')
      if (error) throw error
      return (data || []) as MovimentacaoSaldo[]
    },
  })

  const historicoQuery = useQuery({
    queryKey: ['movimentacoes-suportes-historico'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('movimentacoes_suportes')
        .select('*, usuarios!movimentacoes_suportes_instalador_id_fkey(nome), servicos(codigo), catalogo_servicos(nome)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data || []) as Movimentacao[]
    },
  })

  const instaladores = instaladoresQuery.data ?? []
  const catalogoSuportes = catalogoSuportesQuery.data ?? []
  const movimentacoes = historicoQuery.data ?? []

  const saldoCentralPorCatalogo = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const s of saldoCentralQuery.data ?? []) mapa[s.catalogo_id] = s.saldo
    return mapa
  }, [saldoCentralQuery.data])

  const nomeCatalogo = (id: string) => catalogoSuportes.find((c) => c.id === id)?.nome ?? 'Modelo removido'

  const saldosPorInstalador = useMemo(() => {
    const mapa: Record<string, Record<string, BucketSaldo>> = {}
    for (const mov of movimentacoesSaldoQuery.data ?? []) {
      const chave = mov.catalogo_id ?? '__sem_modelo__'
      if (!mapa[mov.instalador_id]) mapa[mov.instalador_id] = {}
      if (!mapa[mov.instalador_id][chave]) {
        mapa[mov.instalador_id][chave] = {
          catalogoId: mov.catalogo_id,
          label: mov.catalogo_id ? nomeCatalogo(mov.catalogo_id) : 'Não especificado',
          saldo: 0,
        }
      }
      const bucket = mapa[mov.instalador_id][chave]
      if (mov.tipo_movimento === 'entrega') bucket.saldo += mov.quantidade
      else if (mov.tipo_movimento === 'devolucao' || mov.tipo_movimento === 'uso') bucket.saldo -= mov.quantidade
    }
    const resultado: Record<string, BucketSaldo[]> = {}
    for (const [instaladorId, buckets] of Object.entries(mapa)) {
      resultado[instaladorId] = Object.values(buckets)
        .filter((b) => b.saldo !== 0)
        .sort((a, b) => a.label.localeCompare(b.label))
    }
    return resultado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimentacoesSaldoQuery.data, catalogoSuportes])

  const totalPorInstalador = (instaladorId: string) =>
    (saldosPorInstalador[instaladorId] ?? []).reduce((s, b) => s + b.saldo, 0)

  function invalidarTudo() {
    qc.invalidateQueries({ queryKey: ['movimentacoes-suportes-saldo'] })
    qc.invalidateQueries({ queryKey: ['movimentacoes-suportes-historico'] })
    qc.invalidateQueries({ queryKey: ['estoque-saldo-suportes'] })
  }

  const registrarEntrega = useMutation({
    mutationFn: async () => {
      if (!formEntrega.instalador_id) throw new Error('Selecione o instalador.')
      if (!formEntrega.catalogo_id) throw new Error('Selecione o acessório.')
      const quantidade = parseInt(formEntrega.quantidade, 10)
      if (!Number.isInteger(quantidade) || quantidade <= 0) throw new Error('Quantidade inválida.')

      const saldoDisponivel = saldoCentralPorCatalogo[formEntrega.catalogo_id] ?? 0
      if (quantidade > saldoDisponivel) {
        throw new Error(`Só há ${saldoDisponivel} unidade(s) desse modelo em estoque.`)
      }
      if (!empresaQuery.data) throw new Error('Empresa não encontrada.')

      const { data: resultado, error: erroBaixa } = await supabase.rpc('baixar_estoque_fifo', {
        p_catalogo_id: formEntrega.catalogo_id,
        p_quantidade: quantidade,
        p_servico_id: null,
      })
      if (erroBaixa) throw erroBaixa
      const { custo_total, qtd_atendida, qtd_faltante } = resultado?.[0] ?? BAIXA_FIFO_RESULT_VAZIO
      if (qtd_atendida === 0) throw new Error('Sem estoque disponível para este acessório.')

      const { error: erroInsert } = await supabase.from('movimentacoes_suportes').insert({
        empresa_id: empresaQuery.data,
        instalador_id: formEntrega.instalador_id,
        catalogo_id: formEntrega.catalogo_id,
        quantidade: qtd_atendida,
        tipo_movimento: 'entrega',
        valor_unitario: qtd_atendida > 0 ? Number((custo_total / qtd_atendida).toFixed(2)) : 0,
        observacoes: formEntrega.observacoes || null,
        data_movimento: new Date().toISOString().split('T')[0],
      })
      if (erroInsert) throw erroInsert

      return { qtdAtendida: qtd_atendida as number, qtdFaltante: qtd_faltante as number }
    },
    onSuccess: ({ qtdAtendida, qtdFaltante }) => {
      invalidarTudo()
      setFormEntrega({ instalador_id: '', catalogo_id: '', quantidade: '1', observacoes: '' })
      if (qtdFaltante > 0) {
        toast({
          title: '⚠️ Entrega parcial',
          description: `Só havia ${qtdAtendida} em estoque — entrega registrada parcialmente. Faltaram ${qtdFaltante}.`
        })
      } else {
        toast({ title: '✅ Acessórios entregues!', description: `${qtdAtendida} unidade(s) registrada(s) com sucesso.` })
      }
    },
    onError: (error: Error) => {
      toast({ title: '❌ Erro ao registrar', description: error.message, variant: 'destructive' })
    },
  })

  const registrarDevolucao = useMutation({
    mutationFn: async ({ instaladorId, catalogoId, quantidade }: { instaladorId: string; catalogoId: string | null; quantidade: number }) => {
      if (!empresaQuery.data) throw new Error('Empresa não encontrada.')

      if (catalogoId) {
        const { error: erroAjuste } = await supabase.rpc('ajustar_estoque_manual', {
          p_catalogo_id: catalogoId,
          p_quantidade: quantidade,
          p_motivo: 'Devolução de acessório pelo instalador',
        })
        if (erroAjuste) throw erroAjuste
      }

      const { error } = await supabase.from('movimentacoes_suportes').insert({
        empresa_id: empresaQuery.data,
        instalador_id: instaladorId,
        catalogo_id: catalogoId,
        quantidade,
        tipo_movimento: 'devolucao',
        data_movimento: new Date().toISOString().split('T')[0],
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidarTudo()
      toast({ title: '✅ Devolução registrada!' })
    },
    onError: (error: Error) => {
      toast({ title: '❌ Erro', description: error.message, variant: 'destructive' })
    },
  })

  const getTipoMovimentoBadge = (tipo: string) => {
    switch (tipo) {
      case 'entrega':
        return <Badge className="bg-green-500/20 text-green-700 hover:bg-green-500/20 border-green-500/30">Entrega</Badge>
      case 'devolucao':
        return <Badge className="bg-blue-500/20 text-blue-700 hover:bg-blue-500/20 border-blue-500/30">Devolução</Badge>
      case 'uso':
        return <Badge className="bg-orange-500/20 text-orange-700 hover:bg-orange-500/20 border-orange-500/30">Uso</Badge>
      default:
        return <Badge variant="outline">{tipo}</Badge>
    }
  }

  function abrirModalEdicao(mov: Movimentacao) {
    setFormEdit({
      quantidade: mov.quantidade.toString(),
      valor_unitario: mov.valor_unitario?.toString() || '',
      observacoes: mov.observacoes || ''
    })
    setEditando(mov)
  }

  async function salvarEdicao() {
    if (!editando) return

    setSalvandoEdicao(true)
    try {
      const { error } = await supabase
        .from('movimentacoes_suportes')
        .update({
          quantidade: parseInt(formEdit.quantidade) || 1,
          valor_unitario: parseFloat(formEdit.valor_unitario) || 0,
          observacoes: formEdit.observacoes?.trim() || null
        })
        .eq('id', editando.id)

      if (error) throw error

      toast({
        title: '✅ Movimentação atualizada!',
        description: 'Os dados foram salvos com sucesso.'
      })

      setEditando(null)
      invalidarTudo()

    } catch (error) {
      console.error('Erro ao atualizar:', error)
      toast({
        title: '❌ Erro ao atualizar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    } finally {
      setSalvandoEdicao(false)
    }
  }

  if (instaladoresQuery.isLoading || historicoQuery.isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Carregando...</div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Controle de Acessórios</h1>
          <p className="text-gray-600 mt-2">Gerencie a entrega e uso de acessórios do inventário (suportes, cabos, controles etc.) pelos instaladores</p>
        </div>

        <Tabs defaultValue="entregar" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="entregar" className="gap-2">
              <Plus className="w-4 h-4" />
              Entregar
            </TabsTrigger>
            <TabsTrigger value="saldos" className="gap-2">
              <Users className="w-4 h-4" />
              Saldos
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entregar" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Entregar Acessórios
                </CardTitle>
                <CardDescription>
                  Registre a entrega de um acessório do inventário para um instalador — a baixa é feita direto no estoque
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    registrarEntrega.mutate()
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Instalador *</Label>
                      <Select
                        value={formEntrega.instalador_id}
                        onValueChange={(v) => setFormEntrega({ ...formEntrega, instalador_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {instaladores.map((inst) => (
                            <SelectItem key={inst.id} value={inst.id}>
                              {inst.nome} {totalPorInstalador(inst.id) ? `(${totalPorInstalador(inst.id)} em mãos)` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Acessório *</Label>
                      <Select
                        value={formEntrega.catalogo_id}
                        onValueChange={(v) => setFormEntrega({ ...formEntrega, catalogo_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogoSuportes.map((c) => {
                            const saldo = saldoCentralPorCatalogo[c.id] ?? 0
                            return (
                              <SelectItem key={c.id} value={c.id} disabled={saldo <= 0}>
                                {c.nome} — {saldo} {saldo === 1 ? 'disponível' : 'disponíveis'}
                              </SelectItem>
                            )
                          })}
                          {catalogoSuportes.length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              Nenhum acessório cadastrado no catálogo
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Quantidade *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={formEntrega.quantidade}
                        onChange={(e) => setFormEntrega({ ...formEntrega, quantidade: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Input
                      value={formEntrega.observacoes}
                      onChange={(e) => setFormEntrega({ ...formEntrega, observacoes: e.target.value })}
                      placeholder="Ex: Suportes articulados 32-55, cabo HDMI 2m"
                    />
                  </div>

                  <Button type="submit" disabled={registrarEntrega.isPending || !formEntrega.instalador_id || !formEntrega.catalogo_id}>
                    {registrarEntrega.isPending ? 'Registrando...' : 'Registrar Entrega'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="saldos" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Saldo por Instalador</CardTitle>
                <CardDescription>
                  Quantidade de acessórios em mãos de cada instalador, por item
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instalador / Modelo</TableHead>
                      <TableHead className="text-center">Saldo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instaladores.map((inst) => {
                      const buckets = saldosPorInstalador[inst.id] ?? []
                      const total = totalPorInstalador(inst.id)
                      return (
                        <Fragment key={inst.id}>
                          <TableRow className="bg-muted/40">
                            <TableCell className="font-semibold">{inst.nome}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={total > 0 ? 'default' : 'secondary'}>{total}</Badge>
                            </TableCell>
                            <TableCell />
                          </TableRow>
                          {buckets.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={3} className="pl-6 text-sm text-muted-foreground">
                                Nenhum acessório em mãos
                              </TableCell>
                            </TableRow>
                          )}
                          {buckets.map((b) => (
                            <TableRow key={`${inst.id}-${b.catalogoId ?? 'sem-modelo'}`}>
                              <TableCell className="pl-6 text-sm text-muted-foreground">{b.label}</TableCell>
                              <TableCell className="text-center">{b.saldo}</TableCell>
                              <TableCell className="text-right">
                                {b.saldo > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={registrarDevolucao.isPending}
                                    onClick={() => {
                                      const qtd = prompt(`Quantos "${b.label}" devolver?`, '1')
                                      const quantidade = qtd ? parseInt(qtd, 10) : 0
                                      if (quantidade > 0) {
                                        registrarDevolucao.mutate({ instaladorId: inst.id, catalogoId: b.catalogoId, quantidade })
                                      }
                                    }}
                                  >
                                    Devolver
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </Fragment>
                      )
                    })}
                    {instaladores.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                          Nenhum instalador ativo
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Movimentações</CardTitle>
                <CardDescription>
                  Últimas 100 movimentações de acessórios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Instalador</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentacoes.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell>
                          {format(new Date(mov.data_movimento), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {mov.usuarios?.nome || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {mov.catalogo_servicos?.nome || '—'}
                        </TableCell>
                        <TableCell>
                          {getTipoMovimentoBadge(mov.tipo_movimento)}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {mov.tipo_movimento === 'entrega' ? '+' : '-'}{mov.quantidade}
                        </TableCell>
                        <TableCell className="text-right">
                          {mov.valor_unitario && mov.valor_unitario > 0
                            ? `R$ ${mov.valor_unitario.toFixed(2)}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {mov.servicos?.codigo || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {mov.observacoes || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => abrirModalEdicao(mov)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {movimentacoes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Nenhuma movimentação registrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal de Edição */}
        <Dialog open={!!editando} onOpenChange={(open) => !open && setEditando(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Movimentação</DialogTitle>
              <DialogDescription>
                Altere os dados da movimentação de acessórios
              </DialogDescription>
            </DialogHeader>

            {editando && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Instalador:</span>
                    <p className="font-medium">{editando.usuarios?.nome || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tipo:</span>
                    <p className="font-medium capitalize">{editando.tipo_movimento}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Modelo:</span>
                    <p className="font-medium">{editando.catalogo_servicos?.nome || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data:</span>
                    <p className="font-medium">
                      {format(new Date(editando.data_movimento), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-quantidade">Quantidade *</Label>
                  <Input
                    id="edit-quantidade"
                    type="number"
                    min="1"
                    value={formEdit.quantidade}
                    onChange={(e) => setFormEdit({ ...formEdit, quantidade: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-valor">Valor Unitário (R$)</Label>
                  <Input
                    id="edit-valor"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formEdit.valor_unitario}
                    onChange={(e) => setFormEdit({ ...formEdit, valor_unitario: e.target.value })}
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-obs">Observações</Label>
                  <Input
                    id="edit-obs"
                    value={formEdit.observacoes}
                    onChange={(e) => setFormEdit({ ...formEdit, observacoes: e.target.value })}
                    placeholder="Ex: Suportes articulados"
                    maxLength={200}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
              <Button onClick={salvarEdicao} disabled={salvandoEdicao}>
                {salvandoEdicao ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
