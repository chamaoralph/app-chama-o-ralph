import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Send, TrendingUp, FileText, CheckCircle2, DollarSign, UserX, MessageCircle, Star } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarBRL } from "@/lib/orcamento";

interface UpsellResultado {
  avaliacao_id: string;
  empresa_id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string;
  nota: number | null;
  upsell_enviado_em: string;
  dias_desde_envio: number | null;
  upsell_reacao: string | null;
  upsell_reacao_em: string | null;
  nao_perturbe: boolean;
  cotacao_gerada_id: string | null;
  cotacao_gerada_em: string | null;
  cotacao_gerada_valor: number | null;
  cotacao_gerada_status: string | null;
}

const REACAO_OPTIONS: { value: string; label: string }[] = [
  { value: "sem_resposta", label: "Sem resposta" },
  { value: "respondeu", label: "Respondeu" },
  { value: "orcamento", label: "Pediu orçamento" },
  { value: "fechou", label: "Fechou" },
  { value: "opt_out", label: "Pediu para sair" },
];

function labelReacao(reacao: string | null): string {
  if (!reacao) return "—";
  return REACAO_OPTIONS.find((o) => o.value === reacao)?.label ?? reacao;
}

function labelStatusCotacao(status: string | null): string {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    termo_pendente: "Termo pendente",
    aprovada: "Aprovada",
    perdida: "Perdida",
    sem_resposta: "Sem resposta",
    nao_gerou: "Não gerou",
  };
  return status ? labels[status] ?? status : "—";
}

