import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, FileQuestion, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function Questionarios() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [form, setForm] = useState({
    id: '',
    titulo: '',
    tipo_conteudo: 'treinamento' as 'artigo' | 'treinamento',
    conteudo_id: '',
    tipos_servico_liberados: [] as string[],
    nota_minima: 100,
    tentativas_maximas: null as number | null,
    tempo_limite_minutos: null as number | null,
    ativo: true,
  });

  const { data: questionarios } = useQuery({
    queryKey: ['questionarios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('questionarios').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: artigos } = useQuery({
    queryKey: ['artigos-select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('artigos').select('id, titulo').eq('publicado', true);
      if (error) throw error;
      return data;
    },
  });

  const { data: treinamentos } = useQuery({
    queryKey: ['treinamentos-select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('treinamentos').select('id, titulo').eq('publicado', true);
      if (error) throw error;
      return data;
    },
  });

  const { data: tiposServico } = useQuery({
    queryKey: ['tipos-servico'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tipos_servico')
        .select('id, nome, ativo')
        .eq('ativo', true)
        .order('ordem');
      if (error) throw error;
      return data;
    },
  });

  const salvarMutation = useMutation({
    mutationFn: async (dados: typeof form) => {
      const { data: userData } = await supabase.from('usuarios').select('empresa_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single();
      if (!userData) throw new Error('Usuário não encontrado');

      const payload = {
        titulo: dados.titulo,
        tipo_conteudo: dados.tipo_conteudo,
        conteudo_id: dados.conteudo_id,
        tipos_servico_liberados: dados.tipos_servico_liberados,
        nota_minima: dados.nota_minima,
        tentativas_maximas: dados.tentativas_maximas || null,
        tempo_limite_minutos: dados.tempo_limite_minutos || null,
        ativo: dados.ativo,
        empresa_id: userData.empresa_id,
      };

      if (dados.id) {
        const { error } = await supabase.from('questionarios').update(payload).eq('id', dados.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('questionarios').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionarios'] });
      toast.success('Questionário salvo com sucesso!');
      setDialogAberto(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao salvar questionário: ' + error.message);
    },
  });

  const deletarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('questionarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionarios'] });
      toast.success('Questionário deletado com sucesso!');
      setDeleteDialog({ open: false, id: '' });
    },
    onError: (error) => {
      toast.error('Erro ao deletar questionário: ' + error.message);
    },
  });

  function resetForm() {
    setForm({
      id: '',
      titulo: '',
      tipo_conteudo: 'treinamento',
      conteudo_id: '',
      tipos_servico_liberados: [],
      nota_minima: 100,
      tentativas_maximas: null,
      tempo_limite_minutos: null,
      ativo: true,
    });
  }

  function editarQuestionario(quest: any) {
    setForm({
      id: quest.id,
      titulo: quest.titulo,
      tipo_conteudo: quest.tipo_conteudo,
      conteudo_id: quest.conteudo_id,
      tipos_servico_liberados: quest.tipos_servico_liberados,
      nota_minima: quest.nota_minima,
      tentativas_maximas: quest.tentativas_maximas,
      tempo_limite_minutos: quest.tempo_limite_minutos,
      ativo: quest.ativo,
    });
    setDialogAberto(true);
  }

  function toggleTipoServico(tipo: string) {
    setForm((prev) => ({
      ...prev,
      tipos_servico_liberados: prev.tipos_servico_liberados.includes(tipo)
        ? prev.tipos_servico_liberados.filter((t) => t !== tipo)
        : [...prev.tipos_servico_liberados, tipo],
    }));
  }

  const conteudosDisponiveis = form.tipo_conteudo === 'artigo' ? artigos : treinamentos;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Questionários</h1>
            <p className="text-muted-foreground">Gerencie questionários para certificação de instaladores</p>
          </div>
          <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Questionário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{form.id ? 'Editar' : 'Novo'} Questionário</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título do Questionário</Label>
                  <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Questionário de Elétrica Residencial" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Conteúdo</Label>
                    <Select value={form.tipo_conteudo} onValueChange={(v: any) => setForm({ ...form, tipo_conteudo: v, conteudo_id: '' })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="artigo">Artigo</SelectItem>
                        <SelectItem value="treinamento">Treinamento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Selecionar {form.tipo_conteudo === 'artigo' ? 'Artigo' : 'Treinamento'}</Label>
                    <Select value={form.conteudo_id} onValueChange={(v) => setForm({ ...form, conteudo_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {conteudosDisponiveis?.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.titulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Tipos de Serviço Liberados</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tiposServico?.map((tipo) => (
                      <Badge
                        key={tipo.id}
                        variant={form.tipos_servico_liberados.includes(tipo.nome) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleTipoServico(tipo.nome)}
                      >
                        {tipo.nome}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Nota Mínima (%)</Label>
                    <Input type="number" min="0" max="100" value={form.nota_minima} onChange={(e) => setForm({ ...form, nota_minima: Number(e.target.value) })} />
                  </div>

                  <div>
                    <Label>Tentativas Máximas (opcional)</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Ilimitado"
                      value={form.tentativas_maximas || ''}
                      onChange={(e) => setForm({ ...form, tentativas_maximas: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>

                  <div>
                    <Label>Tempo Limite (min)</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Sem limite"
                      value={form.tempo_limite_minutos || ''}
                      onChange={(e) => setForm({ ...form, tempo_limite_minutos: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch checked={form.ativo} onCheckedChange={(checked) => setForm({ ...form, ativo: checked })} />
                  <Label>Questionário Ativo</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogAberto(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => salvarMutation.mutate(form)} disabled={!form.titulo || !form.conteudo_id || form.tipos_servico_liberados.length === 0}>
                    Salvar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Questionários</CardTitle>
          </CardHeader>
          <CardContent>
            {!questionarios || questionarios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum questionário cadastrado</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Serviços Liberados</TableHead>
                    <TableHead>Nota Mín.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questionarios.map((quest) => (
                    <TableRow key={quest.id}>
                      <TableCell className="font-medium">{quest.titulo}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{quest.tipo_conteudo === 'artigo' ? 'Artigo' : 'Treinamento'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {quest.tipos_servico_liberados.map((tipo: string) => (
                            <Badge key={tipo} variant="secondary" className="text-xs">
                              {tipo}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{quest.nota_minima}%</TableCell>
                      <TableCell>{quest.ativo ? <Badge variant="default">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => navigate(`/admin/questionarios/${quest.id}/perguntas`)}>
                            <FileQuestion className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => editarQuestionario(quest)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeleteDialog({ open: true, id: quest.id })}>
                            <Trash2 className="h-4 w-4" />
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
      </div>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja deletar este questionário? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletarMutation.mutate(deleteDialog.id)}>Deletar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
