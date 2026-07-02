// =====================================================================
// src/pages/instalador/OrcamentoNaHora.tsx
// Tela do instalador: gera um orçamento de adendo na casa do cliente.
// Nasce de dentro de um serviço atribuído (servicoId na rota).
//
// Fluxo:
//   1. Escolhe itens do catálogo (+ quantidade) e liga/desliga "fechar agora"
//   2. Gera -> cria a cotação (status "enviada") via RPC e mostra o CARD p/ print
//   3. Marca "Cliente aprovou" (vira serviço atribuído a ele) ou "Cliente recusou"
//
// Depende de: src/lib/orcamento.ts e das RPCs criadas no banco.
// Ajuste os caminhos de import se no seu projeto forem diferentes.
// =====================================================================

import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
  Copy,
  Loader2,
  Zap,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

import {
  CatalogoItem,
  ConfigOrcamento,
  ItemSelecionado,
  montarItem,
  calcularOrcamento,
  formatarBRL,
  paraItensExtras,
  montarMensagemOrcamento,
} from "@/lib/orcamento";

// Rótulos e ordem das seções do catálogo
const SECOES: { chave: CatalogoItem["categoria"]; titulo: string }[] = [
  { chave: "tv", titulo: "Instalação de TV" },
  { chave: "adicional", titulo: "Adicionais" },
  { chave: "outros", titulo: "Outros serviços" },
];

