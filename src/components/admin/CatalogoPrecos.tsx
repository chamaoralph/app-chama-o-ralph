// =====================================================================
// src/components/admin/CatalogoPrecos.tsx
// Seção de configurações do admin: gerencia o catálogo de serviços
// (preços do "Orçamento na Hora") e o % de desconto padrão.
//
// Independente: é só importar dentro da sua tela /admin/configuracoes.
// Usa as tabelas catalogo_servicos e config_orcamento (RLS: só admin edita).
// Padrão do projeto: Supabase inline + React Query + shadcn/ui.
// Ajuste os caminhos de import se no seu projeto forem diferentes.
// =====================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Percent,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { CatalogoItem, ConfigOrcamento, formatarBRL, clampPct } from "@/lib/orcamento";

const CATEGORIAS: { valor: CatalogoItem["categoria"]; rotulo: string }[] = [
  { valor: "tv", rotulo: "Instalação de TV" },
  { valor: "adicional", rotulo: "Adicionais" },
  { valor: "outros", rotulo: "Outros serviços" },
  { valor: "acessorios", rotulo: "Acessórios" },
];

// Estado do formulário inline (novo ou edição)
type FormItem = {
  nome: string;
  descricao: string;
  categoria: CatalogoItem["categoria"];
  preco: string; // string no input, converte na hora de salvar
  por_quantidade: boolean;
  ativo: boolean;
};

const FORM_VAZIO: FormItem = {
  nome: "",
  descricao: "",
  categoria: "tv",
  preco: "",
  por_quantidade: false,
  ativo: true,
};

