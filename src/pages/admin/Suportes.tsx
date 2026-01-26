import { useState, useEffect } from 'react'
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
  saldo_suportes?: number
}

interface Movimentacao {
  id: string
  instalador_id: string
  quantidade: number
  tipo_movimento: string
  data_movimento: string
  observacoes: string | null
  created_at: string
  servico_id: string | null
  valor_unitario: number | null
  usuarios?: { nome: string }
  servicos?: { codigo: string } | null
}

export default function Suportes() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [instaladores, setInstaladores] = useState<Instalador[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [saldos, setSaldos] = useState<Record<string, number>>({})
  
  // Form de entrega
  const [formEntrega, setFormEntrega] = useState({
    instalador_id: '',
    quantidade: '1',
    valor_unitario: '',
    observacoes: ''
  })
  const [enviando, setEnviando] = useState(false)
  
  // Estado do modal de edição
  const [editando, setEditando] = useState<Movimentacao | null>(null)
  const [formEdit, setFormEdit] = useState({
    quantidade: '',
    valor_unitario: '',
    observacoes: ''
  })
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  useEffect(() => {
    fetchData()
  }, [user])

  async function fetchData() {
    try {
      setLoading(true)
      
      // Buscar instaladores ativos
      const { data: instData } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('tipo', 'instalador')
        .eq('ativo', true)
        .order('nome')
      
      setInstaladores(instData || [])
      
      // Buscar movimentações
      const { data: movData } = await supabase
        .from('movimentacoes_suportes')
        .select('*, usuarios!movimentacoes_suportes_instalador_id_fkey(nome), servicos(codigo)')
        .order('created_at', { ascending: false })
        .limit(100)
      
      setMovimentacoes((movData || []) as Movimentacao[])
      
      // Calcular saldos por instalador
      if (movData) {
        const saldoCalc: Record<string, number> = {}
        movData.forEach((mov) => {
          if (!saldoCalc[mov.instalador_id]) saldoCalc[mov.instalador_id] = 0
          if (mov.tipo_movimento === 'entrega') {
            saldoCalc[mov.instalador_id] += mov.quantidade
          } else if (mov.tipo_movimento === 'devolucao' || mov.tipo_movimento === 'uso') {
            saldoCalc[mov.instalador_id] -= mov.quantidade
          }
        })
        setSaldos(saldoCalc)
      }
      
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  async function registrarEntrega(e: React.FormEvent) {
    e.preventDefault()
    if (!formEntrega.instalador_id || !formEntrega.quantidade) return
    
    setEnviando(true)
    try {
      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user?.id)
        .single()
      
      if (!userData) throw new Error('Usuário não encontrado')
      
      const { error } = await supabase
        .from('movimentacoes_suportes')
        .insert({
          empresa_id: userData.empresa_id,
          instalador_id: formEntrega.instalador_id,
          quantidade: parseInt(formEntrega.quantidade),
          tipo_movimento: 'entrega',
          valor_unitario: formEntrega.valor_unitario ? parseFloat(formEntrega.valor_unitario) : 0,
          observacoes: formEntrega.observacoes || null,
          data_movimento: new Date().toISOString().split('T')[0]
        })
      
      if (error) throw error
      
      toast({
        title: '✅ Suportes entregues!',
        description: `${formEntrega.quantidade} suporte(s) registrado(s) com sucesso.`
      })
      
      setFormEntrega({ instalador_id: '', quantidade: '1', valor_unitario: '', observacoes: '' })
      fetchData()
      
    } catch (error: any) {
      console.error('Erro:', error)
      toast({
        title: '❌ Erro ao registrar',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setEnviando(false)
    }
  }

  async function registrarDevolucao(instaladorId: string, quantidade: number) {
    try {
      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user?.id)
        .single()
      
      if (!userData) throw new Error('Usuário não encontrado')
      
      const { error } = await supabase
        .from('movimentacoes_suportes')
        .insert({
          empresa_id: userData.empresa_id,
          instalador_id: instaladorId,
          quantidade: quantidade,
          tipo_movimento: 'devolucao',
          data_movimento: new Date().toISOString().split('T')[0]
        })
      
      if (error) throw error
      
      toast({ title: '✅ Devolução registrada!' })
      fetchData()
      
    } catch (error: any) {
      toast({
        title: '❌ Erro',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

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
      fetchData()
      
    } catch (error: any) {
      console.error('Erro ao atualizar:', error)
      toast({
        title: '❌ Erro ao atualizar',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setSalvandoEdicao(false)
    }
  }

  if (loading) {
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
          <h1 className="text-3xl font-bold text-gray-900">Controle de Suportes</h1>
          <p className="text-gray-600 mt-2">Gerencie a entrega e uso de suportes de TV pelos instaladores</p>
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
                  Entregar Suportes
                </CardTitle>
                <CardDescription>
                  Registre a entrega de suportes para um instalador
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={registrarEntrega} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Instalador *</Label>
                      <Select 
                        value={formEntrega.instalador_id} 
                        onValueChange={(v) => setFormEntrega({...formEntrega, instalador_id: v})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {instaladores.map((inst) => (
                            <SelectItem key={inst.id} value={inst.id}>
                              {inst.nome} {saldos[inst.id] ? `(${saldos[inst.id]} em mãos)` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Quantidade *</Label>
                      <Input 
                        type="number"
                        min="1"
                        value={formEntrega.quantidade}
                        onChange={(e) => setFormEntrega({...formEntrega, quantidade: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Valor Unitário (R$) *</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        min="0"
                        value={formEntrega.valor_unitario}
                        onChange={(e) => setFormEntrega({...formEntrega, valor_unitario: e.target.value})}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Input 
                      value={formEntrega.observacoes}
                      onChange={(e) => setFormEntrega({...formEntrega, observacoes: e.target.value})}
                      placeholder="Ex: Suportes articulados 32-55"
                    />
                  </div>
                  
                  <Button type="submit" disabled={enviando || !formEntrega.instalador_id}>
                    {enviando ? 'Registrando...' : 'Registrar Entrega'}
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
                  Quantidade de suportes em mãos de cada instalador
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instalador</TableHead>
                      <TableHead className="text-center">Suportes em Mãos</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instaladores.map((inst) => (
                      <TableRow key={inst.id}>
                        <TableCell className="font-medium">{inst.nome}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={saldos[inst.id] > 0 ? 'default' : 'secondary'}>
                            {saldos[inst.id] || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {saldos[inst.id] > 0 && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                const qtd = prompt('Quantos suportes devolver?', '1')
                                if (qtd && parseInt(qtd) > 0) {
                                  registrarDevolucao(inst.id, parseInt(qtd))
                                }
                              }}
                            >
                              Devolver
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
                  Últimas 100 movimentações de suportes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Instalador</TableHead>
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
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                Altere os dados da movimentação de suportes
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
