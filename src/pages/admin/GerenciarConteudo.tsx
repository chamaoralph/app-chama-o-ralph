import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const categorias = [
  "Instalação",
  "Manutenção",
  "Segurança",
  "Técnicas Avançadas",
  "Materiais",
  "Atendimento ao Cliente"
];

export default function GerenciarConteudo() {
  const queryClient = useQueryClient();
  const [artigoForm, setArtigoForm] = useState({
    id: "",
    titulo: "",
    conteudo: "",
    categoria: categorias[0],
    tags: "",
    publicado: true
  });
  const [treinamentoForm, setTreinamentoForm] = useState({
    id: "",
    titulo: "",
    descricao: "",
    video_url: "",
    categoria: "",
    duracao_minutos: "",
    publicado: true
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: string; id: string }>({
    open: false,
    type: "",
    id: ""
  });

  const { data: artigos } = useQuery({
    queryKey: ["admin-artigos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artigos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: treinamentos } = useQuery({
    queryKey: ["admin-treinamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treinamentos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const salvarArtigoMutation = useMutation({
    mutationFn: async (dados: typeof artigoForm) => {
      const { data: usuario } = await supabase
        .from("usuarios")
        .select("empresa_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!usuario) throw new Error("Usuário não encontrado");

      const payload = {
        titulo: dados.titulo,
        conteudo: dados.conteudo,
        categoria: dados.categoria,
        tags: dados.tags ? dados.tags.split(",").map((t) => t.trim()) : [],
        publicado: dados.publicado,
        empresa_id: usuario.empresa_id
      };

      if (dados.id) {
        const { error } = await supabase
          .from("artigos")
          .update(payload)
          .eq("id", dados.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("artigos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-artigos"] });
      toast.success(artigoForm.id ? "Artigo atualizado!" : "Artigo criado!");
      limparArtigoForm();
    },
    onError: () => {
      toast.error("Erro ao salvar artigo");
    }
  });

  const salvarTreinamentoMutation = useMutation({
    mutationFn: async (dados: typeof treinamentoForm) => {
      const { data: usuario } = await supabase
        .from("usuarios")
        .select("empresa_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!usuario) throw new Error("Usuário não encontrado");

      const payload = {
        titulo: dados.titulo,
        descricao: dados.descricao || null,
        video_url: dados.video_url,
        categoria: dados.categoria || null,
        duracao_minutos: dados.duracao_minutos ? parseInt(dados.duracao_minutos) : null,
        publicado: dados.publicado,
        empresa_id: usuario.empresa_id
      };

      if (dados.id) {
        const { error } = await supabase
          .from("treinamentos")
          .update(payload)
          .eq("id", dados.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("treinamentos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-treinamentos"] });
      toast.success(treinamentoForm.id ? "Treinamento atualizado!" : "Treinamento criado!");
      limparTreinamentoForm();
    },
    onError: () => {
      toast.error("Erro ao salvar treinamento");
    }
  });

  const deletarMutation = useMutation({
    mutationFn: async ({ tipo, id }: { tipo: string; id: string }) => {
      const tabela = tipo === "artigo" ? "artigos" : "treinamentos";
      const { error } = await supabase.from(tabela).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: variables.tipo === "artigo" ? ["admin-artigos"] : ["admin-treinamentos"]
      });
      toast.success(`${variables.tipo === "artigo" ? "Artigo" : "Treinamento"} deletado!`);
    },
    onError: () => {
      toast.error("Erro ao deletar");
    }
  });

  const togglePublicarMutation = useMutation({
    mutationFn: async ({ tipo, id, publicado }: { tipo: string; id: string; publicado: boolean }) => {
      const tabela = tipo === "artigo" ? "artigos" : "treinamentos";
      const { error } = await supabase.from(tabela).update({ publicado: !publicado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: variables.tipo === "artigo" ? ["admin-artigos"] : ["admin-treinamentos"]
      });
      toast.success(variables.publicado ? "Despublicado!" : "Publicado!");
    }
  });

  const limparArtigoForm = () => {
    setArtigoForm({
      id: "",
      titulo: "",
      conteudo: "",
      categoria: categorias[0],
      tags: "",
      publicado: true
    });
  };

  const limparTreinamentoForm = () => {
    setTreinamentoForm({
      id: "",
      titulo: "",
      descricao: "",
      video_url: "",
      categoria: "",
      duracao_minutos: "",
      publicado: true
    });
  };

  const editarArtigo = (artigo: any) => {
    setArtigoForm({
      id: artigo.id,
      titulo: artigo.titulo,
      conteudo: artigo.conteudo,
      categoria: artigo.categoria,
      tags: artigo.tags?.join(", ") || "",
      publicado: artigo.publicado
    });
  };

  const editarTreinamento = (treinamento: any) => {
    setTreinamentoForm({
      id: treinamento.id,
      titulo: treinamento.titulo,
      descricao: treinamento.descricao || "",
      video_url: treinamento.video_url,
      categoria: treinamento.categoria || "",
      duracao_minutos: treinamento.duracao_minutos?.toString() || "",
      publicado: treinamento.publicado
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gerenciar Conteúdo</h1>
          <p className="text-muted-foreground mt-2">
            Crie e gerencie artigos e treinamentos para sua equipe
          </p>
        </div>

        <Tabs defaultValue="artigos" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="artigos">📚 Artigos</TabsTrigger>
            <TabsTrigger value="treinamentos">🎓 Treinamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="artigos" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {artigoForm.id ? "Editar Artigo" : "Novo Artigo"}
                  {artigoForm.id && (
                    <Button variant="ghost" size="sm" onClick={limparArtigoForm}>
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="titulo">Título*</Label>
                  <Input
                    id="titulo"
                    value={artigoForm.titulo}
                    onChange={(e) => setArtigoForm({ ...artigoForm, titulo: e.target.value })}
                    placeholder="Ex: Como instalar split corretamente"
                  />
                </div>
                <div>
                  <Label htmlFor="categoria">Categoria*</Label>
                  <Select
                    value={artigoForm.categoria}
                    onValueChange={(value) => setArtigoForm({ ...artigoForm, categoria: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="conteudo">Conteúdo*</Label>
                  <Textarea
                    id="conteudo"
                    value={artigoForm.conteudo}
                    onChange={(e) => setArtigoForm({ ...artigoForm, conteudo: e.target.value })}
                    placeholder="Escreva o conteúdo completo do artigo..."
                    rows={10}
                  />
                </div>
                <div>
                  <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                  <Input
                    id="tags"
                    value={artigoForm.tags}
                    onChange={(e) => setArtigoForm({ ...artigoForm, tags: e.target.value })}
                    placeholder="Ex: split, instalação, básico"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={artigoForm.publicado}
                    onCheckedChange={(checked) =>
                      setArtigoForm({ ...artigoForm, publicado: checked })
                    }
                  />
                  <Label>Publicado</Label>
                </div>
                <Button
                  onClick={() => salvarArtigoMutation.mutate(artigoForm)}
                  disabled={!artigoForm.titulo || !artigoForm.conteudo}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {artigoForm.id ? "Atualizar" : "Criar"} Artigo
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lista de Artigos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {artigos?.map((artigo) => (
                      <TableRow key={artigo.id}>
                        <TableCell className="font-medium">{artigo.titulo}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{artigo.categoria}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={artigo.publicado ? "default" : "secondary"}>
                            {artigo.publicado ? "Publicado" : "Rascunho"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => editarArtigo(artigo)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                togglePublicarMutation.mutate({
                                  tipo: "artigo",
                                  id: artigo.id,
                                  publicado: artigo.publicado
                                })
                              }
                            >
                              {artigo.publicado ? "Despublicar" : "Publicar"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteDialog({ open: true, type: "artigo", id: artigo.id })
                              }
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="treinamentos" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {treinamentoForm.id ? "Editar Treinamento" : "Novo Treinamento"}
                  {treinamentoForm.id && (
                    <Button variant="ghost" size="sm" onClick={limparTreinamentoForm}>
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="tit-treino">Título*</Label>
                  <Input
                    id="tit-treino"
                    value={treinamentoForm.titulo}
                    onChange={(e) =>
                      setTreinamentoForm({ ...treinamentoForm, titulo: e.target.value })
                    }
                    placeholder="Ex: Técnicas de soldagem em cobre"
                  />
                </div>
                <div>
                  <Label htmlFor="desc-treino">Descrição</Label>
                  <Textarea
                    id="desc-treino"
                    value={treinamentoForm.descricao}
                    onChange={(e) =>
                      setTreinamentoForm({ ...treinamentoForm, descricao: e.target.value })
                    }
                    placeholder="Breve descrição do treinamento"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="video-url">URL do Vídeo* (YouTube ou Vimeo)</Label>
                  <Input
                    id="video-url"
                    value={treinamentoForm.video_url}
                    onChange={(e) =>
                      setTreinamentoForm({ ...treinamentoForm, video_url: e.target.value })
                    }
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cat-treino">Categoria</Label>
                    <Select
                      value={treinamentoForm.categoria}
                      onValueChange={(value) =>
                        setTreinamentoForm({ ...treinamentoForm, categoria: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="duracao">Duração (minutos)</Label>
                    <Input
                      id="duracao"
                      type="number"
                      value={treinamentoForm.duracao_minutos}
                      onChange={(e) =>
                        setTreinamentoForm({
                          ...treinamentoForm,
                          duracao_minutos: e.target.value
                        })
                      }
                      placeholder="15"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={treinamentoForm.publicado}
                    onCheckedChange={(checked) =>
                      setTreinamentoForm({ ...treinamentoForm, publicado: checked })
                    }
                  />
                  <Label>Publicado</Label>
                </div>
                <Button
                  onClick={() => salvarTreinamentoMutation.mutate(treinamentoForm)}
                  disabled={!treinamentoForm.titulo || !treinamentoForm.video_url}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {treinamentoForm.id ? "Atualizar" : "Criar"} Treinamento
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lista de Treinamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treinamentos?.map((treinamento) => (
                      <TableRow key={treinamento.id}>
                        <TableCell className="font-medium">{treinamento.titulo}</TableCell>
                        <TableCell>
                          {treinamento.categoria && (
                            <Badge variant="outline">{treinamento.categoria}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {treinamento.duracao_minutos
                            ? `${treinamento.duracao_minutos} min`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={treinamento.publicado ? "default" : "secondary"}>
                            {treinamento.publicado ? "Publicado" : "Rascunho"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => editarTreinamento(treinamento)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                togglePublicarMutation.mutate({
                                  tipo: "treinamento",
                                  id: treinamento.id,
                                  publicado: treinamento.publicado
                                })
                              }
                            >
                              {treinamento.publicado ? "Despublicar" : "Publicar"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteDialog({
                                  open: true,
                                  type: "treinamento",
                                  id: treinamento.id
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá deletar permanentemente o{" "}
              {deleteDialog.type === "artigo" ? "artigo" : "treinamento"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deletarMutation.mutate({ tipo: deleteDialog.type, id: deleteDialog.id });
                setDeleteDialog({ open: false, type: "", id: "" });
              }}
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
