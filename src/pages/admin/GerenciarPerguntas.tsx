import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface Alternativa {
  id?: string;
  texto: string;
  correta: boolean;
  ordem: number;
}

export default function GerenciarPerguntas() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [form, setForm] = useState({
    id: '',
    enunciado: '',
    ordem: 1,
    pontos: 1,
    alternativas: [] as Alternativa[],
  });

  const { data: questionario } = useQuery({
    queryKey: ['questionario', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('questionarios').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: perguntas } = useQuery({
    queryKey: ['perguntas', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perguntas')
        .select(`
          *,
          alternativas (*)
        `)
        .eq('questionario_id', id)
        .order('ordem');
      if (error) throw error;
      return data;
    },
  });

  const salvarPerguntaMutation = useMutation({
    mutationFn: async (dados: typeof form) => {
      // Validações
      if (dados.alternativas.length < 2) {
        throw new Error('É necessário pelo menos 2 alternativas');
      }
      if (!dados.alternativas.some((a) => a.correta)) {
        throw new Error('Marque pelo menos uma alternativa como correta');
      }

      // Salvar pergunta
      let perguntaId = dados.id;
      if (dados.id) {
        // Atualizar
        const { error } = await supabase
          .from('perguntas')
          .update({
            enunciado: dados.enunciado,
            ordem: dados.ordem,
            pontos: dados.pontos,
          })
          .eq('id', dados.id);
        if (error) throw error;

        // Deletar alternativas antigas
        await supabase.from('alternativas').delete().eq('pergunta_id', dados.id);
      } else {
        // Inserir nova
        const { data: newPergunta, error } = await supabase
          .from('perguntas')
          .insert({
            questionario_id: id,
            enunciado: dados.enunciado,
            ordem: dados.ordem,
            pontos: dados.pontos,
          })
          .select()
          .single();
        if (error) throw error;
        perguntaId = newPergunta.id;
      }

      // Inserir alternativas
      const alternativasParaInserir = dados.alternativas.map((alt, idx) => ({
        pergunta_id: perguntaId,
        texto: alt.texto,
        correta: alt.correta,
        ordem: idx + 1,
      }));

      const { error: altError } = await supabase.from('alternativas').insert(alternativasParaInserir);
      if (altError) throw altError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perguntas', id] });
      toast.success('Pergunta salva com sucesso!');
      setDialogAberto(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao salvar pergunta: ' + error.message);
    },
  });

  const deletarPerguntaMutation = useMutation({
    mutationFn: async (perguntaId: string) => {
      const { error } = await supabase.from('perguntas').delete().eq('id', perguntaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perguntas', id] });
      toast.success('Pergunta deletada com sucesso!');
      setDeleteDialog({ open: false, id: '' });
    },
    onError: (error) => {
      toast.error('Erro ao deletar pergunta: ' + error.message);
    },
  });

  function resetForm() {
    setForm({
      id: '',
      enunciado: '',
      ordem: (perguntas?.length || 0) + 1,
      pontos: 1,
      alternativas: [
        { texto: '', correta: false, ordem: 1 },
        { texto: '', correta: false, ordem: 2 },
      ],
    });
  }

  function editarPergunta(pergunta: any) {
    setForm({
      id: pergunta.id,
      enunciado: pergunta.enunciado,
      ordem: pergunta.ordem,
      pontos: pergunta.pontos,
      alternativas: pergunta.alternativas
        .sort((a: any, b: any) => a.ordem - b.ordem)
        .map((alt: any) => ({
          id: alt.id,
          texto: alt.texto,
          correta: alt.correta,
          ordem: alt.ordem,
        })),
    });
    setDialogAberto(true);
  }

  function adicionarAlternativa() {
    setForm({
      ...form,
      alternativas: [
        ...form.alternativas,
        { texto: '', correta: false, ordem: form.alternativas.length + 1 },
      ],
    });
  }

  function removerAlternativa(index: number) {
    setForm({
      ...form,
      alternativas: form.alternativas.filter((_, i) => i !== index),
    });
  }

  function atualizarAlternativa(index: number, campo: keyof Alternativa, valor: any) {
    const novasAlternativas = [...form.alternativas];
    novasAlternativas[index] = { ...novasAlternativas[index], [campo]: valor };
    setForm({ ...form, alternativas: novasAlternativas });
  }

  if (!questionario) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => navigate('/admin/questionarios')} className="mb-2">
              ← Voltar
            </Button>
            <h1 className="text-3xl font-bold">{questionario.titulo}</h1>
            <p className="text-muted-foreground">Gerencie as perguntas deste questionário</p>
          </div>
          <Button onClick={() => { resetForm(); setDialogAberto(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Pergunta
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              Perguntas ({perguntas?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!perguntas || perguntas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma pergunta cadastrada. Clique em "Nova Pergunta" para começar.
              </div>
            ) : (
              <div className="space-y-4">
                {perguntas.map((pergunta, index) => (
                  <Card key={pergunta.id} className="border">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">#{pergunta.ordem}</Badge>
                            <Badge variant="secondary">{pergunta.pontos} pts</Badge>
                          </div>
                          <p className="font-medium">{pergunta.enunciado}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => editarPergunta(pergunta)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeleteDialog({ open: true, id: pergunta.id })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {pergunta.alternativas
                          .sort((a: any, b: any) => a.ordem - b.ordem)
                          .map((alt: any) => (
                            <div
                              key={alt.id}
                              className={`p-2 rounded text-sm ${
                                alt.correta
                                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900'
                                  : 'bg-muted'
                              }`}
                            >
                              {alt.correta && '✓ '}
                              {alt.texto}
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar' : 'Nova'} Pergunta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Enunciado da Pergunta</Label>
              <Textarea
                value={form.enunciado}
                onChange={(e) => setForm({ ...form, enunciado: e.target.value })}
                placeholder="Digite a pergunta..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ordem</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.ordem}
                  onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Pontos</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.pontos}
                  onChange={(e) => setForm({ ...form, pontos: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Alternativas</Label>
                <Button size="sm" variant="outline" onClick={adicionarAlternativa}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {form.alternativas.map((alt, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        value={alt.texto}
                        onChange={(e) => atualizarAlternativa(index, 'texto', e.target.value)}
                        placeholder={`Alternativa ${index + 1}`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={alt.correta}
                          onChange={(e) => atualizarAlternativa(index, 'correta', e.target.checked)}
                          className="rounded"
                        />
                        Correta
                      </label>
                      {form.alternativas.length > 2 && (
                        <Button size="sm" variant="ghost" onClick={() => removerAlternativa(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Marque a(s) alternativa(s) correta(s)
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => salvarPerguntaMutation.mutate(form)}
                disabled={!form.enunciado || form.alternativas.length < 2}
              >
                Salvar Pergunta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta pergunta? Todas as alternativas serão removidas também.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletarPerguntaMutation.mutate(deleteDialog.id)}>
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
