import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MessageSquare, Clock, Filter } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Avaliacao {
  id: string;
  servico_id: string;
  nota: number | null;
  comentario: string | null;
  status: string;
  publicada: boolean;
  enviado_em: string | null;
  respondido_em: string | null;
  created_at: string;
  servico?: { codigo: string; instalador_id: string | null };
  cliente?: { nome: string };
  instalador_nome?: string;
}

export default function Avaliacoes() {
  const { user } = useAuth();
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [stats, setStats] = useState({ total: 0, media: 0, respondidas: 0, pendentes: 0 });

  useEffect(() => {
    if (user?.id) fetchAvaliacoes();
  }, [user?.id, filtroStatus]);

  async function fetchAvaliacoes() {
    setLoading(true);
    try {
      const { data: userData } = await supabase
        .from("usuarios")
        .select("empresa_id")
        .eq("id", user!.id)
        .single();

      if (!userData) return;

      let query = supabase
        .from("avaliacoes")
        .select("*")
        .eq("empresa_id", userData.empresa_id)
        .order("created_at", { ascending: false });

      if (filtroStatus === "publicadas") {
        query = query.eq("publicada", true);
      } else if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Buscar dados relacionados
      const servicoIds = (data || []).map((a: any) => a.servico_id);
      const clienteIds = (data || []).map((a: any) => a.cliente_id);

      const [servicosRes, clientesRes] = await Promise.all([
        supabase.from("servicos").select("id, codigo, instalador_id").in("id", servicoIds),
        supabase.from("clientes").select("id, nome").in("id", clienteIds),
      ]);

      const instaladorIds = (servicosRes.data || [])
        .map((s: any) => s.instalador_id)
        .filter(Boolean);

      const instaladoresRes = instaladorIds.length > 0
        ? await supabase.from("usuarios").select("id, nome").in("id", instaladorIds)
        : { data: [] };

      const servicosMap = Object.fromEntries((servicosRes.data || []).map((s: any) => [s.id, s]));
      const clientesMap = Object.fromEntries((clientesRes.data || []).map((c: any) => [c.id, c]));
      const instaladoresMap = Object.fromEntries((instaladoresRes.data || []).map((i: any) => [i.id, i]));

      const enriched = (data || []).map((a: any) => {
        const servico = servicosMap[a.servico_id];
        const cliente = clientesMap[a.cliente_id];
        const instalador = servico?.instalador_id ? instaladoresMap[servico.instalador_id] : null;
        return {
          ...a,
          servico,
          cliente,
          instalador_nome: instalador?.nome || "Não atribuído",
        };
      });

      setAvaliacoes(enriched);

      // Stats
      const todas = enriched;
      const comNota = todas.filter((a: any) => a.nota != null);
      setStats({
        total: todas.length,
        media: comNota.length > 0
          ? comNota.reduce((acc: number, a: any) => acc + a.nota, 0) / comNota.length
          : 0,
        respondidas: todas.filter((a: any) => a.status === "respondida").length,
        pendentes: todas.filter((a: any) => a.status === "pendente").length,
      });
    } catch (err) {
      console.error("Erro ao buscar avaliações:", err);
      toast.error("Erro ao carregar avaliações");
    } finally {
      setLoading(false);
    }
  }

  async function togglePublicada(id: string, current: boolean) {
    const { error } = await supabase
      .from("avaliacoes")
      .update({ publicada: !current })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    setAvaliacoes((prev) =>
      prev.map((a) => (a.id === id ? { ...a, publicada: !current } : a))
    );
    toast.success(!current ? "Avaliação publicada" : "Publicação removida");
  }

  function statusBadge(status: string) {
    switch (status) {
      case "pendente":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">⏳ Pendente</Badge>;
      case "respondida":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✅ Respondida</Badge>;
      case "nao_avaliou":
        return <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">⏱️ Não avaliou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function renderStars(nota: number | null) {
    if (nota == null) return <span className="text-muted-foreground text-sm">—</span>;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i <= nota ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
          />
        ))}
        <span className="ml-1 text-sm font-medium">{nota}</span>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Avaliações</h1>
          <p className="text-muted-foreground">Feedback dos clientes sobre os serviços</p>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Nota Média</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                <span className="text-2xl font-bold">{stats.media.toFixed(1)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-4 w-4" /> Respondidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.respondidas}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" /> Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pendentes}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtro */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="respondida">Respondidas</SelectItem>
              <SelectItem value="nao_avaliou">Não avaliou</SelectItem>
              <SelectItem value="publicadas">Publicadas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Carregando...</div>
        ) : avaliacoes.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            Nenhuma avaliação encontrada
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Instalador</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comentário</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Publicada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {avaliacoes.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">
                      {a.servico?.codigo || "—"}
                    </TableCell>
                    <TableCell>{a.cliente?.nome || "—"}</TableCell>
                    <TableCell>{a.instalador_nome}</TableCell>
                    <TableCell>{renderStars(a.nota)}</TableCell>
                    <TableCell>{statusBadge(a.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {a.comentario || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(a.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={a.publicada}
                        onCheckedChange={() => togglePublicada(a.id, a.publicada)}
                        disabled={a.status === "pendente"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
