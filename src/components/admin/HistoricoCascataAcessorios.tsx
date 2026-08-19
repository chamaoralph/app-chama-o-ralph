// =====================================================================
// src/components/admin/HistoricoCascataAcessorios.tsx
// Aba "Resumo" do Controle de Acessórios.
//
// 1) Tabela "Quanto eu tenho agora" — resposta direta, sem clicar em
//    nada: por acessório, quanto está no estoque central (comigo) e
//    quanto está com instaladores (entregue e ainda não usado/devolvido).
// 2) Árvore clicável (Entrada → Estoque → instaladores), um passo de
//    cada vez — pedida pelo usuário num desenho: ENTRADA (clica pra ver
//    a lista de lançamentos) → ESTOQUE (saldo atual) → ramifica pra cada
//    instalador que já recebeu (clica pra ver recebido/usado/devolvido).
//
// Fórmulas:
//   Entrada total  = soma de estoque_lotes.quantidade — EXCETO qualquer lote
//                     criado por ajuste manual (observações começando com
//                     "Ajuste manual:" — devolução de acessório pelo
//                     instalador, contagem física do estoque central, etc).
//                     "Entrada" é só o que de fato entrou na empresa por
//                     compra (tem fornecedor) — ajuste não é compra, é
//                     correção de saldo. Esses lotes também não aparecem
//                     mais na lista expansível (pedido do usuário em
//                     2026-08-19 — antes só o total excluía a devolução do
//                     instalador, mas a lista continuava mostrando ela
//                     misturada com compras reais; ampliado pra qualquer
//                     "Ajuste manual:", já que o usuário passou a usar esse
//                     mecanismo também pra contagem física do central, não
//                     só devolução).
//   Estoque central = estoque_saldo.saldo (o que sobrou, nunca saiu)
//   Distribuído     = soma de movimentacoes_suportes tipo='entrega'
//   Vendido direto   = soma de estoque_movimentos tipo='baixa' com
//                     servico_id preenchido (venda em cotação que baixou
//                     direto do central, sem passar pela mochila de ninguém),
//                     MENOS devoluções com o mesmo servico_id (edição de
//                     cotação que reverte uma baixa já feita não é venda),
//                     E excluindo (catalogo_id, servico_id) que já tem um
//                     'uso' de instalador lançado — desde o fix de 12/08 no
//                     Aprovacoes.tsx, toda finalização com instalador
//                     atribuído lança 'uso', então uma baixa central com
//                     servico_id não significa mais "ninguém foi atribuído"
//                     (bug real encontrado e corrigido em 2026-08-13, ver
//                     memória do projeto — "Vendido direto" tava contando de
//                     novo unidades que já estavam corretamente atribuídas)
//   Por instalador: Recebido/Usado/Devolvido = soma de
//                     movimentacoes_suportes por tipo; Em mãos agora =
//                     Recebido - Usado - Devolvido
// =====================================================================

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Acessorio {
  id: string;
  nome: string;
}

interface Lote {
  catalogo_id: string;
  quantidade: number;
  data_compra: string;
  fornecedor: string | null;
  observacoes: string | null;
}

interface LinhaInstalador {
  instaladorId: string;
  nome: string;
  recebido: number;
  usado: number;
  devolvido: number;
  emMaos: number;
}

