import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Send, Copy, RefreshCw, Eye, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EnviarTermoModal } from "./EnviarTermoModal";
import { gerarESalvarTermoPDF } from "@/lib/gerarTermoPDF";
import type { TVItem } from "./SelectorPrecoTV";

interface Props {
  cotacao: {
    id: string;
    empresa_id: string;
    cliente_nome: string;
    cliente_telefone: string;
    cliente_endereco: string | null;
  };
  tvsItens?: TVItem[];
}

interface Termo {
  id: string;
  token: string;
  status: string;
  enviado_em: string;
  visualizado_em: string | null;
  aceito_em: string | null;
  modalidade_escolhida: string | null;
  nome_aceite: string | null;
  cpf_aceite: string | null;
  assinatura_base64: string | null;
  pdf_url: string | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_endereco: string | null;
  tv_marca_modelo: string | null;
  tv_polegadas: string | null;
  tv_tipo: string | null;
  valor_completa: number | null;
  valor_colaborativa: number | null;
  aceite_user_agent: string | null;
  empresa_id: string;
}

function fmtData(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function TermoAceiteCard({ cotacao, tvsItens }: Props) {
  const [termo, setTermo] = useState<Termo | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  async function gerarPdfAgora() {
    if (!termo) return;
    setGerandoPdf(true);
    try {
      const { data: emp } = await supabase
        .from("empresas")
        .select("nome")
        .eq("id", cotacao.empresa_id)
        .maybeSingle();
      const empresaNome = (emp as any)?.nome || "Empresa";
      const url = await gerarESalvarTermoPDF(supabase, termo as any, cotacao.empresa_id, empresaNome);
      setTermo({ ...termo, pdf_url: url });
      toast.success("PDF gerado!");
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + (e?.message || ""));
    } finally {
      setGerandoPdf(false);
    }
  }

  const fetchTermo = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("termos_aceite" as any)
      .select("*")
      .eq("cotacao_id", cotacao.id)
      .order("enviado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    setTermo((data as any) ?? null);
    setLoading(false);
  }, [cotacao.id]);

  useEffect(() => {
    fetchTermo();
  }, [fetchTermo]);

  function copiarLink() {
    if (!termo) return;
    const url = `${window.location.origin}/aceite/${termo.token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  function abrirLink() {
    if (!termo) return;
    window.open(`${window.location.origin}/aceite/${termo.token}`, "_blank");
  }

  if (loading) return null;

  // Estado: nunca enviado
  if (!termo) {
    return (
      <>
        <Card className="border-dashed border-orange-300 bg-orange-50/50">
          <CardContent className="flex items-center justify-between p-4 gap-3">
            <div>
              <div className="font-medium">Termo de Aceite Digital</div>
              <div className="text-sm text-muted-foreground">
                Envie o termo por WhatsApp para o cliente assinar.
              </div>
              <div className="mt-1 text-xs text-orange-700 font-medium">
                ⚠️ O serviço só será liberado para os instaladores depois que o cliente assinar o termo.
              </div>
            </div>
            <Button onClick={() => setModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
              <Send className="mr-2 h-4 w-4" /> Enviar Termo
            </Button>
          </CardContent>
        </Card>
        <EnviarTermoModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          cotacao={cotacao}
          tvsItens={tvsItens}
          onEnviado={fetchTermo}
        />
      </>
    );
  }

  const aceito = termo.status === "aceito";

  return (
    <>
      <Card className={aceito ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {aceito ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <Clock className="h-5 w-5 text-amber-600" />
              )}
              <div>
                <div className="font-medium">Termo de Aceite</div>
                <div className="text-sm text-muted-foreground">
                  {aceito ? "Assinado pelo cliente" : termo.status === "visualizado" ? "Visualizado, aguardando assinatura" : "Aguardando o cliente abrir o link"}
                </div>
              </div>
            </div>
            <Badge variant={aceito ? "default" : "secondary"} className={aceito ? "bg-emerald-600" : ""}>
              {termo.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Enviado:</span> {fmtData(termo.enviado_em)}</div>
            <div><span className="text-muted-foreground">Visualizado:</span> {fmtData(termo.visualizado_em)}</div>
            <div><span className="text-muted-foreground">Aceito:</span> {fmtData(termo.aceito_em)}</div>
            <div><span className="text-muted-foreground">Modalidade:</span> {termo.modalidade_escolhida ? (termo.modalidade_escolhida === "completa" ? "Completa" : "Colaborativa") : "—"}</div>
          </div>

          {aceito && (
            <div className="space-y-2 rounded-md border bg-background p-3">
              <div className="text-xs"><span className="text-muted-foreground">Nome:</span> {termo.nome_aceite}</div>
              <div className="text-xs"><span className="text-muted-foreground">CPF:</span> {termo.cpf_aceite}</div>
              {termo.assinatura_base64 && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Assinatura:</div>
                  <img src={termo.assinatura_base64} alt="Assinatura" className="max-h-24 rounded border bg-white" />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {aceito && (
              termo.pdf_url ? (
                <Button size="sm" onClick={() => window.open(termo.pdf_url!, "_blank")} className="bg-emerald-600 hover:bg-emerald-700">
                  <FileDown className="mr-1 h-3 w-3" /> Ver PDF
                </Button>
              ) : (
                <Button size="sm" onClick={gerarPdfAgora} disabled={gerandoPdf} className="bg-emerald-600 hover:bg-emerald-700">
                  {gerandoPdf ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <FileDown className="mr-1 h-3 w-3" />}
                  {gerandoPdf ? "Gerando..." : "Gerar PDF agora"}
                </Button>
              )
            )}
            <Button size="sm" variant="outline" onClick={copiarLink}>
              <Copy className="mr-1 h-3 w-3" /> Copiar link
            </Button>
            <Button size="sm" variant="outline" onClick={abrirLink}>
              <Eye className="mr-1 h-3 w-3" /> Abrir
            </Button>
            {!aceito && (
              <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>
                <RefreshCw className="mr-1 h-3 w-3" /> Reenviar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <EnviarTermoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        cotacao={cotacao}
        tvsItens={tvsItens}
        onEnviado={fetchTermo}
      />
    </>
  );
}
