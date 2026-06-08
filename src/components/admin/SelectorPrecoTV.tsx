import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TAMANHOS_TV,
  TIPOS_PAREDE,
  COBERTURAS,
  buscarPrecoTV,
  type PrecoTV,
} from "@/lib/precosTV";

// ============================================================
// TIPOS PÚBLICOS
// ============================================================
export interface TVItem {
  tamanho: string;
  parede: string;
  cobertura: string;
  // snapshot de preços calculados
  valor_mao_obra: number;
  valor_material: number;
  origem_suporte: "" | "empresa" | "instalador";
  custo_suporte: number;
  // tipo de suporte da tabela (para o modal do termo)
  tipo_suporte?: string;
  valor_suporte?: number;
  // dados informados no EnviarTermoModal
  marca_modelo?: string;
  polegadas?: string;
  tipo?: string; // LED/QLED/OLED/The Frame/Outro
}

export interface TotaisTV {
  totalMaoObra: number;
  totalMaterial: number;
  totalCustoSuporte: number;
  origemSuporte: "" | "empresa" | "instalador";
}

// Compatibilidade com callsites antigos
export interface SelectorTVValues {
  tamanho_tv: string;
  tipo_parede: string;
  cobertura: string;
}
export interface PrecoTVResult {
  valorMaoObra: number;
  valorMaterial: number;
  origemSuporte: "" | "empresa" | "instalador";
  custoSuporte: number;
}

export function novoItemTV(): TVItem {
  return {
    tamanho: "",
    parede: "",
    cobertura: "",
    valor_mao_obra: 0,
    valor_material: 0,
    origem_suporte: "",
    custo_suporte: 0,
  };
}

interface Props {
  empresaId: string | null;
  items: TVItem[];
  onItemsChange: (items: TVItem[]) => void;
  onTotaisChange: (totais: TotaisTV, algumIndisponivel: boolean) => void;
}

