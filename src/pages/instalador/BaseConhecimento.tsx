import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InstaladorLayout } from "@/components/layout/InstaladorLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, Play, FileQuestion, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

const categorias = [
  "Todas",
  "Instalação",
  "Manutenção",
  "Segurança",
  "Técnicas Avançadas",
  "Materiais",
  "Atendimento ao Cliente"
];

const categoriaCores: Record<string, string> = {
  "Instalação": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Manutenção": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Segurança": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "Técnicas Avançadas": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Materiais": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Atendimento ao Cliente": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200"
};

export default function BaseConhecimento() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [artigoSelecionado, setArtigoSelecionado] = useState<any>(null);
  const [treinamentoSelecionado, setTreinamentoSelecionado] = useState<any>(null);

  const { data: artigos, isLoading: loadingArtigos } = useQuery({
    queryKey: ["artigos", busca, categoria],
    queryFn: async () => {
      let query = supabase
        .from("artigos")
        .select("*")
        .eq("publicado", true)
        .order("created_at", { ascending: false });

      if (busca) {
        query = query.or(`titulo.ilike.%${busca}%,conteudo.ilike.%${busca}%`);
      }
      if (categoria && categoria !== "Todas") {
        query = query.eq("categoria", categoria);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const { data: treinamentos, isLoading: loadingTreinamentos } = useQuery({
    queryKey: ["treinamentos", busca, categoria],
    queryFn: async () => {
      let query = supabase
        .from("treinamentos")
        .select("*")
        .eq("publicado", true)
        .order("created_at", { ascending: false });

      if (busca) {
        query = query.or(`titulo.ilike.%${busca}%,descricao.ilike.%${busca}%`);
      }
      if (categoria && categoria !== "Todas") {
        query = query.eq("categoria", categoria);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // Buscar questionários disponíveis
  const { data: questionarios, isLoading: loadingQuestionarios } = useQuery({
    queryKey: ["questionarios-disponiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questionarios")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Buscar certificações do usuário
  const { data: certificacoes } = useQuery({
    queryKey: ["minhas-certificacoes-base", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("certificacoes")
        .select("questionario_id")
        .eq("instalador_id", user.id)
        .eq("ativa", true);
      if (error) throw error;
      return data?.map(c => c.questionario_id) || [];
    },
    enabled: !!user
  });

  // Buscar tentativas do usuário
  const { data: tentativas } = useQuery({
    queryKey: ["minhas-tentativas", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tentativas")
        .select("questionario_id, aprovado")
        .eq("instalador_id", user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user
  });

  const getEmbedUrl = (url: string) => {
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const videoId = url.includes("watch?v=")
        ? url.split("watch?v=")[1]?.split("&")[0]
        : url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes("vimeo.com")) {
      const videoId = url.split("vimeo.com/")[1]?.split("?")[0];
      return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
  };

  return (
    <InstaladorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Base de Conhecimento</h1>
          <p className="text-muted-foreground mt-2">
            Artigos e treinamentos para aprimorar suas habilidades
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-full sm:w-[200px]">
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

        <Tabs defaultValue="questionarios" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="questionarios">
              <FileQuestion className="h-4 w-4 mr-2" />
              Questionários
            </TabsTrigger>
            <TabsTrigger value="artigos">
              <BookOpen className="h-4 w-4 mr-2" />
              Artigos
            </TabsTrigger>
            <TabsTrigger value="treinamentos">
              <Play className="h-4 w-4 mr-2" />
              Treinamentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="questionarios" className="mt-6">
            {loadingQuestionarios ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : questionarios && questionarios.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {questionarios.map((quest) => {
                  const jaCertificado = certificacoes?.includes(quest.id);
                  const tentativasDoQuest = tentativas?.filter(t => t.questionario_id === quest.id) || [];
                  const jaFez = tentativasDoQuest.length > 0;
                  
                  return (
                    <Card key={quest.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg">{quest.titulo}</CardTitle>
                          {jaCertificado && (
                            <Badge className="bg-green-100 text-green-800">
                              <Award className="w-3 h-3 mr-1" />
                              Certificado
                            </Badge>
                          )}
                        </div>
                        <CardDescription>
                          Nota mínima: {quest.nota_minima}%
                          {quest.tempo_limite_minutos && ` • ${quest.tempo_limite_minutos} min`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1 mb-4">
                          {quest.tipos_servico_liberados?.map((tipo: string) => (
                            <Badge key={tipo} variant="outline" className="text-xs">
                              {tipo}
                            </Badge>
                          ))}
                        </div>
                        <Button 
                          onClick={() => navigate(`/instalador/fazer-questionario/${quest.id}`)}
                          className="w-full"
                          variant={jaCertificado ? "outline" : "default"}
                        >
                          <FileQuestion className="h-4 w-4 mr-2" />
                          {jaCertificado ? "Refazer Questionário" : jaFez ? "Tentar Novamente" : "Fazer Questionário"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileQuestion className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum questionário disponível</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="artigos" className="mt-6">
            {loadingArtigos ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : artigos && artigos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {artigos.map((artigo) => (
                  <Card key={artigo.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{artigo.titulo}</CardTitle>
                        <Badge className={categoriaCores[artigo.categoria] || "bg-muted text-muted-foreground"}>
                          {artigo.categoria}
                        </Badge>
                      </div>
                      <CardDescription>
                        {artigo.conteudo.substring(0, 150)}...
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {artigo.tags?.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Button onClick={() => setArtigoSelecionado(artigo)} className="w-full">
                        Ler Artigo
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum artigo encontrado</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="treinamentos" className="mt-6">
            {loadingTreinamentos ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : treinamentos && treinamentos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {treinamentos.map((treinamento) => (
                  <Card key={treinamento.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{treinamento.titulo}</CardTitle>
                        {treinamento.categoria && (
                          <Badge className={categoriaCores[treinamento.categoria] || "bg-muted text-muted-foreground"}>
                            {treinamento.categoria}
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{treinamento.descricao}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {treinamento.duracao_minutos && (
                        <p className="text-sm text-muted-foreground mb-4">
                          Duração: {treinamento.duracao_minutos} minutos
                        </p>
                      )}
                      <Button
                        onClick={() => setTreinamentoSelecionado(treinamento)}
                        className="w-full"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Assistir
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum treinamento encontrado</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Artigo */}
      <Dialog open={!!artigoSelecionado} onOpenChange={() => setArtigoSelecionado(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{artigoSelecionado?.titulo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className={categoriaCores[artigoSelecionado?.categoria] || "bg-muted text-muted-foreground"}>
                {artigoSelecionado?.categoria}
              </Badge>
              {artigoSelecionado?.tags?.map((tag: string) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="prose dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap">{artigoSelecionado?.conteudo}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Treinamento */}
      <Dialog
        open={!!treinamentoSelecionado}
        onOpenChange={() => setTreinamentoSelecionado(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">{treinamentoSelecionado?.titulo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {treinamentoSelecionado?.descricao && (
              <p className="text-muted-foreground">{treinamentoSelecionado.descricao}</p>
            )}
            <div className="aspect-video">
              <iframe
                src={getEmbedUrl(treinamentoSelecionado?.video_url || "")}
                className="w-full h-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </InstaladorLayout>
  );
}
