import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InstaladorLayout } from "@/components/layout/InstaladorLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const categoriaCores: Record<string, string> = {
  "Instalação": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Manutenção": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Segurança": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "Técnicas Avançadas": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Materiais": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Atendimento ao Cliente": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200"
};

function getEmbedUrl(url: string) {
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
}

export default function TreinamentoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: treinamento, isLoading } = useQuery({
    queryKey: ["treinamento-detalhe", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treinamentos")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  if (isLoading) {
    return (
      <InstaladorLayout>
        <div className="max-w-3xl mx-auto py-8 px-4">
          <Skeleton className="h-8 w-48 mb-8" />
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </InstaladorLayout>
    );
  }

  if (!treinamento) {
    return (
      <InstaladorLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Treinamento não encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/instalador/conhecimento")}>
            Voltar
          </Button>
        </div>
      </InstaladorLayout>
    );
  }

  return (
    <InstaladorLayout>
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/instalador/conhecimento")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Base de Conhecimento
        </Button>

        {/* Header */}
        <header className="mb-6">
          {treinamento.categoria && (
            <Badge className={`mb-4 ${categoriaCores[treinamento.categoria] || "bg-muted text-muted-foreground"}`}>
              {treinamento.categoria}
            </Badge>
          )}

          <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight mb-4">
            {treinamento.titulo}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
            {treinamento.duracao_minutos && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {treinamento.duracao_minutos} minutos
              </span>
            )}
            {treinamento.created_at && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {format(new Date(treinamento.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            )}
          </div>

          {treinamento.descricao && (
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              {treinamento.descricao}
            </p>
          )}
        </header>

        {/* Video player */}
        <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video">
          <iframe
            src={getEmbedUrl(treinamento.video_url)}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={treinamento.titulo}
          />
        </div>
      </div>
    </InstaladorLayout>
  );
}
