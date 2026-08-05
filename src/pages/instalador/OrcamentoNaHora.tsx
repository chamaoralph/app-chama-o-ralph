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
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
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
  montarMensagemOrcamento,
  clampPct,
  resumirRepasseAcessorios,
  calcularRepasseAcessorio,
  AcessorioSelecionado,
  Fornecedor,
  ehAcessorio,
} from "@/lib/orcamento";

// Rótulos e ordem das seções do catálogo
const SECOES: { chave: CatalogoItem["categoria"]; titulo: string }[] = [
  { chave: "tv", titulo: "Instalação de TV" },
  { chave: "adicional", titulo: "Adicionais" },
  { chave: "outros", titulo: "Outros serviços" },
  { chave: "acessorios", titulo: "Acessórios" },
];

export default function OrcamentoNaHora() {
  const { servicoId } = useParams<{ servicoId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // id -> quantidade. Presença = item selecionado.
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [fecharAgora, setFecharAgora] = useState(false);
  const [descontoPct, setDescontoPct] = useState<number | null>(null);
  const [fornecedores, setFornecedores] = useState<
    Record<string, "empresa" | "instalador">
  >({});
  // Custo digitado pelo instalador quando ele forneceu o acessório (catalogo_id -> string do input)
  const [custosInstalador, setCustosInstalador] = useState<Record<string, string>>({});

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

  // Saldo de estoque de todos os acessórios (carregado de uma vez só)
  const { data: saldosEstoque } = useQuery({
    queryKey: ["estoque-saldo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_saldo")
        .select("catalogo_id, saldo");
      if (error) throw error;
      return (data || []) as { catalogo_id: string; saldo: number }[];
    },
  });

  const saldoPorId = useMemo(() => {
    const mapa: Record<string, number> = {};
    (saldosEstoque ?? []).forEach((s) => {
      mapa[s.catalogo_id] = s.saldo;
    });
    return mapa;
  }, [saldosEstoque]);

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
      config
        ? calcularOrcamento(
            itensSelecionados,
            config,
            fecharAgora,
            descontoPct ?? undefined
          )
        : null,
    [itensSelecionados, config, fecharAgora, descontoPct]
  );

  // catalogo_id dos acessórios selecionados com fornecedor "empresa" — só esses
  // precisam do custo FIFO do estoque (custo_atual_acessorio via RPC)
  const acessoriosEmpresaIds = useMemo(() => {
    if (!catalogo) return [];
    return catalogo
      .filter(
        (c) =>
          quantidades[c.id] != null &&
          ehAcessorio(c.categoria) &&
          fornecedores[c.id] === "empresa"
      )
      .map((c) => c.id);
  }, [catalogo, quantidades, fornecedores]);

  const custoEstoqueQueries = useQueries({
    queries: acessoriosEmpresaIds.map((catalogoId) => ({
      queryKey: ["custo-atual-acessorio", catalogoId],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("custo_atual_acessorio", {
          p_catalogo_id: catalogoId,
        });
        if (error) throw error;
        return data as number | null;
      },
    })),
  });

  // catalogo_id -> { valor: custo FIFO (null se sem estoque/ainda não veio), carregando }
  const custoEstoquePorId = useMemo(() => {
    const mapa: Record<string, { valor: number | null; carregando: boolean }> = {};
    acessoriosEmpresaIds.forEach((catalogoId, idx) => {
      const q = custoEstoqueQueries[idx];
      mapa[catalogoId] = { valor: q?.data ?? null, carregando: q?.isLoading ?? false };
    });
    return mapa;
  }, [acessoriosEmpresaIds, custoEstoqueQueries]);

  const acessoriosSelecionados = useMemo<AcessorioSelecionado[]>(() => {
    if (!catalogo) return [];
    return catalogo
      .filter((c) => quantidades[c.id] != null && ehAcessorio(c.categoria))
      .map((c) => {
        const fornecedor = fornecedores[c.id] as Fornecedor;
        const custo =
          fornecedor === "instalador"
            ? parseFloat(custosInstalador[c.id] || "0") || 0
            : custoEstoquePorId[c.id]?.valor ?? 0;
        return {
          ...montarItem(c, quantidades[c.id] ?? 1),
          custo,
          fornecedor,
        };
      });
  }, [catalogo, quantidades, fornecedores, custosInstalador, custoEstoquePorId]);

  // Acessório "empresa" sem estoque, ou "empresa"/"instalador" sem custo definido — bloqueia gerar
  const acessorioComProblema = acessoriosSelecionados.some((a) => {
    if (!a.fornecedor) return true;
    if (a.fornecedor === "empresa") {
      return (
        (saldoPorId[a.catalogo_id] ?? 0) <= 0 ||
        custoEstoquePorId[a.catalogo_id]?.valor == null
      );
    }
    if (a.fornecedor === "instalador") {
      return !custosInstalador[a.catalogo_id]?.trim();
    }
    return false;
  });

  const repasse = useMemo(
    () =>
      resumirRepasseAcessorios(
        acessoriosSelecionados.filter((a) => a.fornecedor)
      ),
    [acessoriosSelecionados]
  );

  const faltaFornecedor = acessoriosSelecionados.some((a) => !a.fornecedor);

  const nomeCliente = servico?.clientes?.nome ?? null;
  const temAcessorio = gerado?.itens?.some((i) => ehAcessorio(i.categoria));

  // -------------------------------------------------------------------
  // Ações
  // -------------------------------------------------------------------
  const gerar = useMutation({
    mutationFn: async () => {
      if (!servicoId || !resultado || !config) throw new Error("Dados incompletos.");
      if (resultado.itens.length === 0) throw new Error("Selecione ao menos um item.");
      if (acessorioComProblema) {
        throw new Error(
          "Resolva o estoque/custo dos acessórios antes de gerar o orçamento."
        );
      }

      const itensExtras = resultado.itens.map((item) => {
        const descricao =
          item.quantidade > 1 ? `${item.nome} (x${item.quantidade})` : item.nome;

        if (!ehAcessorio(item.categoria)) {
          return { descricao, valor: item.subtotal };
        }

        const fornecedor = fornecedores[item.catalogo_id] as Fornecedor;
        const custoUnitario =
          fornecedor === "instalador"
            ? parseFloat(custosInstalador[item.catalogo_id] || "0") || 0
            : custoEstoquePorId[item.catalogo_id]?.valor ?? 0;
        const repasseCalc = calcularRepasseAcessorio(
          item.subtotal,
          custoUnitario * item.quantidade,
          fornecedor
        );

        return {
          descricao,
          valor: item.subtotal,
          eh_acessorio: true,
          catalogo_id: item.catalogo_id,
          quantidade: item.quantidade,
          custo_unitario: custoUnitario,
          fornecedor,
          repasse_instalador: repasseCalc.repasse_instalador,
          repasse_empresa: repasseCalc.repasse_empresa,
        };
      });
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
        description: "Adicionado ao seu serviço em andamento.",
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
              {temAcessorio && (
                <p className="text-[10px] text-muted-foreground/70">
                  Válido enquanto durar os estoques, sujeito a
                  indisponibilidade ou alteração de preço.
                </p>
              )}
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
  const removerFornecedor = (itemId: string) => {
    setFornecedores((f) => {
      if (f[itemId] == null) return f;
      const next = { ...f };
      delete next[itemId];
      return next;
    });
    setCustosInstalador((c) => {
      if (c[itemId] == null) return c;
      const next = { ...c };
      delete next[itemId];
      return next;
    });
  };

  const toggleItem = (item: CatalogoItem) =>
    setQuantidades((q) => {
      const next = { ...q };
      if (next[item.id] != null) {
        delete next[item.id];
        removerFornecedor(item.id);
      } else next[item.id] = 1;
      return next;
    });

  const ajustarQtd = (item: CatalogoItem, delta: number) =>
    setQuantidades((q) => {
      const atual = q[item.id] ?? 0;
      const novo = atual + delta;
      const next = { ...q };
      if (novo <= 0) {
        delete next[item.id];
        removerFornecedor(item.id);
      } else next[item.id] = novo;
      return next;
    });

  const escolherFornecedor = (itemId: string, fornecedor: "empresa" | "instalador") =>
    setFornecedores((f) => ({ ...f, [itemId]: fornecedor }));

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
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-3">
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
            </div>

            {fecharAgora && (
              <div className="mt-3 flex items-center justify-end gap-2">
                <label
                  htmlFor="desconto-pct"
                  className="text-xs text-muted-foreground"
                >
                  Desconto (%)
                </label>
                <div className="relative">
                  <input
                    id="desconto-pct"
                    type="number"
                    inputMode="decimal"
                    className="h-8 w-20 rounded-md border bg-background px-2 pr-5 text-right text-sm"
                    value={descontoPct ?? config.desconto_fechar_agora_pct}
                    onChange={(e) =>
                      setDescontoPct(clampPct(Number(e.target.value)))
                    }
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
            )}
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
                  const acessorio = ehAcessorio(item.categoria);
                  const fornecedorEscolhido = fornecedores[item.id];
                  const semEstoque = (saldoPorId[item.id] ?? 0) <= 0;
                  const custoEmpresaInfo = custoEstoquePorId[item.id];
                  return (
                    <div key={item.id}>
                    <div
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

                    {acessorio && selecionado && (
                      <div className="mt-1.5 space-y-1.5 px-1">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              fornecedorEscolhido === "empresa"
                                ? "default"
                                : "outline"
                            }
                            className="h-7 px-3 text-xs"
                            disabled={semEstoque}
                            onClick={() => escolherFornecedor(item.id, "empresa")}
                          >
                            Empresa
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              fornecedorEscolhido === "instalador"
                                ? "default"
                                : "outline"
                            }
                            className="h-7 px-3 text-xs"
                            onClick={() =>
                              escolherFornecedor(item.id, "instalador")
                            }
                          >
                            Eu
                          </Button>
                          {!fornecedorEscolhido && (
                            <span className="text-xs text-amber-600">
                              Escolha quem forneceu
                            </span>
                          )}
                        </div>

                        {semEstoque && (
                          <p className="text-xs text-amber-600">
                            Sem estoque — venda apenas se o instalador fornecer
                          </p>
                        )}

                        {fornecedorEscolhido === "empresa" && !semEstoque && (
                          <p className="text-xs text-muted-foreground">
                            {custoEmpresaInfo?.carregando
                              ? "Buscando custo…"
                              : custoEmpresaInfo?.valor != null
                              ? `custo ${formatarBRL(custoEmpresaInfo.valor)} — do estoque`
                              : "Custo indisponível — tente novamente"}
                          </p>
                        )}

                        {fornecedorEscolhido === "instalador" && (
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor={`custo-instalador-${item.id}`}
                              className="text-xs text-muted-foreground"
                            >
                              Custo que você pagou (R$)
                            </label>
                            <input
                              id={`custo-instalador-${item.id}`}
                              type="number"
                              step="0.01"
                              min="0"
                              inputMode="decimal"
                              className="h-7 w-24 rounded-md border bg-background px-2 text-right text-sm"
                              value={custosInstalador[item.id] ?? ""}
                              onChange={(e) =>
                                setCustosInstalador((c) => ({
                                  ...c,
                                  [item.id]: e.target.value,
                                }))
                              }
                              placeholder="0,00"
                            />
                          </div>
                        )}
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
          <div className="mx-auto max-w-md">
            {acessoriosSelecionados.some((a) => a.fornecedor) && (
              <p className="mb-2 text-center text-xs text-muted-foreground">
                Repasse — Instalador:{" "}
                <span className="font-medium">
                  {formatarBRL(repasse.total_instalador)}
                </span>{" "}
                · Empresa:{" "}
                <span className="font-medium">
                  {formatarBRL(repasse.total_empresa)}
                </span>
              </p>
            )}
            {faltaFornecedor ? (
              <p className="mb-2 text-center text-xs text-amber-600">
                Escolha quem forneceu cada acessório
              </p>
            ) : (
              acessorioComProblema && (
                <p className="mb-2 text-center text-xs text-amber-600">
                  Resolva o estoque/custo dos acessórios antes de gerar
                </p>
              )
            )}
            <div className="flex items-center justify-between gap-3">
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
                <p className="text-lg font-bold">
                  {formatarBRL(resultado.total)}
                </p>
              </div>
              <Button
                size="lg"
                disabled={
                  resultado.itens.length === 0 ||
                  gerar.isPending ||
                  acessorioComProblema
                }
                onClick={() => gerar.mutate()}
              >
                {gerar.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Gerar orçamento
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
