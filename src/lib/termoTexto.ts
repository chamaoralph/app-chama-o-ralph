// Texto completo do termo de aceite
export interface TermoSecao {
  titulo: string;
  paragrafos: string[];
}

export const TERMO_SECOES: TermoSecao[] = [
  {
    titulo: "1. LOCAL, TESTE E AUTORIZAÇÃO",
    paragrafos: [
      "Indiquei o local e altura da fixação e assumo a responsabilidade por essa escolha;",
      "A equipe testou a TV antes. Defeitos anteriores não são responsabilidade da empresa;",
      "Estive presente ou autorizei responsável maior de idade para acompanhar;",
    ],
  },
  {
    titulo: "2. O QUE NÃO ESTÁ INCLUSO",
    paragrafos: [
      "O serviço contratado é exclusivamente a instalação do suporte e fixação da televisão.",
      "Não está incluso: Configuração de aparelhos, conexão à internet, instalação de aplicativos, sintonização de canais (R$ 50,00 adicionais); Adaptações em tomadas, pontos de energia ou alterações elétricas (cobrados à parte); Reinstalação de TVs; Acabamentos no imóvel como pintura, massa, gesso, azulejos, cerâmicas; Instalação de prateleiras, painéis ou bases; Instalação de suporte articulado em parede de gesso (drywall); Locomoção de TV entre andares;",
      "TUBULAÇÕES E PERFURAÇÃO: Em imóveis com tubulações hidráulicas embutidas, o cliente deve informar a localização ou fornecer a planta do imóvel antes da perfuração. Caso não possua, o técnico fará avaliação visual e o cliente decidirá se autoriza a perfuração. Danos a tubulações em perfurações autorizadas pelo cliente sem apresentação de planta não são de responsabilidade da empresa. Se houver impeditivo para execução do serviço na visita, será cobrada taxa de R$ 90,00.",
    ],
  },
  {
    titulo: "3. GARANTIA DA INSTALAÇÃO (90 DIAS)",
    paragrafos: [
      "A garantia cobre exclusivamente a fixação do suporte na parede (buchas, parafusos e resistência estrutural da ancoragem). Se houver folga, desprendimento ou queda do suporte por falha técnica, a equipe realizará a reinstalação no mesmo local sem custo.",
      "Em caso de queda do suporte que resulte em dano à TV, a empresa arcará com o conserto ou, se inviável, com a substituição por equipamento equivalente (considerando marca, tamanho, tecnologia e tempo de uso).",
      "Não estão cobertos pela garantia: nivelamento, ângulo, inclinação, passagem de cabos e configurações do aparelho, pois podem ser alterados pelo cliente após o serviço. Também não cobre retrabalho por mudança de ideia, problemas causados por estrutura frágil (paredes de gesso, úmidas ou quebradiças) e manipulação do equipamento por terceiros. Esta garantia aplica-se a ambas as modalidades de instalação.",
    ],
  },
  {
    titulo: "4. DANOS ACIDENTAIS E SUBSTITUIÇÃO",
    paragrafos: [
      "4.1 Modalidade COMPLETA",
      "Se a equipe danificar a TV durante a instalação, a empresa arca com o conserto em assistência técnica autorizada da marca; Se o conserto for inviável, a empresa substituirá por TV equivalente (mesma marca, tamanho, tecnologia e tempo de uso); TV usada será substituída por equivalente usada, nunca por nova; O equipamento fornecido terá garantia de 90 dias (imagem e som); Toda comprovação será feita por registro fotográfico, vídeo ou vistoria no local.",
      "4.2 Modalidade COLABORATIVA",
      "Válida apenas para TVs de até 55\" (exceto OLED e Samsung The Frame, pela fragilidade e valor elevado); O cliente auxiliará o técnico no encaixe da TV no suporte (~30 segundos), por livre vontade e em plenas condições físicas; Se a TV sofrer dano acidental durante esse manuseio conjunto, a responsabilidade será compartilhada: Empresa cobre 50% do conserto em assistência autorizada, indicada pela empresa; Se o conserto for inviável, empresa cobre 50% de TV equivalente (mesma marca, polegadas e categoria); Limite máximo da contribuição da empresa (conserto ou substituição): R$ 1.000,00; Se o cliente escolher assistência técnica diferente da indicada, a cobertura de 50% não se aplica; Cobertura válida apenas para danos ocorridos e constatados no dia da instalação;",
      "Independentemente da modalidade, a empresa responde integralmente por danos causados por negligência, imprudência ou imperícia (CDC, arts. 14 e 25).",
    ],
  },
  {
    titulo: "5. POLÍTICA DE RETRABALHO E CANCELAMENTO",
    paragrafos: [
      "Alteração de local ou altura após a conclusão do serviço: se solicitada no mesmo dia e houver disponibilidade da equipe, será cobrado 70% do valor inicial da instalação. Após o dia da instalação, será necessário novo agendamento com custo integral;",
      "Cancelamentos ou reagendamentos com menos de 12h de antecedência estão sujeitos a taxa operacional, no valor de R$ 90,00;",
    ],
  },
  {
    titulo: "6. RESPONSABILIDADE E CONDUTA",
    paragrafos: [
      "Os instaladores devem ser acompanhados pelo cliente ou por responsável autorizado e maior de idade durante todo o período em que estiverem no local;",
      "Sem a presença do cliente ou responsável autorizado durante o serviço, a empresa não se responsabiliza por objetos no ambiente ou decisões tomadas sobre a instalação;",
      "Em caso de ausência do cliente, a liberação da entrada será considerada como aceite das condições da prestação de serviço sem acompanhamento direto;",
      "Todos os técnicos são parceiros treinados e capacitados pela empresa;",
      "Os técnicos estão autorizados a receber apenas os valores combinados pelo atendimento da empresa. Caixinhas ficam a critério e vontade do cliente;",
      "Qualquer serviço adicional deve ser solicitado diretamente à empresa antes da execução, nunca combinado direto com o técnico;",
      "É expressamente proibido ao cliente contratar, subcontratar ou estabelecer relação comercial direta com qualquer técnico da empresa, seja durante ou após a prestação do serviço, sob pena de multa contratual no valor de R$ 1.000,00 (mil reais);",
      "Ao término da instalação, será registrado o estado final da TV instalada (nivelada, funcionando e sem danos), como comprovação da entrega do serviço;",
    ],
  },
  {
    titulo: "7. PAGAMENTO",
    paragrafos: [
      "O cliente se compromete a realizar o pagamento integral do valor combinado imediatamente após a conclusão do serviço, conforme informado previamente no momento do agendamento ou atendimento;",
      "Os pagamentos poderão ser feitos via PIX, dinheiro ou forma combinada previamente;",
      "O não pagamento poderá acarretar suspensão da garantia, cobrança extrajudicial e eventual registro da inadimplência em nome do contratante;",
      "Em caso de dúvidas sobre o valor, o cliente deverá esclarecê-las antes da execução do serviço;",
    ],
  },
];

