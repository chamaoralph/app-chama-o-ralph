// =====================================================================
// src/components/admin/EstoqueAcessorios.tsx
// Seção de Configurações do admin: gestão do estoque de acessórios.
//  - Lançar nova compra (lote): item, quantidade, custo, fornecedor, data
//  - Ver saldo atual de cada acessório
//  - Ver histórico de movimentos (baixas e devoluções)
//
// Independente: importe dentro de /admin/configuracoes.
// Usa: catalogo_servicos (acessórios), estoque_lotes, estoque_saldo,
//      estoque_movimentos. RLS: só admin escreve/lê (já configurado).
// Ajuste os caminhos de import se no seu projeto forem diferentes.
// =====================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PackagePlus, Loader2, Boxes, History } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { CatalogoItem, formatarBRL } from "@/lib/orcamento";

type FormCompra = {
  catalogo_id: string;
  quantidade: string;
  custo_unitario: string;
  fornecedor: string;
  data_compra: string; // yyyy-mm-dd
};

const hoje = () => new Date().toISOString().slice(0, 10);

const FORM_VAZIO: FormCompra = {
  catalogo_id: "",
  quantidade: "",
  custo_unitario: "",
  fornecedor: "",
  data_compra: hoje(),
};

export default function EstoqueAcessorios() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormCompra>(FORM_VAZIO);

  // acessórios do catálogo (para o dropdown e para nomear itens no saldo/histórico)
  const { data: acessorios } = useQuery({
    queryKey: ["acessorios-catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogo_servicos")
        .select("id, nome")
        .eq("categoria", "acessorios")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Pick<CatalogoItem, "id" | "nome">[];
    },
  });

  // saldo atual
  const { data: saldos, isLoading: carregandoSaldo } = useQuery({
    queryKey: ["estoque-saldos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_saldo")
        .select("catalogo_id, saldo");
      if (error) throw error;
      return data as { catalogo_id: string; saldo: number }[];
    },
  });

  // histórico de movimentos (últimos 50)
  const { data: movimentos } = useQuery({
    queryKey: ["estoque-movimentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_movimentos")
        .select("id, catalogo_id, tipo, quantidade, custo_total, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as {
        id: string;
        catalogo_id: string;
        tipo: "baixa" | "devolucao";
        quantidade: number;
        custo_total: number;
        created_at: string;
      }[];
    },
  });

  const nomeDe = (id: string) =>
    acessorios?.find((a) => a.id === id)?.nome ?? "—";
  const saldoDe = (id: string) =>
    saldos?.find((s) => s.catalogo_id === id)?.saldo ?? 0;

  // lançar compra (cria o lote)
  const lancar = useMutation({
    mutationFn: async () => {
      const quantidade = parseInt(form.quantidade, 10);
      const custo = Number(form.custo_unitario.replace(",", "."));
      if (!form.catalogo_id) throw new Error("Escolha o acessório.");
      if (!Number.isInteger(quantidade) || quantidade <= 0)
        throw new Error("Quantidade inválida.");
      if (Number.isNaN(custo) || custo < 0) throw new Error("Custo inválido.");

      // empresa do acessório (mantém multi-tenant correto)
      const { data: cat, error: e1 } = await supabase
        .from("catalogo_servicos")
        .select("empresa_id")
        .eq("id", form.catalogo_id)
        .single();
      if (e1) throw e1;

      const { error } = await supabase.from("estoque_lotes").insert({
        empresa_id: (cat as any).empresa_id,
        catalogo_id: form.catalogo_id,
        quantidade,
        qtd_restante: quantidade,
        custo_unitario: custo,
        fornecedor: form.fornecedor.trim() || null,
        data_compra: form.data_compra || hoje(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque-saldos"] });
      qc.invalidateQueries({ queryKey: ["estoque-movimentos"] });
      setForm({ ...FORM_VAZIO, data_compra: hoje() });
      toast({ title: "Compra lançada", description: "Estoque atualizado." });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  return (
    <div className="space-y-6">
      {/* Nova compra */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center gap-2">
            <PackagePlus className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Lançar compra</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Acessório</Label>
              <Select
                value={form.catalogo_id}
                onValueChange={(v) => setForm({ ...form, catalogo_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o acessório" />
                </SelectTrigger>
                <SelectContent>
                  {(acessorios ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Quantidade</Label>
              <Input
                inputMode="numeric"
                value={form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                placeholder="50"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Custo unitário (R$)</Label>
              <Input
                inputMode="decimal"
                value={form.custo_unitario}
                onChange={(e) =>
                  setForm({ ...form, custo_unitario: e.target.value })
                }
                placeholder="5,00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fornecedor / Loja</Label>
              <Input
                value={form.fornecedor}
                onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                placeholder="Ex: Loja do Zé"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data da compra</Label>
              <Input
                type="date"
                value={form.data_compra}
                onChange={(e) =>
                  setForm({ ...form, data_compra: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => lancar.mutate()} disabled={lancar.isPending}>
              {lancar.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Lançar compra
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Saldo atual */}
      <Card>
        <CardContent className="py-4">
          <div className="mb-3 flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Saldo atual</h3>
          </div>
          {carregandoSaldo ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (acessorios ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum acessório cadastrado.
            </p>
          ) : (
            <div className="space-y-1">
              {(acessorios ?? []).map((a) => {
                const saldo = saldoDe(a.id);
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between border-b py-1.5 text-sm last:border-0"
                  >
                    <span className="truncate">{a.nome}</span>
                    <span
                      className={`font-medium ${
                        saldo === 0 ? "text-destructive" : ""
                      }`}
                    >
                      {saldo} un
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardContent className="py-4">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Histórico de movimentos</h3>
          </div>
          {(movimentos ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma movimentação ainda.
            </p>
          ) : (
            <div className="space-y-1">
              {(movimentos ?? []).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between border-b py-1.5 text-sm last:border-0"
                >
                  <div className="min-w-0">
                    <span className="truncate">{nomeDe(m.catalogo_id)}</span>
                    <span
                      className={`ml-2 text-xs ${
                        m.tipo === "baixa"
                          ? "text-destructive"
                          : "text-emerald-600"
                      }`}
                    >
                      {m.tipo === "baixa" ? "saída" : "devolução"}
                    </span>
                  </div>
                  <div className="whitespace-nowrap text-right">
                    <span className="font-medium">
                      {m.tipo === "baixa" ? "-" : "+"}
                      {m.quantidade} un
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatarBRL(m.custo_total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
