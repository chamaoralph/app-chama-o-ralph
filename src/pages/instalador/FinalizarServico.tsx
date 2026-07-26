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

  // --- Extras (acessórios vendidos na finalização) ---
  const [quantidadesExtras, setQuantidadesExtras] = useState<Record<string, number>>({});
  const [fornecedoresExtras, setFornecedoresExtras] = useState<Record<string, Fornecedor>>({});
  const [custosInstaladorExtras, setCustosInstaladorExtras] = useState<Record<string, string>>({});

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

  const acessoriosExtrasEmpresaIds = useMemo(() => {
    if (!catalogoAcessorios) return [];
    return catalogoAcessorios
      .filter((c) => quantidadesExtras[c.id] != null && fornecedoresExtras[c.id] === "empresa")
      .map((c) => c.id);
  }, [catalogoAcessorios, quantidadesExtras, fornecedoresExtras]);

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

  const acessoriosExtrasSelecionados = useMemo<AcessorioSelecionado[]>(() => {
    if (!catalogoAcessorios) return [];
    return catalogoAcessorios
      .filter((c) => quantidadesExtras[c.id] != null)
      .map((c) => {
        const fornecedor = fornecedoresExtras[c.id] as Fornecedor;
        const custo =
          fornecedor === "instalador"
            ? parseFloat(custosInstaladorExtras[c.id] || "0") || 0
            : custoEstoqueExtraPorId[c.id]?.valor ?? 0;
        return { ...montarItem(c, quantidadesExtras[c.id] ?? 1), custo, fornecedor };
      });
  }, [catalogoAcessorios, quantidadesExtras, fornecedoresExtras, custosInstaladorExtras, custoEstoqueExtraPorId]);

  // Acessório sem fornecedor escolhido, sem estoque (empresa) ou sem custo digitado (instalador) — bloqueia envio
  const extraComProblema = acessoriosExtrasSelecionados.some((a) => {
    if (!a.fornecedor) return true;
    if (a.fornecedor === "empresa") {
      return (saldoExtraPorId[a.catalogo_id] ?? 0) <= 0 || custoEstoqueExtraPorId[a.catalogo_id]?.valor == null;
    }
    return !custosInstaladorExtras[a.catalogo_id]?.trim();
  });

  const extrasNovos = useMemo(
    () => acessoriosExtrasSelecionados.filter((a) => a.fornecedor).map(paraExtraServico),
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
        setCustosInstaladorExtras((c) => { const n = { ...c }; delete n[catalogoId]; return n; });
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
        .select("*, clientes!servicos_cliente_id_fkey(*)")
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
      const decompAntigos = somarDecomposicaoExtras((servico.acessorios_vendidos || []) as typeof extrasNovos);
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
          acessorios_vendidos: extrasNovos,
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
                const fornecedorEscolhido = fornecedoresExtras[item.id];
                const semEstoque = (saldoExtraPorId[item.id] ?? 0) <= 0;
                const custoEmpresaInfo = custoEstoqueExtraPorId[item.id];
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
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={semEstoque}
                            onClick={() => setFornecedoresExtras((f) => ({ ...f, [item.id]: "empresa" }))}
                            className={`h-7 px-3 rounded-md text-xs border disabled:opacity-40 ${fornecedorEscolhido === "empresa" ? "bg-blue-600 text-white border-blue-600" : ""}`}
                          >
                            Empresa
                          </button>
                          <button
                            type="button"
                            onClick={() => setFornecedoresExtras((f) => ({ ...f, [item.id]: "instalador" }))}
                            className={`h-7 px-3 rounded-md text-xs border ${fornecedorEscolhido === "instalador" ? "bg-blue-600 text-white border-blue-600" : ""}`}
                          >
                            Eu forneci
                          </button>
                          {!fornecedorEscolhido && (
                            <span className="text-xs text-amber-600">Escolha quem forneceu</span>
                          )}
                        </div>

                        {semEstoque && (
                          <p className="text-xs text-amber-600">Sem estoque — venda apenas se você forneceu</p>
                        )}

                        {fornecedorEscolhido === "empresa" && !semEstoque && (
                          <p className="text-xs text-muted-foreground">
                            {custoEmpresaInfo?.carregando
                              ? "Buscando custo…"
                              : custoEmpresaInfo?.valor != null
                              ? `custo ${formatarBRL(custoEmpresaInfo.valor)} — do estoque`
                              : "Custo indisponível — tente novamente"}
                          </p>
                        )}

                        {fornecedorEscolhido === "instalador" && (
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">Custo que você pagou (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={custosInstaladorExtras[item.id] ?? ""}
                              onChange={(e) =>
                                setCustosInstaladorExtras((c) => ({ ...c, [item.id]: e.target.value }))
                              }
                              className="h-7 w-24 border rounded-md px-2 text-right text-sm"
                              placeholder="0,00"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {extrasNovos.length > 0 && (
              <div className="mt-4 border-t pt-3 space-y-1">
                {extrasNovos.map((e) => (
                  <div key={e.catalogo_id} className="flex justify-between text-xs text-muted-foreground">
                    <span>{e.nome} — lucro {formatarBRL(e.lucro)}</span>
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