export default function CatalogoPrecos() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // "novo" = criando; um id = editando aquele item; null = nada aberto
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [form, setForm] = useState<FormItem>(FORM_VAZIO);
  const [descontoInput, setDescontoInput] = useState<string>("");

  // -------------------------------------------------------------------
  // Dados
  // -------------------------------------------------------------------
  const { data: catalogo, isLoading: carregandoCatalogo } = useQuery({
    queryKey: ["admin-catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogo_servicos")
        .select("*")
        .order("categoria", { ascending: true })
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as CatalogoItem[];
    },
  });

  const { data: config } = useQuery({
    queryKey: ["admin-config-orcamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_orcamento")
        .select("id, empresa_id, desconto_fechar_agora_pct, validade_dias, garantia_dias")
        .single();
      if (error) throw error;
      return data as ConfigOrcamento & { id: string; empresa_id: string };
    },
  });

  // id do item em edição (null se criando um novo ou se nada estiver aberto)
  const editandoId = editando && editando !== "novo" ? editando : null;

  // Custo atual do acessório, direto do lote FIFO com saldo (só informativo)
  const { data: custoEstoque, isLoading: carregandoCustoEstoque } = useQuery({
    queryKey: ["custo-atual-acessorio", editandoId],
    enabled: !!editandoId && form.categoria === "acessorios",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("custo_atual_acessorio", {
        p_catalogo_id: editandoId,
      });
      if (error) throw error;
      return data as number | null;
    },
  });

  // -------------------------------------------------------------------
  // Salvar % de desconto
  // -------------------------------------------------------------------
  const salvarDesconto = useMutation({
    mutationFn: async (novoPct: number) => {
      if (!config) throw new Error("Config não carregada.");
      const { error } = await supabase
        .from("config_orcamento")
        .update({ desconto_fechar_agora_pct: clampPct(novoPct) })
        .eq("id", (config as any).id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-config-orcamento"] });
      qc.invalidateQueries({ queryKey: ["config-orcamento"] });
      setDescontoInput("");
      toast({ title: "Desconto atualizado" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  // -------------------------------------------------------------------
  // Salvar item (novo ou edição)
  // -------------------------------------------------------------------
  const salvarItem = useMutation({
    mutationFn: async () => {
      const preco = Number(form.preco.replace(",", "."));
      if (!form.nome.trim()) throw new Error("Informe o nome do item.");
      if (Number.isNaN(preco) || preco < 0) throw new Error("Preço inválido.");

      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        categoria: form.categoria,
        preco,
        por_quantidade: form.por_quantidade,
        ativo: form.ativo,
      };

      if (editando === "novo") {
        // empresa_id é preenchido pela RLS/def? Não — precisa ir explícito.
        // Pegamos a empresa do próprio config (mesma empresa do admin logado).
        const empresa_id = (config as any)?.empresa_id;
        const { error } = await supabase
          .from("catalogo_servicos")
          .insert({ ...payload, empresa_id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("catalogo_servicos")
          .update(payload)
          .eq("id", editando as string);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-catalogo"] });
      qc.invalidateQueries({ queryKey: ["catalogo-servicos"] });
      setEditando(null);
      setForm(FORM_VAZIO);
      toast({ title: "Item salvo" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message }),
  });

  // -------------------------------------------------------------------
  // Ativar/desativar (toggle rápido) e excluir
  // -------------------------------------------------------------------
  const alternarAtivo = useMutation({
    mutationFn: async (item: CatalogoItem) => {
      const { error } = await supabase
        .from("catalogo_servicos")
        .update({ ativo: !item.ativo })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-catalogo"] });
      qc.invalidateQueries({ queryKey: ["catalogo-servicos"] });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  const excluirItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("catalogo_servicos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-catalogo"] });
      qc.invalidateQueries({ queryKey: ["catalogo-servicos"] });
      toast({ title: "Item excluído" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Erro ao excluir", description: e.message }),
  });

  // -------------------------------------------------------------------
  // Helpers de UI
  // -------------------------------------------------------------------
  const abrirNovo = () => {
    setForm(FORM_VAZIO);
    setEditando("novo");
  };

  const abrirEdicao = (item: CatalogoItem) => {
    setForm({
      nome: item.nome,
      descricao: item.descricao ?? "",
      categoria: item.categoria,
      preco: String(item.preco),
      por_quantidade: item.por_quantidade,
      ativo: item.ativo,
    });
    setEditando(item.id);
  };

  const cancelar = () => {
    setEditando(null);
    setForm(FORM_VAZIO);
  };

  // Formulário inline reutilizável (novo e edição)
  const Formulario = () => (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder='Ex: TV 40" a 55" — Proteção Total'
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Preço (R$)</Label>
          <Input
            inputMode="decimal"
            value={form.preco}
            onChange={(e) => setForm({ ...form, preco: e.target.value })}
            placeholder="239"
          />
        </div>
      </div>

      {form.categoria === "acessorios" && editandoId && (
        <div className="space-y-1">
          <Label className="text-xs">Custo (do estoque)</Label>
          <Input
            disabled
            value={
              carregandoCustoEstoque
                ? "Carregando…"
                : custoEstoque != null
                ? `${formatarBRL(custoEstoque)} (do estoque)`
                : "Sem estoque"
            }
          />
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Descrição (opcional)</Label>
        <Input
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          placeholder="Equipe faz tudo, cobertura total"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Categoria</Label>
          <Select
            value={form.categoria}
            onValueChange={(v) =>
              setForm({ ...form, categoria: v as CatalogoItem["categoria"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.valor} value={c.valor}>
                  {c.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-4 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={form.por_quantidade}
              onCheckedChange={(v) => setForm({ ...form, por_quantidade: v })}
            />
            Por unidade
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={form.ativo}
              onCheckedChange={(v) => setForm({ ...form, ativo: v })}
            />
            Ativo
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={cancelar}>
          <X className="mr-1 h-4 w-4" /> Cancelar
        </Button>
        <Button
          size="sm"
          onClick={() => salvarItem.mutate()}
          disabled={salvarItem.isPending}
        >
          {salvarItem.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-1 h-4 w-4" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Desconto padrão */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Desconto "Fechar agora"</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            É o desconto sugerido ao instalador no orçamento na hora. Ele pode
            digitar outro valor na hora, mas este é o padrão.
          </p>
          <div className="flex items-center gap-2">
            <Input
              inputMode="decimal"
              className="w-24"
              placeholder={
                config ? String(config.desconto_fechar_agora_pct) : "10"
              }
              value={descontoInput}
              onChange={(e) => setDescontoInput(e.target.value)}
            />
            <span className="text-sm text-muted-foreground">%</span>
            <Button
              size="sm"
              disabled={descontoInput === "" || salvarDesconto.isPending}
              onClick={() =>
                salvarDesconto.mutate(Number(descontoInput.replace(",", ".")))
              }
            >
              {salvarDesconto.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Salvar
            </Button>
            {config && (
              <span className="text-xs text-muted-foreground">
                Atual: {config.desconto_fechar_agora_pct}%
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Catálogo */}
      <Card>
        <CardContent className="py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tabela de preços</h3>
            <Button size="sm" onClick={abrirNovo} disabled={editando === "novo"}>
              <Plus className="mr-1 h-4 w-4" /> Novo item
            </Button>
          </div>

          {editando === "novo" && (
            <div className="mb-4">
              <Formulario />
            </div>
          )}

          {carregandoCatalogo ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              {CATEGORIAS.map(({ valor, rotulo }) => {
                const itens = (catalogo ?? []).filter(
                  (c) => c.categoria === valor
                );
                if (itens.length === 0) return null;
                return (
                  <div key={valor}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {rotulo}
                    </p>
                    <div className="space-y-2">
                      {itens.map((item) => (
                        <div key={item.id}>
                          <div
                            className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                              item.ativo ? "" : "opacity-60"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {item.nome}
                                {item.por_quantidade && (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    (un)
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatarBRL(item.preco)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Switch
                                checked={item.ativo}
                                onCheckedChange={() => alternarAtivo.mutate(item)}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => abrirEdicao(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Excluir "${item.nome}"? Essa ação não pode ser desfeita.`
                                    )
                                  )
                                    excluirItem.mutate(item.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {editando === item.id && (
                            <div className="mt-2">
                              <Formulario />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