function Passo({
  children,
  aberto,
  onClick,
  destaque,
}: {
  children: React.ReactNode;
  aberto?: boolean;
  onClick?: () => void;
  destaque?: boolean;
}) {
  const Icone = onClick ? (aberto ? ChevronDown : ChevronRight) : null;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium ${
        destaque ? "border-primary/40 bg-primary/10" : "bg-card"
      } ${onClick ? "hover:bg-muted" : ""}`}
    >
      {children}
      {Icone && <Icone className="h-3.5 w-3.5 text-muted-foreground" />}
    </Tag>
  );
}

function Seta() {
  return <div className="ml-4 h-4 w-px bg-border" />;
}

export default function HistoricoCascataAcessorios() {
  const [entradaAberta, setEntradaAberta] = useState<Set<string>>(new Set());
  const [instaladorAberto, setInstaladorAberto] = useState<Set<string>>(new Set());

  const toggleEntrada = (itemId: string) =>
    setEntradaAberta((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

  const toggleInstalador = (chave: string) =>
    setInstaladorAberto((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });

  const { data: acessorios, isLoading: carregandoAcessorios } = useQuery({
    queryKey: ["cascata-acessorios-catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogo_servicos")
        .select("id, nome")
        .eq("categoria", "acessorios")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as Acessorio[];
    },
  });

  const { data: instaladores } = useQuery({
    queryKey: ["cascata-acessorios-instaladores"],
    queryFn: async () => {
      // sem filtro de ativo: instalador desligado pode ter histórico
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome")
        .eq("tipo", "instalador");
      if (error) throw error;
      return (data || []) as Acessorio[];
    },
  });

  const { data: lotes } = useQuery({
    queryKey: ["cascata-acessorios-lotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_lotes")
        .select("catalogo_id, quantidade, data_compra, fornecedor, observacoes")
        .order("data_compra", { ascending: false });
      if (error) throw error;
      return (data || []) as Lote[];
    },
  });

  const { data: saldosCentral } = useQuery({
    queryKey: ["cascata-acessorios-saldo-central"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estoque_saldo").select("catalogo_id, saldo");
      if (error) throw error;
      return (data || []) as { catalogo_id: string; saldo: number }[];
    },
  });

  const { data: movimentosCentral } = useQuery({
    queryKey: ["cascata-acessorios-movimentos-central"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_movimentos")
        .select("catalogo_id, tipo, quantidade, servico_id");
      if (error) throw error;
      return (data || []) as { catalogo_id: string; tipo: string; quantidade: number; servico_id: string | null }[];
    },
  });

  const { data: movSuportes, isLoading: carregandoMovSuportes } = useQuery({
    queryKey: ["cascata-acessorios-mov-suportes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes_suportes")
        .select("instalador_id, catalogo_id, tipo_movimento, quantidade, servico_id");
      if (error) throw error;
      return (data || []) as {
        instalador_id: string;
        catalogo_id: string | null;
        tipo_movimento: string;
        quantidade: number;
        servico_id: string | null;
      }[];
    },
  });

  const nomeInstalador = (id: string) =>
    instaladores?.find((i) => i.id === id)?.nome ?? "Instalador removido";

  // mesma convenção do resto da tela: movimentações sem catalogo_id (uso do
  // suporte próprio, baixado automaticamente na aprovação) caem no bucket do
  // item "Suporte Fixo Universal", quando ele existe no catálogo.
  const catalogoFixoUniversalId =
    acessorios?.find((a) => a.nome.toLowerCase().includes("suporte fixo universal"))?.id ?? null;

  const dados = useMemo(() => {
    const entrada: Record<string, number> = {};
    const lotesPorCatalogo: Record<string, Lote[]> = {};
    for (const l of lotes ?? []) {
      // Ajuste manual (devolução do instalador, contagem física do central,
      // etc) não é uma compra — não soma no total de Entrada nem aparece na
      // lista expansível, que agora só mostra lançamentos reais (ver
      // comentário da fórmula no topo).
      const ehAjusteManual = l.observacoes?.startsWith("Ajuste manual:");
      if (!ehAjusteManual) {
        entrada[l.catalogo_id] = (entrada[l.catalogo_id] ?? 0) + l.quantidade;
        (lotesPorCatalogo[l.catalogo_id] ??= []).push(l);
      }
    }

    const central: Record<string, number> = {};
    for (const s of saldosCentral ?? []) central[s.catalogo_id] = s.saldo;

    // net de baixa central por (catalogo_id, servico_id) — usado tanto pra
    // "Vendido direto" quanto pra saber se um 'uso' já foi "coberto" por uma
    // baixa central de verdade (peça saiu direto do central pro serviço,
    // nunca passou pela mochila do instalador) ou se realmente consumiu o
    // que ele tinha em mãos.
    const netBaixaPorServico: Record<string, number> = {};
    for (const m of movimentosCentral ?? []) {
      if (!m.servico_id) continue;
      const chave = `${m.catalogo_id}:${m.servico_id}`;
      const delta = m.tipo === "baixa" ? m.quantidade : m.tipo === "devolucao" ? -m.quantidade : 0;
      netBaixaPorServico[chave] = (netBaixaPorServico[chave] ?? 0) + delta;
    }

    // (catalogo_id:servico_id) que já tem pelo menos um 'uso' de instalador
    // lançado — usado pra excluir do "Vendido direto" as baixas que já foram
    // corretamente atribuídas a quem finalizou o serviço. Desde o fix de
    // 12/08 no Aprovacoes.tsx, toda finalização com instalador atribuído
    // lança 'uso' — então uma baixa central com servico_id deixou de
    // significar "ninguém foi atribuído" (ver comentário da fórmula no topo).
    const temUsoPorServico = new Set<string>();
    for (const m of movSuportes ?? []) {
      if (!m.catalogo_id || !m.servico_id || m.tipo_movimento !== "uso") continue;
      temUsoPorServico.add(`${m.catalogo_id}:${m.servico_id}`);
    }

    // "Vendido direto" precisa ser LÍQUIDO: uma edição de cotação pode reverter
    // uma baixa já feita (devolução com o mesmo servico_id) — contar só a baixa
    // sem descontar a devolução infla o total (bug real encontrado e corrigido
    // em 2026-08-12, ver memória do projeto). E precisa excluir os casos já
    // "cobertos" por um 'uso' (ver Set acima) — senão double-conta a mesma
    // unidade que já está corretamente na mão de quem finalizou (bug real
    // encontrado e corrigido em 2026-08-13).
    const vendidoDireto: Record<string, number> = {};
    for (const [chave, net] of Object.entries(netBaixaPorServico)) {
      if (net <= 0) continue;
      if (temUsoPorServico.has(chave)) continue;
      const [catalogoId] = chave.split(":");
      vendidoDireto[catalogoId] = (vendidoDireto[catalogoId] ?? 0) + net;
    }

    // Em mãos = Recebeu − Usou − Devolveu, sempre, sem exceção. Chegou a
    // existir uma distinção "usado coberto por baixa central" (peça que
    // teria ido direto do central pro serviço, sem passar pela mochila do
    // instalador) que excluía parte do "usado" dessa conta — usuário
    // rejeitou esse conceito em 2026-08-13 (confundia mais do que ajudava,
    // e na prática pra esse tipo de item o instalador sempre usa da própria
    // mochila) — ver memória do projeto. Removido; "usado" agora é sempre o
    // total, sem sub-bucket de cobertura.
    const porInstalador: Record<
      string,
      Record<string, { recebido: number; usado: number; devolvido: number }>
    > = {};
    for (const m of movSuportes ?? []) {
      const catalogoId = m.catalogo_id ?? catalogoFixoUniversalId;
      if (!catalogoId) continue; // sem como atribuir a nenhum item do catálogo

      if (!porInstalador[catalogoId]) porInstalador[catalogoId] = {};
      if (!porInstalador[catalogoId][m.instalador_id]) {
        porInstalador[catalogoId][m.instalador_id] = { recebido: 0, usado: 0, devolvido: 0 };
      }
      const bucket = porInstalador[catalogoId][m.instalador_id];

      if (m.tipo_movimento === "entrega") bucket.recebido += m.quantidade;
      else if (m.tipo_movimento === "uso") bucket.usado += m.quantidade;
      else if (m.tipo_movimento === "devolucao") bucket.devolvido += m.quantidade;
    }

    return { entrada, lotesPorCatalogo, central, vendidoDireto, porInstalador };
  }, [lotes, saldosCentral, movimentosCentral, movSuportes, catalogoFixoUniversalId]);

  const itens = useMemo(() => {
    return (acessorios ?? [])
      .map((a) => {
        const entrada = dados.entrada[a.id] ?? 0;
        const central = dados.central[a.id] ?? 0;
        const vendidoDireto = dados.vendidoDireto[a.id] ?? 0;
        const linhasInstaladores: LinhaInstalador[] = Object.entries(dados.porInstalador[a.id] ?? {})
          .map(([instaladorId, v]) => ({
            instaladorId,
            nome: nomeInstalador(instaladorId),
            recebido: v.recebido,
            usado: v.usado,
            devolvido: v.devolvido,
            // Em mãos = Recebeu − Usou − Devolveu. Clampado em 0 por
            // segurança (não existe "em mãos" negativo na tela, mesmo que a
            // conta interna dê negativo por dado histórico torto).
            emMaos: Math.max(0, v.recebido - v.usado - v.devolvido),
          }))
          // esconde quem só recebeu e devolveu de volta sem usar nada — hoje
          // não tem nada em mãos e não consumiu nada, então não interessa
          // pra "de onde veio, pra quem foi" (a movimentação em si continua
          // no banco, intacta, só não aparece aqui). Pedido do usuário
          // 2026-08-12, caso da Rayana/fechadura — ver memória do projeto.
          .filter((l) => l.usado !== 0 || l.emMaos !== 0)
          .sort((x, y) => y.recebido - x.recebido);
        const totalEmMaosInstaladores = linhasInstaladores.reduce((s, l) => s + l.emMaos, 0);
        return {
          id: a.id,
          nome: a.nome,
          entrada,
          central,
          vendidoDireto,
          lotes: dados.lotesPorCatalogo[a.id] ?? [],
          linhasInstaladores,
          totalEmMaosInstaladores,
          // saldo real disponível agora: o que ainda não foi usado nem virou
          // venda — soma o que sobra no central com o que tá na mochila de
          // cada instalador (já descontado uso/devolução)
          saldoTotal: central + totalEmMaosInstaladores,
        };
      })
      .filter((i) => i.entrada !== 0 || i.central !== 0 || i.linhasInstaladores.length > 0 || i.vendidoDireto !== 0)
      .sort((a, b) => a.nome.localeCompare(b.nome));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acessorios, dados, instaladores]);

  if (carregandoAcessorios || carregandoMovSuportes) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhuma movimentação de acessórios ainda.
      </p>
    );
  }

  const totalGeralComigo = itens.reduce((s, i) => s + i.central, 0);
  const totalGeralComInstaladores = itens.reduce((s, i) => s + i.totalEmMaosInstaladores, 0);

  return (
    <div className="space-y-8">
      {/* Resposta direta: quanto tem no estoque central (comigo) x com instaladores */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Quanto eu tenho agora</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Acessório</TableHead>
              <TableHead className="text-center">Em estoque comigo</TableHead>
              <TableHead className="text-center">Com instaladores</TableHead>
              <TableHead className="text-center">Total disponível</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.nome}</TableCell>
                <TableCell className="text-center">
                  <span className="text-base font-bold">{item.central}</span>
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {item.totalEmMaosInstaladores}
                </TableCell>
                <TableCell className="text-center font-semibold">{item.saldoTotal}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="text-center">{totalGeralComigo}</TableCell>
              <TableCell className="text-center">{totalGeralComInstaladores}</TableCell>
              <TableCell className="text-center">{totalGeralComigo + totalGeralComInstaladores}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="mt-2 text-xs text-muted-foreground">
          "Em estoque comigo" é o que está fisicamente no seu estoque central agora — não passou por
          nenhum instalador. "Com instaladores" é o que já foi entregue e ainda não foi usado nem devolvido.
        </p>
      </div>

      {/* Árvore: Entrada → Estoque → instaladores, um passo de cada vez */}
      <div>
        <h3 className="mb-1 text-sm font-semibold">De onde veio, pra quem foi</h3>
        <p className="mb-3 text-xs text-muted-foreground">Clique em cada caixa pra abrir o próximo nível.</p>

        <div className="space-y-6">
          {itens.map((item) => {
            const entradaAbertaAqui = entradaAberta.has(item.id);
            return (
              <div key={item.id} className="rounded-lg border p-4">
                <h4 className="mb-3 font-semibold">{item.nome}</h4>

                {/* Passo 1: Entrada */}
                <Passo aberto={entradaAbertaAqui} onClick={() => toggleEntrada(item.id)}>
                  Entrada: {item.entrada} un
                </Passo>
                {entradaAbertaAqui && (
                  <div className="ml-4 mt-1 border-l pl-3">
                    {item.lotes.length === 0 ? (
                      <p className="py-1 text-xs text-muted-foreground">Nenhum lançamento registrado.</p>
                    ) : (
                      <ul className="space-y-1 py-1 text-xs text-muted-foreground">
                        {item.lotes.map((l, idx) => (
                          <li key={idx}>
                            {format(parseISO(l.data_compra), "dd/MM/yyyy", { locale: ptBR })} — {l.quantidade} un
                            {l.fornecedor && ` · ${l.fornecedor}`}
                            {l.observacoes && ` · ${l.observacoes}`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <Seta />

                {/* Passo 2: Estoque central */}
                <Passo destaque>Estoque comigo: {item.central} un</Passo>

                <Seta />

                {/* Passo 3: ramifica pros instaladores */}
                {item.linhasInstaladores.length === 0 && item.vendidoDireto === 0 ? (
                  <p className="text-sm text-muted-foreground">Ainda não foi entregue a nenhum instalador.</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {item.linhasInstaladores.map((l) => {
                      const chave = `${item.id}:${l.instaladorId}`;
                      const aberto = instaladorAberto.has(chave);
                      return (
                        <div key={l.instaladorId} className="flex flex-col items-center">
                          <Passo aberto={aberto} onClick={() => toggleInstalador(chave)}>
                            {l.nome}
                            <Badge variant={l.emMaos > 0 ? "default" : "secondary"} className="ml-1">
                              {l.emMaos}
                            </Badge>
                          </Passo>
                          {aberto && (
                            <div className="mt-1 rounded-md border bg-muted/30 px-3 py-1.5 text-center text-xs text-muted-foreground">
                              Recebeu {l.recebido} · Usou {l.usado} · Devolveu {l.devolvido}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {item.vendidoDireto > 0 && (
                      <Passo>
                        Vendido direto (sem instalador)
                        <Badge variant="secondary" className="ml-1">
                          {item.vendidoDireto}
                        </Badge>
                      </Passo>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