export default function Upsell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [filtroReacao, setFiltroReacao] = useState("todas");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");

  const [cotacaoDetalhe, setCotacaoDetalhe] = useState<UpsellResultado | null>(null);
  const [optOutPendente, setOptOutPendente] = useState<UpsellResultado | null>(null);

  const { data: empresaId } = useQuery({
    queryKey: ["empresa-id", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("usuarios")
        .select("empresa_id")
        .eq("id", user!.id)
        .single();
      return data?.empresa_id;
    },
    enabled: !!user?.id,
  });

  const { data: resultados = [], isLoading } = useQuery({
    queryKey: ["upsell-resultados", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_upsell_resultados" as any)
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("upsell_enviado_em", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as UpsellResultado[];
    },
    enabled: !!empresaId,
  });

  const marcarReacao = useMutation({
    mutationFn: async ({ avaliacaoId, reacao }: { avaliacaoId: string; reacao: string }) => {
      const { error } = await supabase.rpc("marcar_reacao_upsell" as any, {
        p_avaliacao_id: avaliacaoId,
        p_reacao: reacao,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["upsell-resultados"] });
      toast({ title: "Reação atualizada" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar reação", variant: "destructive" });
    },
  });

  function handleMudarReacao(row: UpsellResultado, novaReacao: string) {
    if (novaReacao === "opt_out") {
      setOptOutPendente(row);
      return;
    }
    marcarReacao.mutate({ avaliacaoId: row.avaliacao_id, reacao: novaReacao });
  }

  function confirmarOptOut() {
    if (!optOutPendente) return;
    marcarReacao.mutate({ avaliacaoId: optOutPendente.avaliacao_id, reacao: "opt_out" });
    setOptOutPendente(null);
  }

  function abrirWhatsApp(telefone: string, nome: string) {
    const tel = (telefone || "").replace(/\D/g, "");
    const telFormatado = tel.startsWith("55") ? tel : `55${tel}`;
    return `https://wa.me/${telFormatado}?text=${encodeURIComponent(`Olá ${nome}!`)}`;
  }

  const resultadosFiltrados = useMemo(() => {
    let result = [...resultados];

    if (filtroReacao === "sem_reacao") {
      result = result.filter((r) => !r.upsell_reacao);
    } else if (filtroReacao !== "todas") {
      result = result.filter((r) => r.upsell_reacao === filtroReacao);
    }

    if (dataDe) {
      const de = new Date(dataDe);
      result = result.filter((r) => new Date(r.upsell_enviado_em) >= de);
    }
    if (dataAte) {
      const ate = new Date(dataAte);
      ate.setHours(23, 59, 59, 999);
      result = result.filter((r) => new Date(r.upsell_enviado_em) <= ate);
    }

    result.sort((a, b) => new Date(b.upsell_enviado_em).getTime() - new Date(a.upsell_enviado_em).getTime());

    return result;
  }, [resultados, filtroReacao, dataDe, dataAte]);

  const stats = useMemo(() => {
    const enviados = resultados.length;
    const responderam = resultados.filter(
      (r) => r.upsell_reacao != null && r.upsell_reacao !== "sem_resposta"
    ).length;
    const orcamentosGerados = resultados.filter((r) => r.cotacao_gerada_id != null).length;
    const fechados = resultados.filter((r) => r.cotacao_gerada_status === "aprovada").length;
    const receitaGerada = resultados
      .filter((r) => r.cotacao_gerada_status === "aprovada")
      .reduce((sum, r) => sum + (r.cotacao_gerada_valor || 0), 0);
    const optOuts = resultados.filter((r) => r.nao_perturbe).length;

    return {
      enviados,
      taxaResposta: enviados > 0 ? (responderam / enviados) * 100 : 0,
      orcamentosGerados,
      fechados,
      receitaGerada,
      optOuts,
    };
  }, [resultados]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📈 Upsell D+30</h1>
          <p className="text-gray-500 mt-1">
            Acompanhe as respostas dos clientes que receberam a mensagem de upsell após a avaliação
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{stats.enviados}</p>
                  <p className="text-xs text-muted-foreground">Enviados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{stats.taxaResposta.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">Taxa de resposta</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{stats.orcamentosGerados}</p>
                  <p className="text-xs text-muted-foreground">Orçamentos gerados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{stats.fechados}</p>
                  <p className="text-xs text-muted-foreground">Fechados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-700 shrink-0" />
                <div>
                  <p className="text-lg font-bold">{formatarBRL(stats.receitaGerada)}</p>
                  <p className="text-xs text-muted-foreground">Receita gerada</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <UserX className="h-5 w-5 text-red-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{stats.optOuts}</p>
                  <p className="text-xs text-muted-foreground">Opt-outs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <Label className="text-sm font-medium mb-1 block">Reação</Label>
            <Select value={filtroReacao} onValueChange={setFiltroReacao}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="sem_reacao">Sem reação registrada</SelectItem>
                {REACAO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-sm font-medium mb-1 block">Envio de</Label>
            <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label className="text-sm font-medium mb-1 block">Envio até</Label>
            <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
          </div>
        </div>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : resultadosFiltrados.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum upsell enviado encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Envio</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead>Nota</TableHead>
                      <TableHead>Reação</TableHead>
                      <TableHead>Cotação gerada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultadosFiltrados.map((row) => (
                      <TableRow key={row.avaliacao_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{row.cliente_nome}</p>
                            {row.nao_perturbe && (
                              <Badge variant="destructive" className="text-xs mt-1">
                                Não perturbar
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <a
                            href={abrirWhatsApp(row.cliente_telefone, row.cliente_nome)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-green-600 hover:underline flex items-center gap-1 whitespace-nowrap"
                          >
                            <MessageCircle className="h-4 w-4" />
                            {row.cliente_telefone}
                          </a>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(row.upsell_enviado_em), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.dias_desde_envio ?? "—"}d</Badge>
                        </TableCell>
                        <TableCell>
                          {row.nota != null ? (
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                              <span className="text-sm font-medium">{row.nota}</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.upsell_reacao ?? undefined}
                            onValueChange={(v) => handleMudarReacao(row, v)}
                          >
                            <SelectTrigger className="w-[170px]">
                              <SelectValue placeholder="Sem reação" />
                            </SelectTrigger>
                            <SelectContent>
                              {REACAO_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {row.cotacao_gerada_id ? (
                            <Badge
                              variant="secondary"
                              className="cursor-pointer hover:bg-secondary/70"
                              onClick={() => setCotacaoDetalhe(row)}
                            >
                              {row.cotacao_gerada_valor != null
                                ? formatarBRL(row.cotacao_gerada_valor)
                                : "Ver"}{" "}
                              · {labelStatusCotacao(row.cotacao_gerada_status)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmação de opt-out */}
      <AlertDialog open={!!optOutPendente} onOpenChange={(open) => !open && setOptOutPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar "Pediu para sair"?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso marca <strong>{optOutPendente?.cliente_nome}</strong> como "não perturbar" — ele nunca mais
              entrará na fila de upsell. Essa ação é permanente e não pode ser desfeita pela tela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarOptOut} className="bg-destructive hover:bg-destructive/90">
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detalhe da cotação gerada */}
      <Dialog open={!!cotacaoDetalhe} onOpenChange={(open) => !open && setCotacaoDetalhe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cotação gerada pelo upsell</DialogTitle>
          </DialogHeader>
          {cotacaoDetalhe && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Cliente: </span>
                {cotacaoDetalhe.cliente_nome}
              </p>
              <p>
                <span className="text-muted-foreground">Valor: </span>
                {cotacaoDetalhe.cotacao_gerada_valor != null
                  ? formatarBRL(cotacaoDetalhe.cotacao_gerada_valor)
                  : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Status: </span>
                {labelStatusCotacao(cotacaoDetalhe.cotacao_gerada_status)}
              </p>
              <p>
                <span className="text-muted-foreground">Criada em: </span>
                {cotacaoDetalhe.cotacao_gerada_em
                  ? format(new Date(cotacaoDetalhe.cotacao_gerada_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground pt-2">
                Para editar essa cotação, procure pelo cliente em Cotações.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
