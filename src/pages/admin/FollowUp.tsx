import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Phone, MessageCircle, Clock, AlertTriangle, Users, PhoneCall, Search, Eye } from "lucide-react";
import { formatDistanceToNow, differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CotacaoPendente {
  id: string;
  created_at: string;
  tipo_servico: string[] | null;
  valor_estimado: number | null;
  cliente: {
    id: string;
    nome: string;
    telefone: string;
  };
  descricao_servico: string | null;
  contatos: {
    id: string;
    tipo_contato: string;
    observacoes: string | null;
    created_at: string;
    usuario_nome: string | null;
  }[];
}

export default function FollowUp() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filtroContato, setFiltroContato] = useState("todos");
  const [ordenacao, setOrdenacao] = useState("mais_antigos");
  const [modalOpen, setModalOpen] = useState(false);
  const [cotacaoSelecionada, setCotacaoSelecionada] = useState<CotacaoPendente | null>(null);
  const [tipoContato, setTipoContato] = useState("whatsapp");
  const [observacoes, setObservacoes] = useState("");
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [cotacaoDetalhes, setCotacaoDetalhes] = useState<CotacaoPendente | null>(null);

  // Fetch empresa_id
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

  // Fetch cotações pendentes with client and contact data
  const { data: cotacoes = [], isLoading } = useQuery({
    queryKey: ["followup-cotacoes", empresaId],
    queryFn: async () => {
      const { data: cotacoesData, error } = await supabase
        .from("cotacoes")
        .select(`
          id, created_at, tipo_servico, valor_estimado, descricao_servico,
          clientes!cotacoes_cliente_id_fkey(id, nome, telefone)
        `)
        .eq("empresa_id", empresaId!)
        .eq("status", "pendente")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const cotacaoIds = cotacoesData?.map((c: any) => c.id) || [];

      let contatosMap: Record<string, any[]> = {};
      if (cotacaoIds.length > 0) {
        const { data: contatosData } = await supabase
          .from("followup_contatos")
          .select("id, cotacao_id, tipo_contato, observacoes, created_at, usuario_id, usuarios!followup_contatos_usuario_id_fkey(nome)")
          .in("cotacao_id", cotacaoIds)
          .order("created_at", { ascending: false });

        (contatosData || []).forEach((c: any) => {
          if (!contatosMap[c.cotacao_id]) contatosMap[c.cotacao_id] = [];
          contatosMap[c.cotacao_id].push({
            ...c,
            usuario_nome: c.usuarios?.nome || null,
          });
        });
      }

      return (cotacoesData || []).map((c: any) => ({
        id: c.id,
        created_at: c.created_at,
        tipo_servico: c.tipo_servico,
        valor_estimado: c.valor_estimado,
        descricao_servico: c.descricao_servico,
        cliente: c.clientes,
        contatos: contatosMap[c.id] || [],
      })) as CotacaoPendente[];
    },
    enabled: !!empresaId,
  });

  // Register contact mutation
  const registrarContato = useMutation({
    mutationFn: async () => {
      if (!cotacaoSelecionada || !empresaId || !user?.id) return;
      const { error } = await supabase.from("followup_contatos").insert({
        cotacao_id: cotacaoSelecionada.id,
        empresa_id: empresaId,
        usuario_id: user.id,
        tipo_contato: tipoContato,
        observacoes: observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup-cotacoes"] });
      toast({ title: "Contato registrado com sucesso!" });
      setModalOpen(false);
      setObservacoes("");
      setCotacaoSelecionada(null);
    },
    onError: () => {
      toast({ title: "Erro ao registrar contato", variant: "destructive" });
    },
  });

  // Filter and sort
  const cotacoesFiltradas = useMemo(() => {
    let result = [...cotacoes];

    // Search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.cliente?.nome?.toLowerCase().includes(s) ||
          c.cliente?.telefone?.includes(s)
      );
    }

    // Filter by contact status
    if (filtroContato === "sem_contato") {
      result = result.filter((c) => c.contatos.length === 0);
    } else if (filtroContato === "7_dias") {
      result = result.filter((c) => {
        if (c.contatos.length === 0) return true;
        return differenceInDays(new Date(), new Date(c.contatos[0].created_at)) > 7;
      });
    } else if (filtroContato === "15_dias") {
      result = result.filter((c) => {
        if (c.contatos.length === 0) return true;
        return differenceInDays(new Date(), new Date(c.contatos[0].created_at)) > 15;
      });
    } else if (filtroContato === "30_dias") {
      result = result.filter((c) => {
        if (c.contatos.length === 0) return true;
        return differenceInDays(new Date(), new Date(c.contatos[0].created_at)) > 30;
      });
    }

    // Sort
    if (ordenacao === "mais_antigos") {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (ordenacao === "sem_contato") {
      result.sort((a, b) => a.contatos.length - b.contatos.length);
    } else if (ordenacao === "menos_contatos") {
      result.sort((a, b) => a.contatos.length - b.contatos.length);
    }

    return result;
  }, [cotacoes, search, filtroContato, ordenacao]);

  // Summary metrics
  const totalPendentes = cotacoes.length;
  const semContato = cotacoes.filter((c) => c.contatos.length === 0).length;
  const ultimoContato7dias = cotacoes.filter((c) => {
    if (c.contatos.length === 0) return true;
    return differenceInDays(new Date(), new Date(c.contatos[0].created_at)) > 7;
  }).length;
  const mediaDiasPendente =
    totalPendentes > 0
      ? Math.round(
          cotacoes.reduce((sum, c) => sum + differenceInDays(new Date(), new Date(c.created_at)), 0) /
            totalPendentes
        )
      : 0;

  function abrirWhatsApp(telefone: string, nome: string) {
    const tel = telefone.replace(/\D/g, "");
    const telFormatado = tel.startsWith("55") ? tel : `55${tel}`;
    const msg = encodeURIComponent(
      `Olá ${nome}! Tudo bem? Passando para saber se você ainda tem interesse no serviço que conversamos. Posso ajudar com alguma dúvida?`
    );
    window.open(`https://wa.me/${telFormatado}?text=${msg}`, "_blank");
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📞 Follow-Up</h1>
          <p className="text-gray-500 mt-1">Acompanhe cotações pendentes e registre contatos com clientes</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{totalPendentes}</p>
                  <p className="text-xs text-muted-foreground">Total Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{semContato}</p>
                  <p className="text-xs text-muted-foreground">Sem Contato</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{ultimoContato7dias}</p>
                  <p className="text-xs text-muted-foreground">&gt; 7 dias sem contato</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-2xl font-bold">{mediaDiasPendente}d</p>
                  <p className="text-xs text-muted-foreground">Média dias pendente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroContato} onValueChange={setFiltroContato}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por contato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="sem_contato">Sem contato</SelectItem>
              <SelectItem value="7_dias">&gt; 7 dias sem contato</SelectItem>
              <SelectItem value="15_dias">&gt; 15 dias sem contato</SelectItem>
              <SelectItem value="30_dias">&gt; 30 dias sem contato</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ordenacao} onValueChange={setOrdenacao}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mais_antigos">Mais antigos primeiro</SelectItem>
              <SelectItem value="sem_contato">Sem contato primeiro</SelectItem>
              <SelectItem value="menos_contatos">Menos contatos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : cotacoesFiltradas.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhuma cotação pendente encontrada
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden md:table-cell">Serviço</TableHead>
                      <TableHead>Criada há</TableHead>
                      <TableHead>Contatos</TableHead>
                      <TableHead className="hidden md:table-cell">Último Contato</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cotacoesFiltradas.map((cotacao) => {
                      const diasPendente = differenceInDays(new Date(), new Date(cotacao.created_at));
                      const ultimoContato = cotacao.contatos[0];

                      return (
                        <TableRow key={cotacao.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{cotacao.cliente?.nome}</p>
                              <p className="text-xs text-muted-foreground">{cotacao.cliente?.telefone}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {(cotacao.tipo_servico || ["A definir"]).map((t, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={diasPendente > 15 ? "destructive" : diasPendente > 7 ? "outline" : "secondary"}
                            >
                              {diasPendente}d
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={cotacao.contatos.length === 0 ? "destructive" : "secondary"}>
                              {cotacao.contatos.length}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {ultimoContato
                              ? formatDistanceToNow(new Date(ultimoContato.created_at), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })
                              : "Nenhum"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCotacaoSelecionada(cotacao);
                                  setModalOpen(true);
                                }}
                              >
                                <PhoneCall className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600"
                                onClick={() =>
                                  abrirWhatsApp(cotacao.cliente?.telefone || "", cotacao.cliente?.nome || "")
                                }
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Registrar Contato */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Contato</DialogTitle>
          </DialogHeader>
          {cotacaoSelecionada && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-medium">{cotacaoSelecionada.cliente?.nome}</p>
                <p className="text-sm text-muted-foreground">{cotacaoSelecionada.cliente?.telefone}</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Tipo de contato</label>
                <Select value={tipoContato} onValueChange={setTipoContato}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Observações</label>
                <Textarea
                  placeholder="O que foi conversado, resultado do contato..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Histórico de contatos */}
              {cotacaoSelecionada.contatos.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Histórico ({cotacaoSelecionada.contatos.length})</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {cotacaoSelecionada.contatos.map((c) => (
                      <div key={c.id} className="text-sm border-l-2 border-muted pl-3 py-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {c.tipo_contato}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        {c.observacoes && <p className="text-muted-foreground mt-1">{c.observacoes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => registrarContato.mutate()} disabled={registrarContato.isPending}>
              {registrarContato.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