export const TERMO_ACEITE_TEXTO =
  "Declaro que li e entendi este termo, que me foram apresentadas as modalidades Completa e Colaborativa, e que escolhi livremente a opção marcada acima, ciente das condições de cada uma. Foto da assinatura enviada via WhatsApp tem validade conforme MP 2.200-2/2001.";

export const TIPOS_TV = ["LED", "QLED", "OLED", "The Frame", "Outro"] as const;
export type TipoTV = (typeof TIPOS_TV)[number];

export function colaborativaIndisponivel(
  tipoTV: string | null | undefined,
  polegadas: string | null | undefined,
): { indisponivel: boolean; motivo?: string } {
  if (!tipoTV && !polegadas) return { indisponivel: false };
  if (tipoTV === "OLED") return { indisponivel: true, motivo: "TVs OLED não são elegíveis para a modalidade Colaborativa." };
  if (tipoTV === "The Frame") return { indisponivel: true, motivo: "Samsung The Frame não é elegível para a modalidade Colaborativa." };
  const pol = parseInt(String(polegadas || "").replace(/\D/g, ""), 10);
  if (!isNaN(pol) && pol > 55) return { indisponivel: true, motivo: "Modalidade Colaborativa válida apenas para TVs até 55\"." };
  return { indisponivel: false };
}

/**
 * Valida uma lista de TVs contra as regras da modalidade Colaborativa.
 * Se qualquer TV for incompatível, toda a cotação perde essa modalidade.
 */
export function colaborativaIndisponivelLista(
  tvs: Array<{ tipo?: string | null; polegadas?: string | null }>,
): { indisponivel: boolean; motivo?: string } {
  if (!tvs || tvs.length === 0) return { indisponivel: false };
  for (let i = 0; i < tvs.length; i++) {
    const t = tvs[i];
    const r = colaborativaIndisponivel(t.tipo, t.polegadas);
    if (r.indisponivel) {
      return { indisponivel: true, motivo: `TV ${i + 1}: ${r.motivo}` };
    }
  }
  return { indisponivel: false };
}

export function gerarToken(): string {
  return crypto.randomUUID().split("-")[0];
}

export function formatarCPF(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatarMoeda(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
