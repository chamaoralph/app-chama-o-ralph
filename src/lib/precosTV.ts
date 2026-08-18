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

/** Label do tamanho (ex: '85"', '40" – 55"') a partir do código salvo (ex: '85', '40_55'). */
export function labelTamanhoTV(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  return TAMANHOS_TV.find((t) => t.value === codigo)?.label ?? null;
}

/**
 * Monta o(s) label(s) de tamanho de TV de uma cotação/serviço — considera
 * tvs_itens (várias TVs, cada uma com seu tamanho) com fallback pro campo
 * legado tv_tamanho (uma TV só). Tamanhos repetidos aparecem uma vez.
 */
export function labelsTamanhosTV(
  tvTamanho: string | null | undefined,
  tvsItens: { tamanho?: string | null }[] | null | undefined,
): string[] {
  const codigos = (tvsItens && tvsItens.length > 0
    ? tvsItens.map((item) => item.tamanho)
    : [tvTamanho]
  ).filter((c): c is string => !!c);
  const labels = codigos.map(labelTamanhoTV).filter((l): l is string => !!l);
  return [...new Set(labels)];
}

/**
 * Junta tipo_servico num texto exibível, anexando o tamanho da TV ao item
 * "TV" da lista (ex: ["TV", "Fechadura"] + tamanho "85" -> 'TV 85", Fechadura').
 */
export function formatarTipoServicoComTamanho(
  tipoServico: string[] | null | undefined,
  tvTamanho: string | null | undefined,
  tvsItens: { tamanho?: string | null }[] | null | undefined,
): string {
  if (!tipoServico || tipoServico.length === 0) return "";
  const tamanhos = labelsTamanhosTV(tvTamanho, tvsItens);
  const tamanhosTexto = tamanhos.join("/");
  return tipoServico
    .map((tipo) => (ehInstalacaoTV(tipo) && tamanhosTexto ? `${tipo} ${tamanhosTexto}` : tipo))
    .join(", ");
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
