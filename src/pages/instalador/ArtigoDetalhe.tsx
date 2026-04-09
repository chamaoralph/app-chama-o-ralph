import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InstaladorLayout } from "@/components/layout/InstaladorLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
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

function formatConteudo(conteudo: string) {
  const lines = conteudo.split("\n");
  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={index} className="h-4" />;

    // Main heading: "1.", "2.", etc.
    if (/^\d+\.\s+/.test(trimmed) && !trimmed.match(/^\d+\.\d+/)) {
      return (
        <h2 key={index} className="text-xl font-bold text-foreground mt-8 mb-3 border-b border-border pb-2">
          {trimmed}
        </h2>
      );
    }

    // Sub-heading: "1.1", "2.3", etc.
    if (/^\d+\.\d+[\.\s]/.test(trimmed)) {
      return (
        <h3 key={index} className="text-lg font-semibold text-foreground mt-6 mb-2">
          {trimmed}
        </h3>
      );
    }

    // Bullet points
    if (/^[-•●]\s/.test(trimmed)) {
      return (
        <li key={index} className="ml-6 text-muted-foreground leading-relaxed list-disc">
          {trimmed.replace(/^[-•●]\s/, "")}
        </li>
      );
    }

    return (
      <p key={index} className="text-muted-foreground leading-relaxed mb-3">
        {trimmed}
      </p>
    );
  });
}

function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export default function ArtigoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: artigo, isLoading } = useQuery({
    queryKey: ["artigo-detalhe", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artigos")
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
          <Skeleton className="h-6 w-1/4 mb-8" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </InstaladorLayout>
    );
  }

  if (!artigo) {
    return (
      <InstaladorLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Artigo não encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/instalador/conhecimento")}>
            Voltar
          </Button>
        </div>
      </InstaladorLayout>
    );
  }

  const readingTime = estimateReadingTime(artigo.conteudo);

  return (
    <InstaladorLayout>
      <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6">
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

        {/* Article header */}
        <article>
          <header className="mb-8">
            <Badge className={`mb-4 ${categoriaCores[artigo.categoria] || "bg-muted text-muted-foreground"}`}>
              {artigo.categoria}
            </Badge>

            <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight mb-4">
              {artigo.titulo}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {artigo.created_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(artigo.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {readingTime} min de leitura
              </span>
            </div>
          </header>

          {/* Separator */}
          <div className="border-b border-border mb-8" />

          {/* Content */}
          <div className="text-base sm:text-lg">
            {formatConteudo(artigo.conteudo)}
          </div>

          {/* Tags footer */}
          {artigo.tags && artigo.tags.length > 0 && (
            <div className="mt-12 pt-6 border-t border-border">
              <div className="flex flex-wrap gap-2">
                {artigo.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    </InstaladorLayout>
  );
}