export default function OrcamentoNaHora() {
  const { servicoId } = useParams<{ servicoId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // id -> quantidade. Presença = item selecionado.
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [fecharAgora, setFecharAgora] = useState(false);

  // Depois de gerar: guardamos a cotação criada + o resultado congelado
  const [gerado, setGerado] = useState<{
    cotacaoId: string;
    itens: ItemSelecionado[];
    subtotal: number;
    fechar_agora: boolean;
    desconto_pct: number;
    desconto_valor: number;
    total: number;
  } | null>(null);
  const [resultadoFinal, setResultadoFinal] = useState<
    "aprovada" | "perdida" | null
  >(null);

  // -------------------------------------------------------------------
  // Dados
  // -------------------------------------------------------------------
  const { data: servico, isLoading: carregandoServico } = useQuery({
    queryKey: ["orcamento-servico", servicoId],
    enabled: !!servicoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos")
        .select(
          "id, cliente_id, clientes!servicos_cliente_id_fkey(nome, telefone)"
        )
        .eq("id", servicoId)
        .single();
      if (error) throw error;
      return data as {
        id: string;
        cliente_id: string;
        clientes: { nome: string; telefone: string } | null;
      };
    },
  });

  const { data: catalogo, isLoading: carregandoCatalogo } = useQuery({
    queryKey: ["catalogo-servicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogo_servicos")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as CatalogoItem[];
    },
  });

  const { data: config, isLoading: carregandoConfig } = useQuery({
    queryKey: ["config-orcamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_orcamento")
        .select("desconto_fechar_agora_pct, validade_dias, garantia_dias")
        .single();
      if (error) throw error;
      return data as ConfigOrcamento;
    },
  });

  // -------------------------------------------------------------------
  // Cálculo ao vivo
  // -------------------------------------------------------------------
  const itensSelecionados = useMemo<ItemSelecionado[]>(() => {
    if (!catalogo) return [];
    return catalogo
      .filter((c) => quantidades[c.id] != null)
      .map((c) => montarItem(c, quantidades[c.id] ?? 1));
  }, [catalogo, quantidades]);

  const resultado = useMemo(
    () =>
      config ? calcularOrcamento(itensSelecionados, config, fecharAgora) : null,
    [itensSelecionados, config, fecharAgora]
  );

  const nomeCliente = servico?.clientes?.nome ?? null;

  // -------------------------------------------------------------------
  // Ações
  // -------------------------------------------------------------------
  const gerar = useMutation({
    mutationFn: async () => {
      if (!servicoId || !resultado || !config) throw new Error("Dados incompletos.");
      if (resultado.itens.length === 0) throw new Error("Selecione ao menos um item.");

      const itensExtras = paraItensExtras(resultado);
      if (resultado.fechar_agora && resultado.desconto_valor > 0) {
        itensExtras.push({
          descricao: `Desconto fechando agora (-${resultado.desconto_pct}%)`,
          valor: -resultado.desconto_valor,
        });
      }

      const descricao = resultado.itens
        .map((i) => (i.quantidade > 1 ? `${i.nome} (x${i.quantidade})` : i.nome))
        .join("; ");
      const tipoServico = resultado.itens.map((i) => i.nome);

      const { data, error } = await supabase.rpc("criar_orcamento_na_hora", {
        p_servico_id: servicoId,
        p_itens: itensExtras,
        p_valor_total: resultado.total,
        p_descricao: descricao,
        p_tipo_servico: tipoServico,
      });
      if (error) throw error;
      return data as string; // cotacao_id
    },
    onSuccess: (cotacaoId) => {
      if (!resultado) return;
      setGerado({ cotacaoId, ...resultado });
      toast({ title: "Orçamento gerado", description: "Mostre o card ao cliente." });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Não foi possível gerar",
        description: e.message ?? "Tente de novo.",
      }),
  });

  const aprovar = useMutation({
    mutationFn: async () => {
      if (!gerado) throw new Error("Nenhum orçamento gerado.");
      const { error } = await supabase.rpc("aprovar_orcamento_na_hora", {
        p_cotacao_id: gerado.cotacaoId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setResultadoFinal("aprovada");
      toast({
        title: "Aprovado!",
        description: "O serviço foi criado e atribuído a você.",
      });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Erro ao aprovar",
        description: e.message ?? "Tente de novo.",
      }),
  });

  const recusar = useMutation({
    mutationFn: async () => {
      if (!gerado) throw new Error("Nenhum orçamento gerado.");
      const { error } = await supabase.rpc("recusar_orcamento_na_hora", {
        p_cotacao_id: gerado.cotacaoId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setResultadoFinal("perdida");
      toast({ title: "Registrado", description: "Marcado como não fechado." });
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Erro ao registrar",
        description: e.message ?? "Tente de novo.",
      }),
  });

  const copiarTexto = async () => {
    if (!gerado || !config) return;
    const texto = montarMensagemOrcamento(gerado, { nomeCliente, config });
    await navigator.clipboard.writeText(texto);
    toast({ title: "Texto copiado", description: "Cole no WhatsApp se preferir." });
  };

  // -------------------------------------------------------------------
  // Estados de carregamento
  // -------------------------------------------------------------------
  if (carregandoServico || carregandoCatalogo || carregandoConfig) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // -------------------------------------------------------------------
  // TELA DO CARD (depois de gerar)
  // -------------------------------------------------------------------
  if (gerado) {
    return (
      <div className="mx-auto max-w-md px-4 pb-28 pt-4">
        <button
          onClick={() => navigate(-1)}
          className="mb-3 flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        {/* CARD PRO PRINT — tudo dentro deste bloco */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="bg-primary px-5 py-4 text-primary-foreground">
            <p className="text-lg font-bold leading-tight">Chama o Ralph</p>
            <p className="text-xs opacity-90">Orçamento do seu serviço</p>
          </div>

          <div className="space-y-4 px-5 py-5">
            {nomeCliente && (
              <p className="text-sm">
                Olá, <span className="font-semibold">{nomeCliente}</span>! 😊
              </p>
            )}

            <div className="space-y-2">
              {gerado.itens.map((it) => (
                <div
                  key={it.catalogo_id}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="text-foreground">
                    {it.nome}
                    {it.quantidade > 1 && (
                      <span className="text-muted-foreground"> ×{it.quantidade}</span>
                    )}
                  </span>
                  <span className="whitespace-nowrap font-medium">
                    {formatarBRL(it.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-1">
              {gerado.fechar_agora && gerado.desconto_valor > 0 ? (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatarBRL(gerado.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Fechando agora (-{gerado.desconto_pct}%)</span>
                    <span>-{formatarBRL(gerado.desconto_valor)}</span>
                  </div>
                  <div className="flex justify-between pt-1 text-base font-bold">
                    <span>Total</span>
                    <span>{formatarBRL(gerado.total)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatarBRL(gerado.total)}</span>
                </div>
              )}
            </div>

            <div className="space-y-1 rounded-lg bg-muted/50 px-3 py-3 text-xs text-muted-foreground">
              <p>✅ Garantia de {config!.garantia_dias} dias</p>
              <p>📅 Válido por {config!.validade_dias} dias</p>
              <p>⭐ +5.000 instalações em SP · 5 estrelas no Google</p>
            </div>
          </div>
        </div>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          Tire um print deste card e envie no WhatsApp do cliente.
        </p>

        <Button variant="outline" className="mt-3 w-full" onClick={copiarTexto}>
          <Copy className="mr-2 h-4 w-4" /> Copiar como texto
        </Button>

        {/* Resultado */}
        {resultadoFinal ? (
          <div className="mt-6 rounded-xl border bg-muted/40 p-4 text-center text-sm">
            {resultadoFinal === "aprovada"
              ? "Cliente aprovou. O serviço já está na sua agenda para finalizar."
              : "Registrado como não fechado."}
            <Button className="mt-3 w-full" onClick={() => navigate(-1)}>
              Concluir
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            <p className="text-center text-sm font-medium">O cliente aprovou?</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                disabled={recusar.isPending || aprovar.isPending}
                onClick={() => recusar.mutate()}
              >
                <ThumbsDown className="mr-2 h-4 w-4" /> Não fechou
              </Button>
              <Button
                disabled={aprovar.isPending || recusar.isPending}
                onClick={() => aprovar.mutate()}
              >
                {aprovar.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsUp className="mr-2 h-4 w-4" />
                )}
                Cliente aprovou
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------
  // TELA DE MONTAGEM (selecionar itens)
  // -------------------------------------------------------------------
  const toggleItem = (item: CatalogoItem) =>
    setQuantidades((q) => {
      const next = { ...q };
      if (next[item.id] != null) delete next[item.id];
      else next[item.id] = 1;
      return next;
    });

  const ajustarQtd = (item: CatalogoItem, delta: number) =>
    setQuantidades((q) => {
      const atual = q[item.id] ?? 0;
      const novo = atual + delta;
      const next = { ...q };
      if (novo <= 0) delete next[item.id];
      else next[item.id] = novo;
      return next;
    });

  return (
    <div className="mx-auto max-w-md px-4 pb-32 pt-4">
      <button
        onClick={() => navigate(-1)}
        className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <h1 className="text-xl font-bold">Orçamento na hora</h1>
      {nomeCliente && (
        <p className="text-sm text-muted-foreground">Cliente: {nomeCliente}</p>
      )}

      {/* Fechar agora */}
      {config && (
        <Card className="mt-4 border-primary/30">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Fechar agora</p>
                <p className="text-xs text-muted-foreground">
                  Aplica {config.desconto_fechar_agora_pct}% de desconto
                </p>
              </div>
            </div>
            <Switch checked={fecharAgora} onCheckedChange={setFecharAgora} />
          </CardContent>
        </Card>
      )}

      {/* Catálogo por seção */}
      <div className="mt-4 space-y-5">
        {SECOES.map(({ chave, titulo }) => {
          const itens = (catalogo ?? []).filter((c) => c.categoria === chave);
          if (itens.length === 0) return null;
          return (
            <section key={chave}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {titulo}
              </h2>
              <div className="space-y-2">
                {itens.map((item) => {
                  const qtd = quantidades[item.id];
                  const selecionado = qtd != null;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 transition-colors ${
                        selecionado ? "border-primary bg-primary/5" : "bg-card"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          item.por_quantidade
                            ? ajustarQtd(item, selecionado ? 0 : 1)
                            : toggleItem(item)
                        }
                        className="flex-1 text-left"
                      >
                        <p className="text-sm font-medium leading-tight">
                          {item.nome}
                        </p>
                        {item.descricao && (
                          <p className="text-xs text-muted-foreground">
                            {item.descricao}
                          </p>
                        )}
                        <p className="mt-0.5 text-sm font-semibold">
                          {formatarBRL(item.preco)}
                          {item.por_quantidade && (
                            <span className="text-xs font-normal text-muted-foreground">
                              {" "}
                              / un
                            </span>
                          )}
                        </p>
                      </button>

                      {item.por_quantidade ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => ajustarQtd(item, -1)}
                            disabled={!selecionado}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-5 text-center text-sm font-medium">
                            {qtd ?? 0}
                          </span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => ajustarQtd(item, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                            selecionado
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {selecionado && <Check className="h-4 w-4" />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Rodapé fixo com total + gerar */}
      {resultado && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {resultado.itens.length}{" "}
                {resultado.itens.length === 1 ? "item" : "itens"}
                {resultado.fechar_agora && resultado.desconto_valor > 0 && (
                  <span className="text-emerald-600">
                    {" "}
                    · -{formatarBRL(resultado.desconto_valor)}
                  </span>
                )}
              </p>
              <p className="text-lg font-bold">{formatarBRL(resultado.total)}</p>
            </div>
            <Button
              size="lg"
              disabled={resultado.itens.length === 0 || gerar.isPending}
              onClick={() => gerar.mutate()}
            >
              {gerar.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Gerar orçamento
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
