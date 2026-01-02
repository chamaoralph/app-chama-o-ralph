import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import { RFMConfigCard } from '@/components/admin/RFMConfigCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface TipoServico {
  id: string
  nome: string
  ativo: boolean
  ordem: number
}

export default function Configuracoes() {
  const { toast } = useToast()
  const [tiposServico, setTiposServico] = useState<TipoServico[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTipo, setEditingTipo] = useState<TipoServico | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchTiposServico()
  }, [])

  async function fetchTiposServico() {
    try {
      const { data, error } = await supabase
        .from('tipos_servico')
        .select('*')
        .order('ordem')

      if (error) throw error
      setTiposServico(data || [])
    } catch (error: any) {
      console.error('Erro ao buscar tipos de serviço:', error)
      toast({
        title: '❌ Erro',
        description: 'Não foi possível carregar os tipos de serviço',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  function openAddDialog() {
    setEditingTipo(null)
    setNovoNome('')
    setDialogOpen(true)
  }

  function openEditDialog(tipo: TipoServico) {
    setEditingTipo(tipo)
    setNovoNome(tipo.nome)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!novoNome.trim()) {
      toast({
        title: '⚠️ Atenção',
        description: 'Digite um nome para o tipo de serviço',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()

      if (!userData) throw new Error('Dados do usuário não encontrados')

      if (editingTipo) {
        const { error } = await supabase
          .from('tipos_servico')
          .update({ nome: novoNome.trim() })
          .eq('id', editingTipo.id)

        if (error) throw error
        toast({
          title: '✅ Atualizado!',
          description: 'Tipo de serviço atualizado com sucesso'
        })
      } else {
        const maxOrdem = tiposServico.length > 0 
          ? Math.max(...tiposServico.map(t => t.ordem)) + 1 
          : 1

        const { error } = await supabase
          .from('tipos_servico')
          .insert({
            empresa_id: userData.empresa_id,
            nome: novoNome.trim(),
            ordem: maxOrdem
          })

        if (error) throw error
        toast({
          title: '✅ Criado!',
          description: 'Tipo de serviço adicionado com sucesso'
        })
      }

      setDialogOpen(false)
      fetchTiposServico()
    } catch (error: any) {
      console.error('Erro ao salvar:', error)
      toast({
        title: '❌ Erro',
        description: error.message || 'Não foi possível salvar',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleAtivo(tipo: TipoServico) {
    try {
      const { error } = await supabase
        .from('tipos_servico')
        .update({ ativo: !tipo.ativo })
        .eq('id', tipo.id)

      if (error) throw error

      setTiposServico(prev =>
        prev.map(t => t.id === tipo.id ? { ...t, ativo: !t.ativo } : t)
      )

      toast({
        title: tipo.ativo ? '🔴 Desativado' : '🟢 Ativado',
        description: `"${tipo.nome}" foi ${tipo.ativo ? 'desativado' : 'ativado'}`
      })
    } catch (error: any) {
      console.error('Erro ao atualizar:', error)
      toast({
        title: '❌ Erro',
        description: 'Não foi possível atualizar',
        variant: 'destructive'
      })
    }
  }

  async function handleDelete(tipo: TipoServico) {
    if (!confirm(`Deseja realmente excluir "${tipo.nome}"?`)) return

    try {
      const { error } = await supabase
        .from('tipos_servico')
        .delete()
        .eq('id', tipo.id)

      if (error) throw error

      toast({
        title: '🗑️ Excluído',
        description: `"${tipo.nome}" foi removido`
      })
      fetchTiposServico()
    } catch (error: any) {
      console.error('Erro ao excluir:', error)
      toast({
        title: '❌ Erro',
        description: 'Não foi possível excluir',
        variant: 'destructive'
      })
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">⚙️ Configurações</h1>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tipos de Serviço</CardTitle>
                <CardDescription>
                  Gerencie os tipos de serviço disponíveis para cotações
                </CardDescription>
              </div>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : tiposServico.length === 0 ? (
              <p className="text-muted-foreground">Nenhum tipo de serviço cadastrado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-24 text-center">Ativo</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiposServico.map((tipo) => (
                    <TableRow key={tipo.id} className={!tipo.ativo ? 'opacity-50' : ''}>
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      </TableCell>
                      <TableCell className="font-medium">{tipo.nome}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={tipo.ativo}
                          onCheckedChange={() => handleToggleAtivo(tipo)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(tipo)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(tipo)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Critérios RFM */}
        <div className="mt-6">
          <RFMConfigCard />
        </div>

        {/* Espaço para futuras configurações */}
        <Card className="mt-6 opacity-50">
          <CardHeader>
            <CardTitle className="text-muted-foreground">Outras Configurações</CardTitle>
            <CardDescription>
              Em breve: Origens de Lead, Ocasiões e mais opções de personalização
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTipo ? 'Editar Tipo de Serviço' : 'Novo Tipo de Serviço'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex: Instalação de TV"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
