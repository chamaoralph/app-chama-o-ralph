// Helpers para a Tabela de Preços de Instalação de TV
import { supabase } from "@/integrations/supabase/client";

export const TAMANHOS_TV = [
  { value: "ate_39", label: 'até 39"' },
  { value: "40_55", label: '40" – 55"' },
  { value: "58_65", label: '58" – 65"' },
  { value: "70_75", label: '70" – 75"' },
  { value: "85", label: '85"' },
  { value: "98_100", label: '98" – 100"' },
] as const;

export const TIPOS_PAREDE = [
  { value: "painel_madeira", label: "Painel de madeira" },
  { value: "alvenaria", label: "Alvenaria" },
  { value: "drywall", label: "Drywall" },
  { value: "teto", label: "Teto" },
] as const;

export const COBERTURAS = [
  { value: "parcial", label: "Parcial" },
  { value: "total", label: "Total" },
] as const;

export const TIPOS_SUPORTE = [
  { value: "nao_fornecemos", label: "Não fornecemos" },
  { value: "incluso", label: "Incluso" },
  { value: "valor", label: "Valor (R$)" },
] as const;

export interface PrecoTV {
  id: string;
  empresa_id: string;
  tamanho_tv: string;
  tipo_parede: string;
  cobertura: string;
  valor_mao_obra: number | null;
  valor_parafusos: number | null;
  valor_suporte: number | null;
  tipo_suporte: string;
  disponivel: boolean;
}

export function ehInstalacaoTV(nome: string | undefined | null): boolean {
  if (!nome) return false;
  const n = nome.toLowerCase().trim();
  // Aceita "TV", "Instalação de TV", "Instalar TV", etc.
  // Match palavra "tv" isolada (não "tvm" ou similares)
  return /(^|\s|de\s)tv($|\s|\b)/.test(n) || n === "tv";
}

export async function buscarPrecoTV(
  empresaId: string,
  tamanho: string,
  parede: string,
  cobertura: string,
): Promise<PrecoTV | null> {
  const { data } = await supabase
    .from("precos_instalacao_tv" as any)
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("tamanho_tv", tamanho)
    .eq("tipo_parede", parede)
    .eq("cobertura", cobertura)
    .maybeSingle();
  return (data as any) ?? null;
}
