import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { InstaladorLayout } from "@/components/layout/InstaladorLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CatalogoItem,
  Fornecedor,
  AcessorioSelecionado,
  montarItem,
  calcularRepasseAcessorio,
  paraExtraServico,
  somarExtras,
  somarDecomposicaoExtras,
  formatarBRL,
} from "@/lib/orcamento";

interface ItemEstoqueDevolver {
  servico_id: string;
  catalogo_id: string;
  acessorio: string;
  qtd_fora: number;
}

// Função para comprimir imagens antes do upload
async function comprimirImagem(file: File, qualidade = 0.7): Promise<File> {
  return new Promise((resolve, reject) => {
    // Se não for imagem, retorna o arquivo original
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Redimensionar se muito grande (máx 1000px)
      const maxSize = 1000;
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const nomeArquivo = file.name.replace(/\.[^/.]+$/, '.jpg');
            resolve(new File([blob], nomeArquivo, { type: 'image/jpeg' }));
          } else {
            reject(new Error('Falha ao comprimir imagem'));
          }
        },
        'image/jpeg',
        qualidade
      );
    };

    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = URL.createObjectURL(file);
  });
}

// Formata tamanho em bytes para exibição legível
function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

export default function FinalizarServico() {
  const { id: servicoId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [servico, setServico] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [fotos, setFotos] = useState<File[]>([]);
  const [temReembolso, setTemReembolso] = useState(false);
  const [notaFiscal, setNotaFiscal] = useState<File | null>(null);
  const [valorReembolso, setValorReembolso] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [comprimindo, setComprimindo] = useState(false);
  const [recebimentoCliente, setRecebimentoCliente] = useState<'empresa' | 'instalador'>('empresa');
  const [valorRecebidoCliente, setValorRecebidoCliente] = useState("");
  const [quantidadesDevolver, setQuantidadesDevolver] = useState<Record<string, number>>({});
  const [usouSuporteGarantia, setUsouSuporteGarantia] = useState<boolean | null>(null);

  // --- Outro instalador ajudou? (divide o valor de referência da mão de
  // obra em 25%/25% — só informativo, não muda o repasse real da empresa
  // pro instalador principal, ver migration 20260821120000) ---
  const [teveAjudante, setTeveAjudante] = useState(false);
  const [instaladorAjudanteId, setInstaladorAjudanteId] = useState<string>("");

  // --- Extras (acessórios vendidos na finalização) ---
  const [quantidadesExtras, setQuantidadesExtras] = useState<Record<string, number>>({});
  // Fornecedor do RESTANTE além do que o instalador já tem em mãos — só é
  // perguntado quando a quantidade pedida excede o saldo próprio dele (ver
  // acessoriosExtrasSelecionados abaixo: enquanto o saldo próprio cobrir, não
  // existe escolha nenhuma, é automático).
  const [fornecedoresExtras, setFornecedoresExtras] = useState<Record<string, Fornecedor>>({});
  // Custo que o instalador diz ter pago do próprio bolso, só pra a parte do
  // restante que ele mesmo comprou (fornecedor do restante = 'instalador').
  const [custosCompraPropriaExtras, setCustosCompraPropriaExtras] = useState<Record<string, string>>({});

  const { data: catalogoAcessorios } = useQuery({
    queryKey: ["catalogo-acessorios-extra"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogo_servicos")
        .select("*")
        .eq("ativo", true)
        .eq("categoria", "acessorios")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as CatalogoItem[];
    },
  });

  const { data: outrosInstaladores } = useQuery({
    queryKey: ["outros-instaladores-para-ajudante", servico?.empresa_id],
    enabled: !!servico?.empresa_id,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome")
        .eq("tipo", "instalador")
        .eq("empresa_id", servico.empresa_id)
        .eq("ativo", true)
        .neq("id", user?.id ?? "")
        .order("nome");
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
  });

  const { data: saldosEstoqueExtras } = useQuery({
    queryKey: ["estoque-saldo-extra"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_saldo")
        .select("catalogo_id, saldo");
      if (error) throw error;
      return (data || []) as { catalogo_id: string; saldo: number }[];
    },
  });

  const saldoExtraPorId = useMemo(() => {
    const mapa: Record<string, number> = {};
    (saldosEstoqueExtras ?? []).forEach((s) => { mapa[s.catalogo_id] = s.saldo; });
    return mapa;
  }, [saldosEstoqueExtras]);

  // --- Saldo PRÓPRIO do instalador (o mesmo controlado em /admin/suportes) ---
  // Usado quando ele marca "Eu forneci" num extra: em vez de digitar um custo
  // à mão pra qualquer acessório do catálogo, só deixa escolher o que ele
  // realmente tem em mãos, com o custo médio do que pagou nas entregas.
  const { data: movimentacoesProprias } = useQuery({
    queryKey: ["movimentacoes-suportes-proprio"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("movimentacoes_suportes")
        .select("catalogo_id, tipo_movimento, quantidade, valor_unitario")
        .eq("instalador_id", user.id);
      if (error) throw error;
      return (data || []) as {
        catalogo_id: string | null;
        tipo_movimento: string;
        quantidade: number;
        valor_unitario: number | null;
      }[];
    },
  });

  const { saldoInstaladorPorId, custoMedioInstaladorPorId } = useMemo(() => {
    const saldo: Record<string, number> = {};
    const custoTotal: Record<string, number> = {};
    const qtdRecebida: Record<string, number> = {};
    (movimentacoesProprias ?? []).forEach((m) => {
      if (!m.catalogo_id) return;
      if (m.tipo_movimento === "entrega") {
        saldo[m.catalogo_id] = (saldo[m.catalogo_id] ?? 0) + m.quantidade;
        custoTotal[m.catalogo_id] = (custoTotal[m.catalogo_id] ?? 0) + (m.valor_unitario ?? 0) * m.quantidade;
        qtdRecebida[m.catalogo_id] = (qtdRecebida[m.catalogo_id] ?? 0) + m.quantidade;
      } else if (m.tipo_movimento === "devolucao" || m.tipo_movimento === "uso") {
        saldo[m.catalogo_id] = (saldo[m.catalogo_id] ?? 0) - m.quantidade;
      }
    });
    const custoMedio: Record<string, number> = {};
    Object.keys(qtdRecebida).forEach((id) => {
      custoMedio[id] = qtdRecebida[id] > 0 ? custoTotal[id] / qtdRecebida[id] : 0;
    });
    return { saldoInstaladorPorId: saldo, custoMedioInstaladorPorId: custoMedio };
  }, [movimentacoesProprias]);

  // --- Garantia Total: suporte fixo universal usado na instalação ---
  const isGarantiaTotal = servico?.cotacoes?.tv_cobertura === "total";

  const { data: catalogoSuporteGarantia } = useQuery({
    queryKey: ["catalogo-suporte-garantia-total"],
    enabled: isGarantiaTotal,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogo_servicos")
        .select("*")
        .eq("ativo", true)
        .eq("categoria", "acessorios")
        .ilike("nome", "%suporte fixo universal%")
        .maybeSingle();
      if (error) throw error;
      return data as CatalogoItem | null;
    },
  });

  const saldoSuporteGarantia = catalogoSuporteGarantia ? (saldoExtraPorId[catalogoSuporteGarantia.id] ?? 0) : 0;

  const { data: custoSuporteGarantia, isLoading: carregandoCustoSuporteGarantia } = useQuery({
    queryKey: ["custo-atual-suporte-garantia-total", catalogoSuporteGarantia?.id],
    enabled: !!catalogoSuporteGarantia?.id && usouSuporteGarantia === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("custo_atual_acessorio", {
        p_catalogo_id: catalogoSuporteGarantia!.id,
      });
      if (error) throw error;
      return data as number | null;
    },
  });

  const suporteGarantiaComProblema =
    isGarantiaTotal && (usouSuporteGarantia === null || (usouSuporteGarantia === true && (!catalogoSuporteGarantia || saldoSuporteGarantia <= 0)));

  // Antes só buscava o custo de referência do central pra linha "restante
  // vem do central" (fornecedorRestante==='empresa'). Ampliado pra QUALQUER
  // item selecionado — serve também de rede de segurança pra linha do saldo
  // próprio (ver uso em custo: abaixo), que hoje confia inteiramente na
  // média de valor_unitario das entregas do instalador. Se essa média vier
  // 0 (ex: um ajuste manual de saldo lançado sem custo — bug real
  // encontrado e corrigido em 2026-08-19, SRV-2026-672 vendeu uma Fechadura
  // com reembolso de custo zerado), cai pro custo de referência do catálogo
  // em vez de tratar como grátis.
  const acessoriosExtrasEmpresaIds = useMemo(() => {
    if (!catalogoAcessorios) return [];
    return catalogoAcessorios
      .filter((c) => quantidadesExtras[c.id] != null)
      .map((c) => c.id);
  }, [catalogoAcessorios, quantidadesExtras]);

  const custoEstoqueExtraQueries = useQueries({
    queries: acessoriosExtrasEmpresaIds.map((catalogoId) => ({
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

  const custoEstoqueExtraPorId = useMemo(() => {
    const mapa: Record<string, { valor: number | null; carregando: boolean }> = {};
    acessoriosExtrasEmpresaIds.forEach((catalogoId, idx) => {
      const q = custoEstoqueExtraQueries[idx];
      mapa[catalogoId] = { valor: q?.data ?? null, carregando: q?.isLoading ?? false };
    });
    return mapa;
  }, [acessoriosExtrasEmpresaIds, custoEstoqueExtraQueries]);

  // Cada acessório pode virar até 2 linhas de venda:
  //   1) a parte coberta pelo que ele já tem em mãos (saldo próprio, entregue
  //      pela empresa) — obrigatória, sem escolha, sempre repasse 'empresa'
  //      (regra: ele tem que usar o que já foi entregue antes de puxar de
  //      qualquer outro lugar, senão fica peça e dinheiro da empresa parados
  //      na mochila dele).
  //   2) a parte restante, se a quantidade pedida for maior que o saldo
  //      próprio — aí sim é uma escolha real: vem do estoque central da
  //      empresa, ou o instalador comprou essa sobra com o próprio dinheiro
  //      (nesse caso ele digita o que pagou, e o repasse 70/30 é dele).
  const acessoriosExtrasSelecionados = useMemo<AcessorioSelecionado[]>(() => {
    if (!catalogoAcessorios) return [];
    const itens: AcessorioSelecionado[] = [];

    catalogoAcessorios
      .filter((c) => quantidadesExtras[c.id] != null)
      .forEach((c) => {
        const qtd = quantidadesExtras[c.id] ?? 1;
        const saldoProprio = saldoInstaladorPorId[c.id] ?? 0;
        const qtdSaldoProprio = Math.min(qtd, saldoProprio);
        const qtdRestante = qtd - qtdSaldoProprio;

        if (qtdSaldoProprio > 0) {
          itens.push({
            ...montarItem(c, qtdSaldoProprio),
            // Prefere a média real do que o instalador recebeu; só cai pro
            // custo de referência do catálogo se essa média vier 0 (sinal de
            // que a entrega dele foi registrada sem custo, não que a peça é
            // de graça — ver comentário acima de acessoriosExtrasEmpresaIds).
            custo: custoMedioInstaladorPorId[c.id] || custoEstoqueExtraPorId[c.id]?.valor || 0,
            fornecedor: "empresa",
            // origemEstoque='instalador': precisa debitar do saldo próprio
            // dele (movimentacoes_suportes) na aprovação do serviço.
            origemEstoque: "instalador",
          });
        }

        if (qtdRestante > 0) {
          const fornecedorRestante = fornecedoresExtras[c.id];
          if (fornecedorRestante === "instalador") {
            const custoDigitado = parseFloat(custosCompraPropriaExtras[c.id] || "0") || 0;
            itens.push({
              ...montarItem(c, qtdRestante),
              custo: custoDigitado,
              fornecedor: "instalador",
              // origemEstoque='empresa': não é saldo rastreado em
              // movimentacoes_suportes (ele comprou por fora), nada a
              // debitar na aprovação além do repasse financeiro normal.
              origemEstoque: "empresa",
            });
          } else if (fornecedorRestante === "empresa") {
            itens.push({
              ...montarItem(c, qtdRestante),
              custo: custoEstoqueExtraPorId[c.id]?.valor ?? 0,
              fornecedor: "empresa",
              origemEstoque: "empresa",
            });
          }
          // Sem fornecedorRestante escolhido: não empurra linha nenhuma pro
          // restante — extraComProblema abaixo pega esse caso e bloqueia envio.
        }
      });

    return itens;
  }, [
    catalogoAcessorios,
    quantidadesExtras,
    fornecedoresExtras,
    custosCompraPropriaExtras,
    saldoInstaladorPorId,
    custoMedioInstaladorPorId,
    custoEstoqueExtraPorId,
  ]);

  // Acessório com sobra além do saldo próprio, sem fornecedor do restante
  // escolhido, sem estoque central pra cobrir o restante, ou sem custo
  // digitado pra sobra que ele diz ter comprado — bloqueia envio.
  const extraComProblema = (catalogoAcessorios ?? []).some((c) => {
    const qtd = quantidadesExtras[c.id];
    if (qtd == null) return false;
    const saldoProprio = saldoInstaladorPorId[c.id] ?? 0;
    const qtdRestante = qtd - Math.min(qtd, saldoProprio);
    if (qtdRestante <= 0) return false;

    const fornecedorRestante = fornecedoresExtras[c.id];
    if (!fornecedorRestante) return true;
    if (fornecedorRestante === "empresa") {
      return (saldoExtraPorId[c.id] ?? 0) < qtdRestante || custoEstoqueExtraPorId[c.id]?.valor == null;
    }
    return !custosCompraPropriaExtras[c.id]?.trim();
  });

  const extrasNovos = useMemo(
    () => acessoriosExtrasSelecionados.map(paraExtraServico),
    [acessoriosExtrasSelecionados],
  );

  const resumoExtrasNovos = useMemo(() => somarExtras(extrasNovos), [extrasNovos]);

  const ajustarQtdExtra = (catalogoId: string, delta: number) =>
    setQuantidadesExtras((q) => {
      const atual = q[catalogoId] ?? 0;
      const novo = atual + delta;
      const next = { ...q };
      if (novo <= 0) {
        delete next[catalogoId];
        setFornecedoresExtras((f) => { const n = { ...f }; delete n[catalogoId]; return n; });
        setCustosCompraPropriaExtras((c) => { const n = { ...c }; delete n[catalogoId]; return n; });
      } else next[catalogoId] = novo;
      return next;
    });

  const { data: itensParaDevolver } = useQuery({
    queryKey: ["estoque-a-devolver", servicoId],
    enabled: !!servicoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_a_devolver")
        .select("servico_id, catalogo_id, acessorio, qtd_fora")
        .eq("servico_id", servicoId);
      if (error) throw error;
      return (data || []) as ItemEstoqueDevolver[];
    },
  });

  const devolverEstoque = useMutation({
    mutationFn: async ({ catalogoId, quantidade }: { catalogoId: string; quantidade: number }) => {
      const { error } = await supabase.rpc("devolver_estoque_item", {
        p_servico_id: servicoId,
        p_catalogo_id: catalogoId,
        p_quantidade: quantidade,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque-a-devolver", servicoId] });
      toast({ title: "✅ Devolvido ao estoque" });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erro ao devolver",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    console.log("servicoId da URL:", servicoId);
    if (servicoId) {
      carregarServico();
    }
  }, [servicoId]);

  async function carregarServico() {
    try {
      console.log("Buscando serviço com ID:", servicoId);
      
      const { data, error } = await supabase
        .from("servicos")
        .select("*, clientes!servicos_cliente_id_fkey(*), cotacoes!servicos_cotacao_id_fkey(tv_cobertura)")
        .eq("id", servicoId)
        .maybeSingle();

      console.log("Resposta da query:", { data, error });

      if (error) {
        console.error("Erro na query:", error);
        throw error;
      }
      
      if (!data) {
        console.error("Nenhum serviço encontrado com ID:", servicoId);
        throw new Error("Serviço não encontrado");
      }
      
      setServico(data);
    } catch (error: any) {
      console.error("Erro ao carregar serviço:", error);
      toast({
        title: "❌ Erro ao carregar serviço",
        description: error.message || 'Desconhecido',
        variant: "destructive",
      });
      navigate("/instalador/minha-agenda");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (fotos.length < 3) {
      toast({
        title: "❌ Fotos insuficientes",
        description: "Envie pelo menos 3 fotos!",
        variant: "destructive",
      });
      return;
    }

    if (fotos.length > 10) {
      toast({
        title: "❌ Limite excedido",
        description: "Máximo de 10 fotos!",
        variant: "destructive",
      });
      return;
    }

    if (temReembolso && !notaFiscal) {
      toast({
        title: "❌ Nota fiscal obrigatória",
        description: "Anexe a nota fiscal para reembolso!",
        variant: "destructive",
      });
      return;
    }

    if (extraComProblema) {
      toast({
        title: "❌ Extras incompletos",
        description: "Escolha o fornecedor/custo de cada acessório extra antes de enviar.",
        variant: "destructive",
      });
      return;
    }

    if (teveAjudante && !instaladorAjudanteId) {
      toast({
        title: "❌ Selecione o instalador que ajudou",
        description: "Escolha na lista quem te ajudou, ou desmarque a opção.",
        variant: "destructive",
      });
      return;
    }

    if (suporteGarantiaComProblema) {
      toast({
        title: "❌ Garantia Total incompleta",
        description: usouSuporteGarantia === null
          ? "Informe se você usou o suporte fixo universal da empresa."
          : "Sem estoque registrado do suporte fixo universal — avise o admin antes de enviar.",
        variant: "destructive",
      });
      return;
    }

    setEnviando(true);

    try {
      // Comprimir e fazer upload das fotos
      const fotosPaths: string[] = [];
      for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i];
        
        // Comprimir imagem antes do upload
        const fotoComprimida = await comprimirImagem(foto, 0.7);
        const fileName = `${servicoId}/${Date.now()}_${i}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("fotos-servicos")
          .upload(fileName, fotoComprimida);

        if (uploadError) {
          if (uploadError.message?.includes('payload too large') || uploadError.message?.includes('file size')) {
            throw new Error(`Foto ${i + 1} muito grande. Máximo: 5MB`);
          }
          throw uploadError;
        }

        fotosPaths.push(fileName);
      }

      let notaFiscalPath = null;
      if (notaFiscal && temReembolso) {
        const nfFileName = `${servicoId}/nota_fiscal_${Date.now()}.pdf`;

        const { error: uploadError } = await supabase.storage.from("notas-fiscais").upload(nfFileName, notaFiscal);

        if (uploadError) throw uploadError;

        // Salva apenas o path, não a URL pública
        notaFiscalPath = nfFileName;
      }

      // Buscar o usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Extras (acessórios vendidos na finalização): a lista atual é a fonte da
      // verdade. Como um reenvio por correção recarrega o serviço já com os
      // campos flat somados da tentativa anterior, "descontaminamos" cada
      // agregado subtraindo o efeito dos acessorios_vendidos salvos antes de
      // somar os extras da tentativa atual — assim nunca dobra. Reembolso
      // (custo) e ganho (lucro) de cada extra vão para campos separados:
      // reembolso é custo puro, ganho é a fatia 70/30 do lucro (ver decomporExtra).
      //
      // acessorios_vendidos mistura itens da COTAÇÃO (custo real FIFO, gravados
      // na aprovação) com os vendidos NA finalização — sem discriminar, um
      // reenvio "descontaminava" e descartava os da cotação também. Só
      // descontaminamos/substituímos os marcados origem:'finalizacao'; os da
      // cotação (ou sem a marca, de registros antigos) ficam sempre preservados.
      const acessoriosAntigos = (servico.acessorios_vendidos || []) as typeof extrasNovos;
      const acessoriosCotacao = acessoriosAntigos.filter((a) => a.origem !== 'finalizacao');
      const acessoriosFinalizacaoAntigos = acessoriosAntigos.filter((a) => a.origem === 'finalizacao');

      const decompAntigos = somarDecomposicaoExtras(acessoriosFinalizacaoAntigos);
      const decompNovos = somarDecomposicaoExtras(extrasNovos);

      const reembDespesaBase = temReembolso
        ? parseFloat(valorReembolso || '0')
        : Math.max(0, (servico.valor_reembolso_despesas || 0) - decompAntigos.reembolso_instalador);
      const custoSuporteBase = Math.max(0, (servico.custo_suporte || 0) - decompAntigos.reembolso_empresa);
      const ganhoInstBase = Math.max(0, (servico.ganho_acessorios_instalador || 0) - decompAntigos.ganho_instalador);
      const ganhoEmpBase = Math.max(0, (servico.ganho_acessorios_empresa || 0) - decompAntigos.ganho_empresa);

      const reembInstFinal = reembDespesaBase + decompNovos.reembolso_instalador
      const custoSuporteFinal = custoSuporteBase + decompNovos.reembolso_empresa
      const ganhoInstFinal = ganhoInstBase + decompNovos.ganho_instalador
      const ganhoEmpFinal = ganhoEmpBase + decompNovos.ganho_empresa
      const valorEmpresaRecebeu = (servico.valor_mao_obra_instalador || 0) * 2
        + custoSuporteFinal + reembInstFinal + ganhoInstFinal + ganhoEmpFinal

      const { error: updateError } = await supabase
        .from("servicos")
        .update({
          status: "aguardando_aprovacao",
          fotos_conclusao: fotosPaths,
          nota_fiscal_url: notaFiscalPath,
          valor_reembolso_despesas: reembInstFinal,
          custo_suporte: custoSuporteFinal,
          ganho_acessorios_instalador: ganhoInstFinal,
          ganho_acessorios_empresa: ganhoEmpFinal,
          observacoes_instalador: observacoes,
          data_conclusao: new Date().toISOString(),
          recebimento_cliente: recebimentoCliente,
          // Ramo 'instalador': o campo já pede o TOTAL recebido do cliente
          // (rótulo abaixo deixa isso explícito), incluindo extras — não soma
          // nada por cima. Não precisa descontaminar: é digitado do zero a
          // cada envio (nunca pré-preenchido do banco), então nada se acumula.
          // Ramo 'empresa': valorEmpresaRecebeu já é reconstruído a partir dos
          // 4 agregados acima, que ESSES sim são descontaminados.
          valor_recebido_cliente: recebimentoCliente === 'instalador'
            ? parseFloat(valorRecebidoCliente || '0')
            : valorEmpresaRecebeu,
          acessorios_vendidos: [...acessoriosCotacao, ...extrasNovos],
          usou_suporte_garantia_total: isGarantiaTotal ? (usouSuporteGarantia ?? false) : false,
          // Ajudante: só um valor de referência (25% = metade da mão de obra
          // do principal), congelado agora. Não altera valor_mao_obra_instalador
          // nem o repasse real — ver comentário na migration 20260821120000.
          instalador_ajudante_id: teveAjudante && instaladorAjudanteId ? instaladorAjudanteId : null,
          valor_mao_obra_ajudante: teveAjudante && instaladorAjudanteId
            ? (servico.valor_mao_obra_instalador || 0) / 2
            : null,
        })
        .eq("id", servicoId)
        .eq("instalador_id", user.id)
        .in("status", ["atribuido", "em_andamento", "correcao_solicitada"]);

      if (updateError) throw updateError;

      toast({
        title: "✅ Serviço finalizado!",
        description: "Aguardando aprovação do gestor.",
      });
      navigate("/instalador/minha-agenda");
    } catch (error: any) {
      console.error("Erro:", error);
      toast({
        title: "❌ Erro ao finalizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setEnviando(false);
    }
  }

  if (loading) {
    return (
      <InstaladorLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Carregando...</div>
        </div>
      </InstaladorLayout>
    );
  }

  if (!servico) {
    return (
      <InstaladorLayout>
        <div className="text-center">
          <p className="text-red-600">Serviço não encontrado</p>
        </div>
      </InstaladorLayout>
    );
  }

  return (
    <InstaladorLayout>
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold mb-6">Finalizar Serviço</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">{servico.codigo}</h2>
          <p className="text-gray-600">Cliente: {servico.clientes.nome}</p>
          <p className="text-gray-600">Serviço: {servico.tipo_servico?.join(", ")}</p>
          <p className="text-green-600 font-bold">Valor: R$ {servico.valor_mao_obra_instalador?.toFixed(2)}</p>
        </div>

        {itensParaDevolver && itensParaDevolver.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-1">Sobrou algum acessório?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Devolução ao estoque é opcional e não impede a conclusão do serviço.
            </p>
            <div className="space-y-3">
              {itensParaDevolver.map((item) => {
                const quantidade = quantidadesDevolver[item.catalogo_id] ?? item.qtd_fora;
                const devolvendoEsteItem =
                  devolverEstoque.isPending &&
                  devolverEstoque.variables?.catalogoId === item.catalogo_id;
                return (
                  <div
                    key={item.catalogo_id}
                    className="flex items-center justify-between gap-3 border rounded-md p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.acessorio}</p>
                      <p className="text-xs text-muted-foreground">{item.qtd_fora} fora do estoque</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={quantidade}
                        onChange={(e) =>
                          setQuantidadesDevolver((prev) => ({
                            ...prev,
                            [item.catalogo_id]: Number(e.target.value),
                          }))
                        }
                        className="px-2 py-1 border rounded-md text-sm"
                      >
                        {Array.from({ length: item.qtd_fora + 1 }, (_, n) => n).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={quantidade === 0 || devolvendoEsteItem}
                        onClick={() =>
                          devolverEstoque.mutate({ catalogoId: item.catalogo_id, quantidade })
                        }
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700 disabled:bg-gray-300"
                      >
                        {devolvendoEsteItem ? "Devolvendo..." : "Devolver ao estoque"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {catalogoAcessorios && catalogoAcessorios.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-1">Vendeu algum acessório extra?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Itens vendidos na hora, fora do que já estava no orçamento. Opcional.
            </p>
            <div className="space-y-3">
              {catalogoAcessorios.map((item) => {
                const qtd = quantidadesExtras[item.id];
                const selecionado = qtd != null;
                const fornecedorRestante = fornecedoresExtras[item.id];
                const custoEmpresaInfo = custoEstoqueExtraPorId[item.id];
                const saldoProprio = saldoInstaladorPorId[item.id] ?? 0;
                const qtdSaldoProprio = Math.min(qtd ?? 0, saldoProprio);
                const qtdRestante = (qtd ?? 0) - qtdSaldoProprio;
                const semEstoqueParaRestante = (saldoExtraPorId[item.id] ?? 0) < qtdRestante;
                return (
                  <div key={item.id} className="border rounded-md p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">{formatarBRL(item.preco)} / un</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => ajustarQtdExtra(item.id, -1)}
                          disabled={!selecionado}
                          className="h-7 w-7 flex items-center justify-center border rounded-md disabled:opacity-40"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm">{qtd ?? 0}</span>
                        <button
                          type="button"
                          onClick={() => ajustarQtdExtra(item.id, 1)}
                          className="h-7 w-7 flex items-center justify-center border rounded-md"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {selecionado && (
                      <div className="mt-2 space-y-1.5">
                        {/* Parte obrigatória: sai do que ele já tem em mãos, sem
                            escolha — regra: usar o que a empresa já entregou
                            antes de puxar de qualquer outro lugar. */}
                        {qtdSaldoProprio > 0 && (
                          <p className="text-xs text-muted-foreground">
                            ✓ {qtdSaldoProprio} {qtdSaldoProprio === 1 ? "sai" : "saem"} do que você já tem em mãos
                            {" "}— custo {formatarBRL(custoMedioInstaladorPorId[item.id] ?? 0)}/un
                          </p>
                        )}

                        {/* Parte restante (só existe se pediu mais do que ele
                            tem em mãos): aqui sim é uma escolha real. */}
                        {qtdRestante > 0 && (
                          <>
                            <p className="text-xs text-muted-foreground">
                              {qtdSaldoProprio > 0
                                ? `Faltam ${qtdRestante} além do que você já tem — de onde vêm?`
                                : "De onde vem essa peça?"}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={semEstoqueParaRestante}
                                onClick={() => setFornecedoresExtras((f) => ({ ...f, [item.id]: "empresa" }))}
                                className={`h-7 px-3 rounded-md text-xs border disabled:opacity-40 ${fornecedorRestante === "empresa" ? "bg-blue-600 text-white border-blue-600" : ""}`}
                              >
                                Estoque da empresa
                              </button>
                              <button
                                type="button"
                                onClick={() => setFornecedoresExtras((f) => ({ ...f, [item.id]: "instalador" }))}
                                className={`h-7 px-3 rounded-md text-xs border ${fornecedorRestante === "instalador" ? "bg-blue-600 text-white border-blue-600" : ""}`}
                              >
                                Comprei por fora
                              </button>
                              {!fornecedorRestante && (
                                <span className="text-xs text-amber-600">Escolha uma opção</span>
                              )}
                            </div>

                            {semEstoqueParaRestante && (
                              <p className="text-xs text-amber-600">Sem estoque da empresa pra cobrir o restante</p>
                            )}

                            {fornecedorRestante === "empresa" && !semEstoqueParaRestante && (
                              <p className="text-xs text-muted-foreground">
                                {custoEmpresaInfo?.carregando
                                  ? "Buscando custo…"
                                  : custoEmpresaInfo?.valor != null
                                  ? `custo ${formatarBRL(custoEmpresaInfo.valor)}/un — do estoque`
                                  : "Custo indisponível — tente novamente"}
                              </p>
                            )}

                            {fornecedorRestante === "instalador" && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Quanto você pagou (total, {qtdRestante} un)?</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0,00"
                                  value={custosCompraPropriaExtras[item.id] ?? ""}
                                  onChange={(e) =>
                                    setCustosCompraPropriaExtras((c) => ({ ...c, [item.id]: e.target.value }))
                                  }
                                  className="w-24 h-7 px-2 border rounded-md text-xs"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {extrasNovos.length > 0 && (
              <div className="mt-4 border-t pt-3 space-y-1">
                {extrasNovos.map((e, idx) => (
                  <div key={`${e.catalogo_id}-${idx}`} className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {e.nome} (x{e.quantidade}{e.fornecedor === "instalador" ? ", comprou" : ""}) — lucro {formatarBRL(e.lucro)}
                    </span>
                    <span>você {formatarBRL(e.repasse_instalador)} · empresa {formatarBRL(e.repasse_empresa)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-1">
                  <span>Total extras (R$ {resumoExtrasNovos.totalVenda.toFixed(2)})</span>
                  <span>
                    você {formatarBRL(resumoExtrasNovos.totalInstalador)} · empresa{" "}
                    {formatarBRL(resumoExtrasNovos.totalEmpresa)}
                  </span>
                </div>
              </div>
            )}

            {extraComProblema && (
              <p className="mt-2 text-xs text-amber-600">
                Resolva o fornecedor/custo dos extras selecionados antes de enviar.
              </p>
            )}
          </div>
        )}

        {isGarantiaTotal && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-1">🛡️ Garantia Total — Suporte Fixo</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Este cliente está no plano Garantia Total. Você usou um suporte fixo universal da empresa nesta instalação?
            </p>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="suporte-garantia"
                  checked={usouSuporteGarantia === false}
                  onChange={() => setUsouSuporteGarantia(false)}
                  className="mr-2"
                />
                Não usei / cliente já tinha
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="suporte-garantia"
                  checked={usouSuporteGarantia === true}
                  onChange={() => setUsouSuporteGarantia(true)}
                  className="mr-2"
                />
                Sim, usei o suporte da empresa
              </label>
            </div>

            {usouSuporteGarantia === null && (
              <p className="text-xs text-amber-600 mt-2">Selecione uma opção antes de enviar.</p>
            )}

            {usouSuporteGarantia === true && (
              <p className="text-xs text-muted-foreground mt-2">
                {!catalogoSuporteGarantia
                  ? "⚠️ Item \"Suporte Fixo Universal\" não encontrado no catálogo — avise o admin."
                  : saldoSuporteGarantia <= 0
                  ? "⚠️ Sem estoque registrado deste suporte — avise o admin antes de enviar."
                  : carregandoCustoSuporteGarantia
                  ? "Buscando custo…"
                  : custoSuporteGarantia != null
                  ? `Custo ${formatarBRL(custoSuporteGarantia)} — será descontado como reembolso da empresa (sem afetar seu ganho), dividido igualmente entre você e a empresa na aprovação.`
                  : "Custo indisponível — tente novamente"}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">📸 Fotos do Serviço Concluído (3-10 fotos) *</label>
            <input
              type="file"
              multiple
              accept="image/*"
              required
              onChange={async (e) => {
                const arquivos = Array.from(e.target.files || []);
                setFotos(arquivos);
              }}
              className="w-full px-3 py-2 border rounded-md"
            />
            <div className="flex flex-wrap gap-2 mt-1">
              <p className="text-sm text-muted-foreground">
                {fotos.length} foto(s) selecionada(s)
              </p>
              {fotos.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  • Total: {formatarTamanho(fotos.reduce((acc, f) => acc + f.size, 0))}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              💡 As fotos serão comprimidas automaticamente antes do envio (máx 5MB cada)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Houve despesas a reembolsar?</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="reembolso"
                  checked={!temReembolso}
                  onChange={() => setTemReembolso(false)}
                  className="mr-2"
                />
                Não
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="reembolso"
                  checked={temReembolso}
                  onChange={() => setTemReembolso(true)}
                  className="mr-2"
                />
                Sim
              </label>
            </div>
          </div>

          {temReembolso && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">📄 Nota Fiscal (PDF ou Foto) *</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  required={temReembolso}
                  onChange={(e) => setNotaFiscal(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">💰 Valor do Reembolso (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required={temReembolso}
                  value={valorReembolso}
                  onChange={(e) => setValorReembolso(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="45.00"
                />
              </div>
            </>
          )}

          {/* Recebimento do cliente */}
          <div>
            <label className="block text-sm font-medium mb-2">💳 Quem recebeu o pagamento do cliente?</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="recebimento"
                  checked={recebimentoCliente === 'empresa'}
                  onChange={() => setRecebimentoCliente('empresa')}
                  className="mr-2"
                />
                Empresa vai receber
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="recebimento"
                  checked={recebimentoCliente === 'instalador'}
                  onChange={() => setRecebimentoCliente('instalador')}
                  className="mr-2"
                />
                Eu recebi do cliente
              </label>
            </div>
          </div>

          {recebimentoCliente === 'instalador' && (
            <div>
              <label className="block text-sm font-medium mb-2">💰 Valor TOTAL recebido do cliente (R$) *</label>
              <p className="text-xs text-muted-foreground mb-1">
                Inclua tudo que você recebeu em mãos, mesmo os acessórios extras vendidos acima.
              </p>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={valorRecebidoCliente}
                onChange={(e) => setValorRecebidoCliente(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="0.00"
              />
              {resumoExtrasNovos.totalVenda > 0 &&
                (parseFloat(valorRecebidoCliente || '0') < resumoExtrasNovos.totalVenda) && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Você marcou {formatarBRL(resumoExtrasNovos.totalVenda)} em acessórios extras —
                    confirme se o valor recebido já inclui esse total.
                  </p>
                )}
            </div>
          )}

          {/* Outro instalador ajudou */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={teveAjudante}
                onChange={(e) => {
                  setTeveAjudante(e.target.checked);
                  if (!e.target.checked) setInstaladorAjudanteId("");
                }}
                className="mr-2"
              />
              🤝 Outro instalador ajudou nesse serviço?
            </label>
            {teveAjudante && (
              <div className="mt-2">
                <select
                  required
                  value={instaladorAjudanteId}
                  onChange={(e) => setInstaladorAjudanteId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Selecione o instalador...</option>
                  {(outrosInstaladores || []).map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.nome}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  A mão de obra desse serviço fica dividida: 25% pra você, 25% pra ele.
                  O acerto dos 25% dele é combinado direto entre vocês — não muda o valor
                  que você recebe. Depois que o serviço for aprovado, isso não pode mais ser alterado.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">📝 Observações (opcional)</label>
            <textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Ex: Cliente pediu ajuste adicional..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate("/instalador/minha-agenda")}
              className="px-6 py-2 border rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {enviando ? "📤 Enviando..." : "✅ Finalizar Serviço"}
            </button>
          </div>
        </form>
      </div>
    </InstaladorLayout>
  );
}
