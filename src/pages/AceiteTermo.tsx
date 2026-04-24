import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  TERMO_SECOES,
  TERMO_ACEITE_TEXTO,
  colaborativaIndisponivel,
  colaborativaIndisponivelLista,
  formatarCPF,
  formatarMoeda,
} from "@/lib/termoTexto";
import { CheckCircle2, FileText, PenLine, ShieldCheck, AlertTriangle, Download, ChevronDown, Loader2 } from "lucide-react";
import { gerarESalvarTermoPDF } from "@/lib/gerarTermoPDF";

type Etapa = 1 | 2 | 3 | 4;

interface Termo {
  id: string;
  token: string;
  status: string;
  enviado_em: string;
  aceito_em: string | null;
  empresa_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_endereco: string | null;
  tv_marca_modelo: string | null;
  tv_polegadas: string | null;
  tv_tipo: string | null;
  valor_completa: number | null;
  valor_colaborativa: number | null;
  modalidade_escolhida: string | null;
  nome_aceite: string | null;
  cpf_aceite: string | null;
  assinatura_base64: string | null;
  aceite_user_agent: string | null;
  pdf_url: string | null;
  tvs_itens: any[] | null;
}

export default function AceiteTermo() {
  const { token } = useParams<{ token: string }>();
  const [termo, setTermo] = useState<Termo | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<Etapa>(1);
  const [modalidade, setModalidade] = useState<"completa" | "colaborativa" | null>(null);
  const [scrollFim, setScrollFim] = useState(false);
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [aceitouTermo, setAceitouTermo] = useState(false);
  const [assinou, setAssinou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const termoScrollRef = useRef<HTMLDivElement | null>(null);

  // Buscar termo
  useEffect(() => {
    (async () => {
      if (!token) {
        setErro("Link inválido");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("termos_aceite" as any)
        .select("*")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) {
        setErro("Link inválido ou expirado.");
      } else {
        const t = data as any as Termo;
        setTermo(t);
        setPdfUrl(t.pdf_url || null);
        if (t.status === "aceito") {
          setEtapa(4);
          setModalidade((t.modalidade_escolhida as any) || null);
        } else if (t.status === "pendente") {
          // marca como visualizado
          await supabase
            .from("termos_aceite" as any)
            .update({ status: "visualizado", visualizado_em: new Date().toISOString() })
            .eq("token", token);
        }
      }
      setLoading(false);
    })();
  }, [token]);

  const tvsLista: Array<{ tipo?: string | null; polegadas?: string | null; marca_modelo?: string | null }> =
    Array.isArray(termo?.tvs_itens) && termo!.tvs_itens!.length > 0
      ? termo!.tvs_itens as any
      : termo
      ? [{ tipo: termo.tv_tipo, polegadas: termo.tv_polegadas, marca_modelo: termo.tv_marca_modelo }]
      : [];
  const colabInfo = tvsLista.length > 1
    ? colaborativaIndisponivelLista(tvsLista)
    : colaborativaIndisponivel(termo?.tv_tipo, termo?.tv_polegadas);

  const mostrarCompleta = termo?.valor_completa != null;
  const mostrarColaborativa = termo?.valor_colaborativa != null && !colabInfo.indisponivel;
  const modalidadeUnica = mostrarCompleta && !mostrarColaborativa
    ? "completa"
    : !mostrarCompleta && mostrarColaborativa
    ? "colaborativa"
    : null;

  // Pré-seleciona automaticamente quando só uma modalidade foi enviada
  useEffect(() => {
    if (modalidadeUnica && !modalidade && termo?.status !== "aceito") {
      setModalidade(modalidadeUnica as any);
    }
  }, [modalidadeUnica, modalidade, termo?.status]);

  // Scroll do termo
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setScrollFim(true);
  }

  // Canvas de assinatura
  useEffect(() => {
    if (etapa !== 3) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#0f172a";
  }, [etapa]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPos(e);
  }
  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastPointRef.current) return;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
    if (!assinou) setAssinou(true);
  }
  function endDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    lastPointRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  }
  function limparAssinatura() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setAssinou(false);
  }

  const cpfValido = cpf.replace(/\D/g, "").length === 11;
  const nomeValido = nome.trim().length >= 3;
  const podeAssinar = cpfValido && nomeValido && assinou && aceitouTermo;

  const confirmarAceite = useCallback(async () => {
    if (!termo || !canvasRef.current || !modalidade) return;
    setSalvando(true);
    try {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const agora = new Date().toISOString();
      const { error } = await supabase
        .from("termos_aceite" as any)
        .update({
          modalidade_escolhida: modalidade,
          nome_aceite: nome.trim(),
          cpf_aceite: cpf,
          assinatura_base64: dataUrl,
          aceite_user_agent: navigator.userAgent,
          aceite_data_hora: agora,
          aceito_em: agora,
          status: "aceito",
        })
        .eq("token", termo.token);
      if (error) throw error;
      setTermo({ ...termo, modalidade_escolhida: modalidade, nome_aceite: nome.trim(), cpf_aceite: cpf, assinatura_base64: dataUrl, aceito_em: agora, status: "aceito" });
      // Aprova a cotação automaticamente (recalcula valores conforme modalidade)
      try {
        await supabase.functions.invoke("aprovar-cotacao-via-termo", {
          body: { token: termo.token },
        });
      } catch (e) {
        console.warn("Falha ao aprovar cotação automaticamente:", e);
      }
      setEtapa(4);
      // Gera o PDF do termo assinado em background
      void gerarPdfTermo({ ...termo, modalidade_escolhida: modalidade, nome_aceite: nome.trim(), cpf_aceite: cpf, assinatura_base64: dataUrl, aceito_em: agora });
    } catch (e) {
      alert("Erro ao salvar aceite. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }, [termo, modalidade, nome, cpf]);

  const gerarPdfTermo = useCallback(async (termoAtualizado?: Termo) => {
    const t = termoAtualizado || termo;
    if (!t) return;
    setGerandoPdf(true);
    try {
      // Busca nome da empresa
      const { data: emp } = await supabase
        .from("empresas")
        .select("nome")
        .eq("id", t.empresa_id)
        .maybeSingle();
      const empresaNome = (emp as any)?.nome || "Empresa";
      const url = await gerarESalvarTermoPDF(supabase, {
        id: t.id,
        cliente_nome: t.cliente_nome,
        cliente_telefone: t.cliente_telefone,
        cliente_endereco: t.cliente_endereco,
        cpf_aceite: t.cpf_aceite,
        nome_aceite: t.nome_aceite,
        tv_marca_modelo: t.tv_marca_modelo,
        tv_polegadas: t.tv_polegadas,
        tv_tipo: t.tv_tipo,
        tvs_itens: (t as any).tvs_itens ?? null,
        modalidade_escolhida: t.modalidade_escolhida,
        valor_completa: t.valor_completa,
        valor_colaborativa: t.valor_colaborativa,
        assinatura_base64: t.assinatura_base64,
        aceito_em: t.aceito_em,
        aceite_user_agent: t.aceite_user_agent,
      }, t.empresa_id, empresaNome);
      setPdfUrl(url);
    } catch (e) {
      console.warn("Falha ao gerar PDF:", e);
    } finally {
      setGerandoPdf(false);
    }
  }, [termo]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f6f5f0]"><div className="text-muted-foreground">Carregando...</div></div>;
  }
  if (erro || !termo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5f0] p-6">
        <Card className="max-w-md p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <h1 className="mb-2 text-lg font-semibold">{erro || "Termo não encontrado"}</h1>
          <p className="text-sm text-muted-foreground">Entre em contato com a empresa para receber um novo link.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f5f0] pb-12 print:bg-white">
      <style>{`
        input, textarea { font-size: 16px !important; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      {/* Header */}
      <header className="bg-white border-b print:hidden">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <h1 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Termo de Instalação de TV</h1>
          <p className="text-xs text-muted-foreground">Para: {termo.cliente_nome}</p>
        </div>
      </header>

      {/* Stepper */}
      {termo.status !== "aceito" && etapa < 4 && (
        <div className="mx-auto max-w-2xl px-4 pt-4 no-print">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex flex-1 items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${etapa >= n ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>{n}</div>
                {n < 3 && <div className={`h-1 flex-1 rounded ${etapa > n ? "bg-emerald-600" : "bg-muted"}`} />}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 text-center text-[10px] text-muted-foreground">
            <span>Modalidade</span><span>Termo</span><span>Assinatura</span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-2xl px-4 py-4">
        {/* ETAPA 1 — Modalidade */}
        {etapa === 1 && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Equipamento{tvsLista.length > 1 ? "s" : ""}</div>
              {tvsLista.map((t, i) => (
                <div key={i} className="font-medium">
                  {tvsLista.length > 1 && <span className="text-muted-foreground mr-1">TV {i + 1}:</span>}
                  {t.marca_modelo || "TV"} {t.polegadas ? `· ${t.polegadas}"` : ""} {t.tipo ? `· ${t.tipo}` : ""}
                </div>
              ))}
              {termo.cliente_endereco && <div className="mt-1 text-sm text-muted-foreground">{termo.cliente_endereco}</div>}
            </Card>

            <h2 className="text-base font-semibold">Escolha a modalidade</h2>

            {/* Completa */}
            <button
              type="button"
              onClick={() => setModalidade("completa")}
              className={`w-full rounded-2xl border-2 p-4 text-left transition ${modalidade === "completa" ? "border-[#1e5a9e] bg-[#e8f0fa]" : "border-border bg-white hover:border-[#1e5a9e]/40"}`}
            >
              <div className="flex items-baseline justify-between">
                <div className="text-lg font-semibold text-[#1e5a9e]">Completa</div>
                <div className="text-xl font-bold text-[#1e5a9e]">{formatarMoeda(termo.valor_completa)}</div>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-foreground/80">
                <li>✓ Técnico + ajudante fazem tudo</li>
                <li>✓ Quebrou? Empresa cobre o conserto ou troca por equivalente</li>
                <li>✓ Qualquer TV, sem restrição</li>
              </ul>
            </button>

            {/* Colaborativa */}
            <button
              type="button"
              disabled={colabInfo.indisponivel || termo.valor_colaborativa == null}
              onClick={() => setModalidade("colaborativa")}
              className={`w-full rounded-2xl border-2 p-4 text-left transition ${modalidade === "colaborativa" ? "border-[#0f6e56] bg-[#e1f5ee]" : "border-border bg-white hover:border-[#0f6e56]/40"} ${colabInfo.indisponivel || termo.valor_colaborativa == null ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <div className="flex items-baseline justify-between">
                <div className="text-lg font-semibold text-[#0f6e56]">Colaborativa</div>
                <div className="text-xl font-bold text-[#0f6e56]">{formatarMoeda(termo.valor_colaborativa)}</div>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-foreground/80">
                <li>✓ Você ajuda a encaixar a TV (~30 seg)</li>
                <li>✓ Quebrou? Empresa cobre 50% do conserto (até R$ 1.000)</li>
                <li>✓ Apenas TVs até 55", exceto OLED e The Frame</li>
              </ul>
              {colabInfo.indisponivel && (
                <div className="mt-2 rounded-md bg-amber-100 p-2 text-xs text-amber-900">
                  Não disponível: {colabInfo.motivo}
                </div>
              )}
            </button>

            <Button
              className="mt-4 h-12 w-full bg-emerald-600 text-base hover:bg-emerald-700"
              disabled={!modalidade}
              onClick={() => setEtapa(2)}
            >
              Continuar
            </Button>
          </div>
        )}

        {/* ETAPA 2 — Termo */}
        {etapa === 2 && (
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-base font-semibold"><FileText className="h-4 w-4" /> Leia o termo completo</h2>
            <div className="relative">
              <div
                ref={termoScrollRef}
                onScroll={handleScroll}
                className="h-[60vh] overflow-y-auto rounded-2xl border bg-white p-4 text-sm leading-relaxed"
              >
                {TERMO_SECOES.map((sec) => (
                  <section key={sec.titulo} className="mb-4">
                    <h3 className="mb-1 font-semibold">{sec.titulo}</h3>
                    {sec.paragrafos.map((p, i) => (
                      <p key={i} className="mb-2 text-foreground/80">{p}</p>
                    ))}
                  </section>
                ))}
                <p className="mt-4 rounded-md bg-muted p-3 text-xs italic">{TERMO_ACEITE_TEXTO}</p>
              </div>
              {!scrollFim && (
                <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 animate-bounce rounded-full bg-emerald-600 px-3 py-1 text-xs text-white shadow">
                  <ChevronDown className="inline h-3 w-3" /> Role para ler
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-12 flex-1" onClick={() => setEtapa(1)}>Voltar</Button>
              <Button
                className="h-12 flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={!scrollFim}
                onClick={() => setEtapa(3)}
              >
                {scrollFim ? "Continuar" : "Role até o fim"}
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 3 — Assinatura */}
        {etapa === 3 && (
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-base font-semibold"><PenLine className="h-4 w-4" /> Seus dados e assinatura</h2>

            <div className="space-y-2">
              <Label>CPF</Label>
              <Input inputMode="numeric" value={cpf} onChange={(e) => setCpf(formatarCPF(e.target.value))} placeholder="000.000.000-00" />
            </div>

            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
            </div>

            <div className="space-y-2">
              <Label>Assinatura</Label>
              <div className={`relative rounded-2xl border-2 ${assinou ? "border-emerald-500" : "border-dashed border-border"} bg-white`}>
                <canvas
                  ref={canvasRef}
                  onPointerDown={startDraw}
                  onPointerMove={moveDraw}
                  onPointerUp={endDraw}
                  onPointerCancel={endDraw}
                  className="h-48 w-full touch-none rounded-2xl"
                />
                {!assinou && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    Assine com o dedo aqui
                  </div>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={limparAssinatura}>Limpar</Button>
            </div>

            <label className="flex items-start gap-2 rounded-lg border bg-white p-3 text-sm">
              <Checkbox checked={aceitouTermo} onCheckedChange={(v) => setAceitouTermo(!!v)} className="mt-0.5" />
              <span>Declaro que li e entendi o termo, que me foram apresentadas as modalidades Completa e Colaborativa, e que escolhi livremente a opção marcada, ciente das condições de cada uma.</span>
            </label>

            <div className="flex gap-2">
              <Button variant="outline" className="h-12 flex-1" onClick={() => setEtapa(2)}>Voltar</Button>
              <Button
                className="h-12 flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={!podeAssinar || salvando}
                onClick={confirmarAceite}
              >
                {salvando ? "Salvando..." : "Aceitar e Assinar"}
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 4 — Confirmação */}
        {etapa === 4 && (
          <div className="space-y-4">
            <Card className="p-6 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-14 w-14 text-emerald-600" />
              <h2 className="text-xl font-semibold">Termo aceito!</h2>
              <p className="text-sm text-muted-foreground">Sua assinatura foi registrada com sucesso.</p>
            </Card>

            <Card className="space-y-2 p-4 text-sm">
              <div><span className="text-muted-foreground">ID:</span> {termo.id.slice(0, 8)}</div>
              <div><span className="text-muted-foreground">Data/Hora:</span> {termo.aceito_em ? new Date(termo.aceito_em).toLocaleString("pt-BR") : "—"}</div>
              <div><span className="text-muted-foreground">Nome:</span> {termo.nome_aceite}</div>
              <div><span className="text-muted-foreground">CPF:</span> {termo.cpf_aceite}</div>
              <div><span className="text-muted-foreground">Modalidade:</span> {termo.modalidade_escolhida === "completa" ? "Completa" : "Colaborativa"}</div>
              {termo.assinatura_base64 && (
                <div>
                  <div className="mb-1 text-muted-foreground">Assinatura:</div>
                  <img src={termo.assinatura_base64} alt="Assinatura" className="max-h-32 rounded border bg-white" />
                </div>
              )}
            </Card>

            <Button
              onClick={async () => {
                if (pdfUrl) {
                  window.open(pdfUrl, "_blank");
                } else {
                  await gerarPdfTermo();
                }
              }}
              disabled={gerandoPdf}
              className="h-12 w-full bg-emerald-600 text-base hover:bg-emerald-700 no-print"
            >
              {gerandoPdf ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando PDF...</>
              ) : pdfUrl ? (
                <><Download className="mr-2 h-4 w-4" /> Baixar PDF do Termo Assinado</>
              ) : (
                <><Download className="mr-2 h-4 w-4" /> Gerar PDF do Termo</>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground no-print">
              💚 Guarde este documento — ele é sua garantia.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
