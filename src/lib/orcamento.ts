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
  categoria: 'tv' | 'adicional' | 'outros' | 'acessorios';
  preco: number;
  custo: number;
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
  categoria: CatalogoItem['categoria'];
  preco: number;
  quantidade: number;
  subtotal: number; // preco * quantidade
}

/** Acessórios NÃO recebem desconto — só serviços. */
export function ehAcessorio(categoria: CatalogoItem['categoria']): boolean {
  return categoria === 'acessorios';
}

/** Resultado final do orçamento (o que a tela mostra e o que grava no banco). */
export interface ResultadoOrcamento {
  itens: ItemSelecionado[];
  subtotal: number;             // soma de TODOS os itens, sem desconto
  subtotal_servicos: number;    // soma só dos serviços (base do desconto)
  subtotal_acessorios: number;  // soma só dos acessórios (nunca descontam)
  fechar_agora: boolean;        // se aplicou o desconto relâmpago
  desconto_pct: number;         // % aplicado (0 se fechar_agora = false)
  desconto_valor: number;       // R$ abatido — incide SÓ sobre serviços
  total: number;                // subtotal - desconto_valor
}

// ---------------------------------------------------------------------
// Helpers de dinheiro (evita erro de ponto flutuante)
// ---------------------------------------------------------------------