export function SelectorPrecoTV({ empresaId, items, onItemsChange, onTotaisChange }: Props) {
  // Garantir pelo menos 1 item
  useEffect(() => {
    if (items.length === 0) {
      onItemsChange([novoItemTV()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Precos e status ND por item
  const [precosPorItem, setPrecosPorItem] = useState<(PrecoTV | null)[]>([]);
  const [ndPorItem, setNdPorItem] = useState<boolean[]>([]);
  // Estado local do texto digitado para mão de obra (por índice)
  const [maoObraRaw, setMaoObraRaw] = useState<Record<number, string>>({});

  // Controla se já passou pelo mount inicial — evita sobrescrever valores
  // editados pelo usuário quando o componente monta com items já carregados.
  const didMountRef = useRef(false);

  // Buscar preços quando items mudam (tamanho/parede/cobertura)
  useEffect(() => {
    if (!empresaId) return;
    let cancelled = false;
    (async () => {
      const precos = await Promise.all(
        items.map(async (it) => {
          if (!it.tamanho || !it.parede || !it.cobertura) return null;
          return await buscarPrecoTV(empresaId, it.tamanho, it.parede, it.cobertura);
        }),
      );
      if (cancelled) return;
      setPrecosPorItem(precos);

      const nds: boolean[] = items.map((it, idx) => {
        const p = precos[idx];
        const configCompleta = !!(it.tamanho && it.parede && it.cobertura);
        if (!configCompleta) return false;
        return !p || !p.disponivel || p.valor_mao_obra == null;
      });
      setNdPorItem(nds);

      // Na primeira montagem com items já carregados, preservar os valores salvos
      // (não sobrescrever valor_mao_obra/custo_suporte/origem_suporte vindos do banco).
      // Novas buscas já populam precosPorItem/ndPorItem acima, então o bloco de
      // exibição (incluindo o input de mão de obra) continua aparecendo.
      if (!didMountRef.current) {
        didMountRef.current = true;
        return;
      }

      const novosItems = items.map((it, idx) => {
        const p = precos[idx];
        const configCompleta = !!(it.tamanho && it.parede && it.cobertura);
        if (!configCompleta) {
          return { ...it, valor_mao_obra: 0, valor_material: 0, origem_suporte: "" as const, custo_suporte: 0 };
        }
        const isND = nds[idx];
        if (isND) {
          return { ...it, valor_mao_obra: 0, valor_material: 0, origem_suporte: "" as const, custo_suporte: 0 };
        }
        let origem: "empresa" | "instalador" = "instalador";
        let custo = 0;
        if (p!.tipo_suporte === "incluso") {
          origem = "empresa";
          custo = 0;
        } else if (p!.tipo_suporte === "valor") {
          origem = "empresa";
          custo = Number(p!.valor_suporte ?? 0);
        } else {
          origem = "instalador";
          custo = 0;
        }
        return {
          ...it,
          valor_mao_obra: Number(p!.valor_mao_obra ?? 0),
          valor_material: Number(p!.valor_parafusos ?? 0),
          origem_suporte: origem,
          custo_suporte: custo,
          tipo_suporte: p!.tipo_suporte,
          valor_suporte: Number(p!.valor_suporte ?? 0),
        };
      });

      // Só atualizar se algo mudou nos snapshots
      const mudou = novosItems.some((ni, i) => {
        const old = items[i];
        return (
          ni.valor_mao_obra !== old.valor_mao_obra ||
          ni.valor_material !== old.valor_material ||
          ni.origem_suporte !== old.origem_suporte ||
          ni.custo_suporte !== old.custo_suporte
        );
      });
      if (mudou) onItemsChange(novosItems);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, items.map((i) => `${i.tamanho}|${i.parede}|${i.cobertura}`).join(",")]);

  // Limpar edições manuais de mão de obra quando o usuário muda seleções (tabela vai sobrescrever)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (didMountRef.current) setMaoObraRaw({}); }, [items.map((i) => `${i.tamanho}|${i.parede}|${i.cobertura}`).join(",")]);

  // Calcular e notificar totais
  const totais = useMemo<TotaisTV>(() => {
    const totalMaoObra = items.reduce((s, i) => s + (Number(i.valor_mao_obra) || 0), 0);
    const totalMaterial = items.reduce((s, i) => s + (Number(i.valor_material) || 0), 0);
    const totalCustoSuporte = items.reduce((s, i) => s + (Number(i.custo_suporte) || 0), 0);
    const origemSuporte = (items[0]?.origem_suporte ?? "") as "" | "empresa" | "instalador";
    return { totalMaoObra, totalMaterial, totalCustoSuporte, origemSuporte };
  }, [items]);

  const algumND = ndPorItem.some(Boolean);

  useEffect(() => {
    onTotaisChange(totais, algumND);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totais.totalMaoObra, totais.totalMaterial, totais.totalCustoSuporte, totais.origemSuporte, algumND]);

  function atualizarItem(idx: number, patch: Partial<TVItem>) {
    const novos = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onItemsChange(novos);
  }

  function adicionarItem() {
    onItemsChange([...items, novoItemTV()]);
  }

  function removerItem(idx: number) {
    const novos = items.filter((_, i) => i !== idx);
    onItemsChange(novos.length === 0 ? [novoItemTV()] : novos);
  }

  return (
    <div className="col-span-2 border rounded-md p-4 bg-muted/30 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">📺 Calculadora de Instalação de TV</h3>
        <span className="text-xs text-muted-foreground">{items.length} TV{items.length > 1 ? "s" : ""}</span>
      </div>

      {items.map((item, idx) => {
        const preco = precosPorItem[idx];
        const isND = ndPorItem[idx];
        return (
          <div key={idx} className="rounded-md border bg-background p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">TV {idx + 1}</div>
              <div className="flex items-center gap-3">
                {preco && !isND && (
                  <span className="text-xs text-muted-foreground">
                    Suporte:{" "}
                    {preco.tipo_suporte === "incluso"
                      ? "Incluso"
                      : preco.tipo_suporte === "valor"
                      ? `R$ ${Number(preco.valor_suporte).toFixed(2)}`
                      : "Não fornecemos"}
                  </span>
                )}
                {items.length > 1 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => removerItem(idx)} className="h-7 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tamanho da TV</Label>
                <Select value={item.tamanho} onValueChange={(v) => atualizarItem(idx, { tamanho: v })}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {TAMANHOS_TV.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de parede</Label>
                <Select value={item.parede} onValueChange={(v) => atualizarItem(idx, { parede: v })}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_PAREDE.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cobertura</Label>
                <Select value={item.cobertura} onValueChange={(v) => atualizarItem(idx, { cobertura: v })}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {COBERTURAS.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isND && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div><strong>ND:</strong> combinação não disponível para esta TV.</div>
              </div>
            )}
            {preco && !isND && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span>Mão de obra R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={maoObraRaw[idx] ?? item.valor_mao_obra.toFixed(2)}
                    onChange={(e) => {
                      setMaoObraRaw((prev) => ({ ...prev, [idx]: e.target.value }));
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) atualizarItem(idx, { valor_mao_obra: val });
                    }}
                    onBlur={() => {
                      const raw = maoObraRaw[idx];
                      if (raw !== undefined) {
                        atualizarItem(idx, { valor_mao_obra: parseFloat(raw) || 0 });
                        setMaoObraRaw((prev) => { const n = { ...prev }; delete n[idx]; return n; });
                      }
                    }}
                    className="w-20 px-2 py-0.5 border rounded text-xs font-medium text-foreground bg-background"
                  />
                </div>
                <span>· Material R$ {Number(item.valor_material).toFixed(2)}</span>
                {item.custo_suporte > 0 && <span>· Suporte R$ {Number(item.custo_suporte).toFixed(2)}</span>}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button type="button" variant="outline" size="sm" onClick={adicionarItem} className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar outra TV
        </Button>
        <div className="text-sm font-medium">
          Totais: Mão de obra <span className="text-primary">R$ {totais.totalMaoObra.toFixed(2)}</span>
          {" · "}Material R$ {totais.totalMaterial.toFixed(2)}
          {totais.totalCustoSuporte > 0 && ` · Suporte R$ ${totais.totalCustoSuporte.toFixed(2)}`}
        </div>
      </div>
    </div>
  );
}
