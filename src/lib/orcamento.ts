// =====================================================================
// lib/orcamento.ts
// Lógica pura do "Orçamento na Hora" — sem React, sem Supabase.
// Usada pela tela do instalador (gerar orçamento) e pelo card de print.
// Só cálculo + formatação + montagem da mensagem. Fácil de testar.
// =====================================================================

// ---------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------

/** Item vindo da tabela catalogo_servicos (o que o admin cadastra). */
export interface CatalogoItem {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: 'tv' | 'adicional' | 'outros';
  preco: number;
  por_quantidade: boolean;
  ativo: boolean;
  ordem: number;
}

/** Configuração vinda de config_orcamento. */
export interface ConfigOrcamento {
  desconto_fechar_agora_pct: number;
  validade_dias: number;
  garantia_dias: number;
}

/** Um item já escolhido pelo instalador, com quantidade e subtotal calculado. */
export interface ItemSelecionado {
  catalogo_id: string;
  nome: string;
  preco: number;
  quantidade: number;
  subtotal: number; // preco * quantidade
}

/** Resultado final do orçamento (o que a tela mostra e o que grava no banco). */
export interface ResultadoOrcamento {
  itens: ItemSelecionado[];
  subtotal: number;        // soma dos itens, sem desconto
  fechar_agora: boolean;   // se aplicou o desconto relâmpago
  desconto_pct: number;    // % aplicado (0 se fechar_agora = false)
  desconto_valor: number;  // quanto foi abatido em R$
  total: number;           // subtotal - desconto_valor
}

// ---------------------------------------------------------------------
// Helpers de dinheiro (evita erro de ponto flutuante)
// ---------------------------------------------------------------------

/** Arredonda para 2 casas de forma estável (trabalha em centavos). */
export function arredondar2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Formata em Real: 239 -> "R$ 239,00". */
export function formatarBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

// ---------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------

/**
 * Transforma um item do catálogo + quantidade em um ItemSelecionado.
 * Itens que não são "por_quantidade" têm sempre quantidade 1.
 */
export function montarItem(item: CatalogoItem, quantidade: number): ItemSelecionado {
  const qtd = item.por_quantidade ? Math.max(1, Math.floor(quantidade)) : 1;
  return {
    catalogo_id: item.id,
    nome: item.nome,
    preco: item.preco,
    quantidade: qtd,
    subtotal: arredondar2(item.preco * qtd),
  };
}

/**
 * Calcula o orçamento completo a partir dos itens escolhidos.
 * @param itens         itens já selecionados (use montarItem para criar cada um)
 * @param config        config da empresa (desconto, validade, garantia)
 * @param fecharAgora   se true, aplica o desconto relâmpago único
 */
export function calcularOrcamento(
  itens: ItemSelecionado[],
  config: ConfigOrcamento,
  fecharAgora: boolean,
): ResultadoOrcamento {
  const subtotal = arredondar2(
    itens.reduce((soma, it) => soma + it.subtotal, 0),
  );

  const desconto_pct = fecharAgora ? config.desconto_fechar_agora_pct : 0;
  const desconto_valor = arredondar2(subtotal * (desconto_pct / 100));
  const total = arredondar2(subtotal - desconto_valor);

  return {
    itens,
    subtotal,
    fechar_agora: fecharAgora,
    desconto_pct,
    desconto_valor,
    total,
  };
}

// ---------------------------------------------------------------------
// Mensagem / texto do orçamento (formato oficial Chama o Ralph)
// Serve pro card e como texto opcional pra copiar.
// ---------------------------------------------------------------------

export interface OpcoesMensagem {
  nomeCliente?: string | null;
  config: ConfigOrcamento;
}

/**
 * Monta a mensagem de orçamento no padrão da empresa.
 * Ex.:
 *   Olá, João! 😊 Segue o orçamento do seu serviço:
 *   🔧 Instalação de TV 55" — Proteção Total
 *   • Ocultar fios no drywall
 *   💰 Total: R$ 439,00
 *   💸 Com desconto (fechando agora): R$ 395,10
 *   ...
 */
export function montarMensagemOrcamento(
  resultado: ResultadoOrcamento,
  opcoes: OpcoesMensagem,
): string {
  const { nomeCliente, config } = opcoes;
  const linhas: string[] = [];

  const saudacao = nomeCliente?.trim()
    ? `Olá, ${nomeCliente.trim()}! 😊 Segue o orçamento do seu serviço:`
    : `Olá! 😊 Segue o orçamento do seu serviço:`;
  linhas.push(saudacao, '');

  // Itens — o primeiro leva o 🔧, os demais entram como tópicos.
  resultado.itens.forEach((it, i) => {
    const qtd = it.quantidade > 1 ? ` (x${it.quantidade})` : '';
    linhas.push(i === 0 ? `🔧 ${it.nome}${qtd}` : `• ${it.nome}${qtd}`);
  });
  linhas.push('');

  // Valores
  if (resultado.fechar_agora && resultado.desconto_valor > 0) {
    linhas.push(`💰 Total: ${formatarBRL(resultado.subtotal)}`);
    linhas.push(
      `💸 Fechando agora (-${resultado.desconto_pct}%): ${formatarBRL(resultado.total)}`,
    );
  } else {
    linhas.push(`💰 Total: ${formatarBRL(resultado.total)}`);
  }
  linhas.push('');

  // Rodapé institucional
  linhas.push(`✅ Garantia de ${config.garantia_dias} dias`);
  linhas.push(`📅 Orçamento válido por ${config.validade_dias} dias`);
  linhas.push('⭐ Chama o Ralph — +5.000 instalações em SP');
  linhas.push('');
  linhas.push('Posso já agendar pra você? 🗓️');

  return linhas.join('\n');
}

// ---------------------------------------------------------------------
// Preparo para gravar no banco (vira cotação)
// Mapeia o resultado para o formato de itens_extras usado nas cotações.
// OBS: o mapeamento final pode ajustar após confirmarmos a função
//      criar_servico_ao_confirmar(). Por ora segue o padrão descrição+valor.
// ---------------------------------------------------------------------

export interface ItemExtraCotacao {
  descricao: string;
  valor: number;
}

/** Converte os itens do orçamento no array itens_extras da cotação. */
export function paraItensExtras(resultado: ResultadoOrcamento): ItemExtraCotacao[] {
  return resultado.itens.map((it) => ({
    descricao: it.quantidade > 1 ? `${it.nome} (x${it.quantidade})` : it.nome,
    valor: it.subtotal,
  }));
}