/** Arredonda para 2 casas de forma estável (trabalha em centavos). */
export function arredondar2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Garante que o percentual fique entre 0 e 100. */
export function clampPct(pct: number): number {
  if (Number.isNaN(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
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
    categoria: item.categoria,
    preco: item.preco,
    quantidade: qtd,
    subtotal: arredondar2(item.preco * qtd),
  };
}

/**
 * Calcula o orçamento completo a partir dos itens escolhidos.
 * @param itens         itens já selecionados (use montarItem para criar cada um)
 * @param config        config da empresa (desconto, validade, garantia)
 * @param fecharAgora   se true, aplica o desconto
 * @param descontoPctManual (opcional) % digitado na mão; se ausente usa o padrão
 */
export function calcularOrcamento(
  itens: ItemSelecionado[],
  config: ConfigOrcamento,
  fecharAgora: boolean,
  descontoPctManual?: number, // se informado, sobrepõe o % padrão (10%)
): ResultadoOrcamento {
  const subtotal = arredondar2(
    itens.reduce((soma, it) => soma + it.subtotal, 0),
  );

  // Separa a base: só serviços entram no desconto; acessórios ficam de fora.
  const subtotal_acessorios = arredondar2(
    itens
      .filter((it) => ehAcessorio(it.categoria))
      .reduce((soma, it) => soma + it.subtotal, 0),
  );
  const subtotal_servicos = arredondar2(subtotal - subtotal_acessorios);

  const pctBase = descontoPctManual ?? config.desconto_fechar_agora_pct;
  const desconto_pct = fecharAgora ? clampPct(pctBase) : 0;
  // desconto aplicado APENAS sobre a base de serviços
  const desconto_valor = arredondar2(subtotal_servicos * (desconto_pct / 100));
  const total = arredondar2(subtotal - desconto_valor);

  return {
    itens,
    subtotal,
    subtotal_servicos,
    subtotal_acessorios,
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

// =====================================================================
// Repasse de acessórios (split 70/30 sobre o lucro)
// Regra: fornecedor recebe (custo de volta + 70% do lucro);
//        o outro lado recebe 30% do lucro.
//        lucro = venda - custo.  Se venda < custo, lucro é tratado como 0.
// =====================================================================

/** Quem forneceu (comprou) a peça. */
export type Fornecedor = 'empresa' | 'instalador';

/** Percentual do lucro que fica com quem forneceu (o resto vai pro outro). */
export const PCT_LUCRO_FORNECEDOR = 70;

/** Resultado do repasse de UM acessório (já com quantidade embutida). */
export interface RepasseAcessorio {
  fornecedor: Fornecedor;
  venda: number;               // preço de venda total (preco * quantidade)
  custo: number;               // custo total (custo unitário * quantidade)
  lucro: number;               // venda - custo (nunca negativo)
  repasse_instalador: number;  // quanto o instalador recebe
  repasse_empresa: number;     // quanto a empresa recebe
}

/**
 * Calcula o repasse de um acessório.
 * @param vendaTotal  preço de venda já multiplicado pela quantidade
 * @param custoTotal  custo já multiplicado pela quantidade
 * @param fornecedor  'empresa' ou 'instalador' (quem comprou a peça)
 */
export function calcularRepasseAcessorio(
  vendaTotal: number,
  custoTotal: number,
  fornecedor: Fornecedor,
): RepasseAcessorio {
  const venda = arredondar2(vendaTotal);
  const custo = arredondar2(custoTotal);
  const lucro = arredondar2(Math.max(0, venda - custo));

  const parteFornecedor = arredondar2(lucro * (PCT_LUCRO_FORNECEDOR / 100));
  const parteOutro = arredondar2(lucro - parteFornecedor); // 30% (evita centavo perdido)

  let repasse_instalador: number;
  let repasse_empresa: number;

  if (fornecedor === 'instalador') {
    // instalador recupera o custo + fica com 70% do lucro
    repasse_instalador = arredondar2(custo + parteFornecedor);
    repasse_empresa = parteOutro;
  } else {
    // empresa forneceu: empresa recupera custo + 70%; instalador leva 30%
    repasse_empresa = arredondar2(custo + parteFornecedor);
    repasse_instalador = parteOutro;
  }

  return { fornecedor, venda, custo, lucro, repasse_instalador, repasse_empresa };
}

/** Um acessório escolhido, já com custo e fornecedor definidos. */
export interface AcessorioSelecionado extends ItemSelecionado {
  custo: number;          // custo unitário
  fornecedor: Fornecedor;
}

/** Soma do repasse de vários acessórios (o que "vem pronto pra pagamento"). */
export interface ResumoRepasse {
  total_instalador: number;
  total_empresa: number;
  itens: (RepasseAcessorio & { nome: string; quantidade: number })[];
}

/**
 * Consolida o repasse de todos os acessórios do orçamento.
 * Cada acessório usa seu custo unitário * quantidade e o fornecedor marcado.
 */
export function resumirRepasseAcessorios(
  acessorios: AcessorioSelecionado[],
): ResumoRepasse {
  const itens = acessorios.map((a) => {
    const r = calcularRepasseAcessorio(
      a.subtotal,                       // venda total (preco * qtd)
      arredondar2(a.custo * a.quantidade), // custo total
      a.fornecedor,
    );
    return { ...r, nome: a.nome, quantidade: a.quantidade };
  });

  return {
    total_instalador: arredondar2(
      itens.reduce((s, i) => s + i.repasse_instalador, 0),
    ),
    total_empresa: arredondar2(
      itens.reduce((s, i) => s + i.repasse_empresa, 0),
    ),
    itens,
  };
}

// =====================================================================
// Extras vendidos na finalização do serviço (servicos.servicos_extras)
// Reaproveita o mesmo repasse 70/30 acima, mas persistido por item —
// necessário porque um reenvio (correcao_solicitada) precisa reconstruir
// os campos flat (valor_reembolso_despesas, custo_suporte,
// valor_recebido_cliente) sem somar os extras da tentativa anterior de novo.
// =====================================================================

/** Um item de acessório vendido na finalização, já com o repasse calculado. */
export interface ExtraServicoItem {
  catalogo_id: string;
  nome: string;
  valor_venda: number;
  valor_compra: number;
  fornecedor: Fornecedor;
  lucro: number;
  repasse_instalador: number;
  repasse_empresa: number;
}

/** Converte um acessório selecionado (com fornecedor definido) no item a persistir. */
export function paraExtraServico(a: AcessorioSelecionado): ExtraServicoItem {
  const r = calcularRepasseAcessorio(
    a.subtotal,
    arredondar2(a.custo * a.quantidade),
    a.fornecedor,
  );
  return {
    catalogo_id: a.catalogo_id,
    nome: a.nome,
    valor_venda: r.venda,
    valor_compra: r.custo,
    fornecedor: a.fornecedor,
    lucro: r.lucro,
    repasse_instalador: r.repasse_instalador,
    repasse_empresa: r.repasse_empresa,
  };
}

/** Soma os totais de uma lista de extras (já persistidos ou a persistir). */
export function somarExtras(extras: ExtraServicoItem[]): {
  totalVenda: number;
  totalInstalador: number;
  totalEmpresa: number;
} {
  return {
    totalVenda: arredondar2(extras.reduce((s, e) => s + e.valor_venda, 0)),
    totalInstalador: arredondar2(
      extras.reduce((s, e) => s + e.repasse_instalador, 0),
    ),
    totalEmpresa: arredondar2(
      extras.reduce((s, e) => s + e.repasse_empresa, 0),
    ),
  };
}

/**
 * Separa o repasse de cada extra em reembolso (o custo, devolvido a quem
 * comprou) vs ganho (a parte do lucro 70/30). custo + ganho = repasse do lado
 * que forneceu; o outro lado só tem ganho (os 30/70% restantes do lucro).
 */
export interface DecomposicaoExtra {
  reembolso_instalador: number;
  ganho_instalador: number;
  reembolso_empresa: number;
  ganho_empresa: number;
}

export function decomporExtra(e: ExtraServicoItem): DecomposicaoExtra {
  const custo = e.valor_compra;
  if (e.fornecedor === 'instalador') {
    return {
      reembolso_instalador: custo,
      ganho_instalador: arredondar2(e.repasse_instalador - custo),
      reembolso_empresa: 0,
      ganho_empresa: e.repasse_empresa,
    };
  }
  return {
    reembolso_instalador: 0,
    ganho_instalador: e.repasse_instalador,
    reembolso_empresa: custo,
    ganho_empresa: arredondar2(e.repasse_empresa - custo),
  };
}

/** Soma a decomposição reembolso/ganho de vários extras (já persistidos ou a persistir). */
export function somarDecomposicaoExtras(extras: ExtraServicoItem[]): DecomposicaoExtra {
  return extras.reduce(
    (acc, e) => {
      const d = decomporExtra(e);
      return {
        reembolso_instalador: arredondar2(acc.reembolso_instalador + d.reembolso_instalador),
        ganho_instalador: arredondar2(acc.ganho_instalador + d.ganho_instalador),
        reembolso_empresa: arredondar2(acc.reembolso_empresa + d.reembolso_empresa),
        ganho_empresa: arredondar2(acc.ganho_empresa + d.ganho_empresa),
      };
    },
    { reembolso_instalador: 0, ganho_instalador: 0, reembolso_empresa: 0, ganho_empresa: 0 },
  );
}
