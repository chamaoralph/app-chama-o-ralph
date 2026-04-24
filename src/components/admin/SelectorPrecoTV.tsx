import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
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

interface Props {
  empresaId: string | null;
  values: SelectorTVValues;
  onChange: (values: SelectorTVValues) => void;
  onPrecoCalculado: (resultado: PrecoTVResult | null, indisponivel: boolean) => void;
}

export function SelectorPrecoTV({ empresaId, values, onChange, onPrecoCalculado }: Props) {
  const [preco, setPreco] = useState<PrecoTV | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);

  useEffect(() => {
    if (!empresaId || !values.tamanho_tv || !values.tipo_parede || !values.cobertura) {
      setPreco(null);
      setIndisponivel(false);
      onPrecoCalculado(null, false);
      return;
    }

    let cancelled = false;
    (async () => {
      const p = await buscarPrecoTV(empresaId, values.tamanho_tv, values.tipo_parede, values.cobertura);
      if (cancelled) return;
      setPreco(p);
      const isND = !p || !p.disponivel || p.valor_mao_obra == null;
      setIndisponivel(isND);
      if (isND) {
        onPrecoCalculado(null, true);
        return;
      }
      let origemSuporte: "" | "empresa" | "instalador" = "";
      let custoSuporte = 0;
      if (p!.tipo_suporte === "incluso") {
        origemSuporte = "empresa";
        custoSuporte = 0;
      } else if (p!.tipo_suporte === "valor") {
        origemSuporte = "empresa";
        custoSuporte = Number(p!.valor_suporte ?? 0);
      } else {
        origemSuporte = "";
        custoSuporte = 0;
      }
      onPrecoCalculado(
        {
          valorMaoObra: Number(p!.valor_mao_obra ?? 0),
          valorMaterial: Number(p!.valor_parafusos ?? 0),
          origemSuporte,
          custoSuporte,
        },
        false,
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, values.tamanho_tv, values.tipo_parede, values.cobertura]);

  return (
    <div className="col-span-2 border rounded-md p-4 bg-muted/30 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">📺 Calculadora de Instalação de TV</h3>
        {preco && !indisponivel && (
          <span className="text-xs text-muted-foreground">
            Suporte: {preco.tipo_suporte === "incluso" ? "Incluso" : preco.tipo_suporte === "valor" ? `R$ ${Number(preco.valor_suporte).toFixed(2)}` : "Não fornecemos"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tamanho da TV</Label>
          <Select
            value={values.tamanho_tv}
            onValueChange={(v) => onChange({ ...values, tamanho_tv: v })}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {TAMANHOS_TV.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo de parede</Label>
          <Select
            value={values.tipo_parede}
            onValueChange={(v) => onChange({ ...values, tipo_parede: v })}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_PAREDE.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cobertura</Label>
          <Select
            value={values.cobertura}
            onValueChange={(v) => onChange({ ...values, cobertura: v })}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {COBERTURAS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {indisponivel && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <strong>Combinação não disponível (ND).</strong> Esta combinação de tamanho, parede e
            cobertura não é oferecida. Escolha outra opção ou ajuste o pedido.
          </div>
        </div>
      )}
      {preco && !indisponivel && (
        <div className="text-xs text-muted-foreground">
          ✅ Valores preenchidos automaticamente. Você ainda pode editar manualmente abaixo.
        </div>
      )}
    </div>
  );
}
