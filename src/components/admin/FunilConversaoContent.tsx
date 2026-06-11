import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp, Users, Target, DollarSign, ArrowDown, Percent, CalendarIcon, Receipt,
  MousePointerClick, Eye, BarChart3, RefreshCw, Clock, CheckCircle2, ExternalLink, ChevronRight
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MetricasLineChart } from "./MetricasLineChart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunnelData {
  investimento: number;
  leads: number;
  agendados: number;
  receita: number;
  totalAgendados: number;
  cpl: number;
  cpc: number;
  roas: number;
  taxaConversao: number;
  ticketMedio: number;
  clicks: number;
  impressions: number;
  ctr: number;
}

interface DailyData {
  data: string;
  dataLabel: string;
  investimento: number;
  leads: number;
  conversoes: number;
  receita: number;
  clicks: number;
  impressions: number;
  conversoesGoogle: number;
  totalAgendados: number;
}

interface CotacaoDetalhe {
  id: string;
  status: string;
  created_at: string;
  origem_lead: string | null;
  valor_estimado?: number | null;
  tvs_itens?: Array<{ valor_mao_obra?: number }> | null;
  clientes: {
    nome: string;
    telefone: string | null;
    bairro: string | null;
  } | null;
}

interface ServicoDetalhe {
  id: string;
  cotacao_id: string | null;
  valor_total: number;
  valor_mao_obra: number;
  status: string;
  data_servico_agendada: string | null;
  data_conclusao: string | null;
  nome_cliente: string;
  bairro: string | null;
}

type DrawerTipo = "google_conv" | "leads" | "agendados" | "receita" | null;

// ─── Constantes ───────────────────────────────────────────────────────────────

const ORIGENS_LEAD = [
  { value: "todos", label: "Todos" },
  { value: "google", label: "Google" },
  { value: "indicação", label: "Indicação" },
  { value: "instagram", label: "Instagram" },
  { value: "já era cliente", label: "Já era cliente" },
  { value: "importação", label: "Importação" },
  { value: "whatsapp auto", label: "WhatsApp Auto" },
];

const FAIXAS_HORARIAS = [
  { faixa: "6h-8h", inicio: 6, fim: 8 },
  { faixa: "8h-10h", inicio: 8, fim: 10 },
  { faixa: "10h-12h", inicio: 10, fim: 12 },
  { faixa: "12h-14h", inicio: 12, fim: 14 },
  { faixa: "14h-16h", inicio: 14, fim: 16 },
  { faixa: "16h-18h", inicio: 16, fim: 18 },
  { faixa: "18h-20h", inicio: 18, fim: 20 },
  { faixa: "20h-22h", inicio: 20, fim: 22 },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente:            { label: "Pendente",          cls: "bg-yellow-100 text-yellow-800" },
  aprovada:            { label: "Aprovada",           cls: "bg-green-100 text-green-800" },
  reprovada:           { label: "Reprovada",          cls: "bg-red-100 text-red-800" },
  perdida:             { label: "Perdida",            cls: "bg-gray-100 text-gray-700" },
  nao_gerou:           { label: "Não gerou",          cls: "bg-gray-100 text-gray-700" },
  disponivel:          { label: "Disponível",         cls: "bg-blue-100 text-blue-800" },
  agendado:            { label: "Agendado",           cls: "bg-indigo-100 text-indigo-800" },
  em_andamento:        { label: "Em andamento",       cls: "bg-orange-100 text-orange-800" },
  concluido:           { label: "Concluído",          cls: "bg-green-100 text-green-800" },
  cancelado:           { label: "Cancelado",          cls: "bg-red-100 text-red-800" },
  aguardando_aprovacao:{ label: "Ag. aprovação",      cls: "bg-purple-100 text-purple-800" },
  correcao_solicitada: { label: "Correção",           cls: "bg-amber-100 text-amber-800" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtData(s: string | null) {
  if (!s) return "—";
  try { return format(new Date(s), "dd/MM/yyyy"); } catch { return s; }
}

// ─── Horários de pico ─────────────────────────────────────────────────────────

function HorariosPicoChart({ timestamps }: { timestamps: string[] }) {
  const dados = useMemo(() => {
    const contagem = FAIXAS_HORARIAS.map(f => ({ faixa: f.faixa, quantidade: 0, inicio: f.inicio, fim: f.fim }));
    timestamps.forEach(ts => {
      const date = new Date(ts);
      const horaSP = new Date(date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const hora = horaSP.getHours();
      const faixa = contagem.find(f => hora >= f.inicio && hora < f.fim);
      if (faixa) faixa.quantidade++;
    });
    const maxQtd = Math.max(...contagem.map(c => c.quantidade));
    return contagem.map(c => ({ ...c, destaque: c.quantidade === maxQtd && maxQtd > 0 }));
  }, [timestamps]);

  if (timestamps.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Horários de Pico
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="faixa" className="text-xs" />
              <YAxis allowDecimals={false} className="text-xs" />
              <Tooltip
                formatter={(value: number) => [`${value} cotações`, "Quantidade"]}
                contentStyle={{ borderRadius: "8px" }}
              />
              <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                {dados.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.destaque ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Distribuição das cotações por faixa horária (horário de Brasília)
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Drawer de detalhe ────────────────────────────────────────────────────────

interface FunilDrawerProps {
  tipo: DrawerTipo;
  onClose: () => void;
  cotacoes: CotacaoDetalhe[];
  servicos: ServicoDetalhe[];
  conversoesGoogle: number;
}

function FunilDrawer({ tipo, onClose, cotacoes, servicos, conversoesGoogle }: FunilDrawerProps) {
  const navigate = useNavigate();

  const servicosConcluidos = useMemo(
    () => servicos.filter((s) => s.status === "concluido"),
    [servicos]
  );

  const titulos: Record<NonNullable<DrawerTipo>, string> = {
    google_conv: "Conversões Google Ads",
    leads: `Leads — ${cotacoes.length} cotações`,
    agendados: `Serviços Agendados — ${servicos.length} serviços`,
    receita: `Receita Gerada — ${servicosConcluidos.length} serviços concluídos`,
  };

  return (
    <Sheet open={tipo !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="px-6 py-4 border-b sticky top-0 bg-background z-10">
          <SheetTitle className="text-base">{tipo ? titulos[tipo] : ""}</SheetTitle>
        </SheetHeader>

        <div className="px-6 py-4">
          {/* Google Conversions — sem registros individuais */}
          {tipo === "google_conv" && (
            <div className="space-y-4">
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                <p className="font-semibold text-violet-800 text-2xl">{conversoesGoogle.toFixed(0)}</p>
                <p className="text-sm text-violet-700 mt-1">
                  Conversões reportadas diretamente pelo Google Ads via API.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Esses números vêm da plataforma do Google Ads (
                <code>google_ads_metrics.conversions</code>) e não correspondem a
                registros individuais no sistema — por isso não há lista expandível.
              </p>
              <p className="text-sm text-muted-foreground">
                Para ver os leads confirmados no sistema, clique no bloco{" "}
                <strong>Leads (Cotações)</strong>.
              </p>
            </div>
          )}

          {/* Leads — cotações */}
          {tipo === "leads" && (
            <>
              {cotacoes.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  Nenhuma cotação no período.
                </p>
              ) : (
                <div className="divide-y">
                  {cotacoes.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { onClose(); navigate("/admin/cotacoes"); }}
                      className="w-full text-left py-3 flex items-start justify-between gap-3 hover:bg-muted/50 rounded-lg px-2 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{c.clientes?.nome || "—"}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                          {c.clientes?.telefone && <span>{c.clientes.telefone}</span>}
                          {c.clientes?.bairro && <span>{c.clientes.bairro}</span>}
                          {c.origem_lead && <span>Origem: {c.origem_lead}</span>}
                          <span>{fmtData(c.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={c.status} />
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Serviços Agendados */}
          {tipo === "agendados" && (
            <>
              {servicos.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  Nenhum serviço no período.
                </p>
              ) : (
                <>
                  <div className="mb-3 text-sm text-muted-foreground">
                    Total: <strong>{fmtBRL(servicos.reduce((s, v) => s + v.valor_mao_obra, 0))}</strong>
                  </div>
                  <div className="divide-y">
                    {servicos.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { onClose(); navigate(`/admin/servicos/${s.id}`); }}
                        className="w-full text-left py-3 flex items-start justify-between gap-3 hover:bg-muted/50 rounded-lg px-2 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{s.nome_cliente || "—"}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                            {s.bairro && <span>{s.bairro}</span>}
                            {s.data_servico_agendada && (
                              <span>Agendado: {fmtData(s.data_servico_agendada)}</span>
                            )}
                            <span className="font-medium text-foreground">{fmtBRL(s.valor_mao_obra)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={s.status} />
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Receita Gerada — só concluídos */}
          {tipo === "receita" && (
            <>
              {servicosConcluidos.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  Nenhum serviço concluído no período.
                </p>
              ) : (
                <>
                  <div className="mb-3 text-sm text-muted-foreground">
                    Receita:{" "}
                    <strong>
                      {fmtBRL(servicosConcluidos.reduce((s, v) => s + v.valor_mao_obra, 0))}
                    </strong>{" "}
                    · {servicosConcluidos.length} serviços
                  </div>
                  <div className="divide-y">
                    {servicosConcluidos.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { onClose(); navigate(`/admin/servicos/${s.id}`); }}
                        className="w-full text-left py-3 flex items-start justify-between gap-3 hover:bg-muted/50 rounded-lg px-2 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{s.nome_cliente || "—"}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                            {s.bairro && <span>{s.bairro}</span>}
                            {s.data_conclusao && (
                              <span>Concluído: {fmtData(s.data_conclusao)}</span>
                            )}
                            <span className="font-semibold text-green-700">{fmtBRL(s.valor_mao_obra)}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function FunilConversaoContent() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [fonteInvestimento, setFonteInvestimento] = useState<"google_ads" | "manual">("manual");
  const [dataInicio, setDataInicio] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [dataFim, setDataFim] = useState<Date>(new Date());
  const [funnelData, setFunnelData] = useState<FunnelData>({
    investimento: 0, leads: 0, agendados: 0, receita: 0, totalAgendados: 0,
    cpl: 0, cpc: 0, roas: 0, taxaConversao: 0, ticketMedio: 0,
    clicks: 0, impressions: 0, ctr: 0,
  });
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [cotacoesTimestamps, setCotacoesTimestamps] = useState<string[]>([]);
  const [conversoesGoogle, setConversoesGoogle] = useState<number>(0);
  const [mesSelecionado, setMesSelecionado] = useState<string>("");
  const [origemFiltro, setOrigemFiltro] = useState<string>("todos");

  // Detalhe do drawer
  const [drawerAberto, setDrawerAberto] = useState<DrawerTipo>(null);
  const [cotacoesDetalhadas, setCotacoesDetalhadas] = useState<CotacaoDetalhe[]>([]);
  const [servicosDetalhados, setServicosDetalhados] = useState<ServicoDetalhe[]>([]);

  const origemLabel = ORIGENS_LEAD.find(o => o.value === origemFiltro)?.label || "Todos";

  const opcoesMeses = (() => {
    const meses = [];
    const inicio = new Date(2026, 0, 1);
    const hoje = new Date();
    let current = startOfMonth(hoje);
    while (current >= inicio) {
      meses.push({
        value: current.toISOString(),
        label: format(current, "MMMM yyyy", { locale: ptBR }),
      });
      current = subMonths(current, 1);
    }
    return meses;
  })();

  const handleMesSelect = useCallback((value: string) => {
    setMesSelecionado(value);
    const date = new Date(value);
    setDataInicio(startOfMonth(date));
    setDataFim(endOfMonth(date));
  }, []);

  async function carregarDados() {
    setLoading(true);
    try {
      const dataInicioStr = format(dataInicio, "yyyy-MM-dd");
      const dataFimStr = format(dataFim, "yyyy-MM-dd");

      // Google Ads metrics
      const { data: adsMetrics, error: erroAds } = await supabase
        .from("google_ads_metrics")
        .select("*")
        .gte("data", dataInicioStr)
        .lte("data", dataFimStr);
      if (erroAds) throw erroAds;

      let totalClicks = 0;
      let totalImpressions = 0;
      let investimento = 0;
      let usandoGoogleAds = false;
      let investimentoAds = 0;

      if (adsMetrics && adsMetrics.length > 0) {
        totalClicks = adsMetrics.reduce((sum, m) => sum + (m.clicks || 0), 0);
        totalImpressions = adsMetrics.reduce((sum, m) => sum + (m.impressions || 0), 0);
        const totalCostMicros = adsMetrics.reduce((sum, m) => sum + Number(m.cost_micros || 0), 0);
        investimentoAds = totalCostMicros / 1_000_000;
        const maxSync = adsMetrics.reduce((max, m) => {
          const s = m.synced_at;
          return s && s > max ? s : max;
        }, "");
        if (maxSync) setLastSync(maxSync);
      }

      const { data: despesas, error: erroDespesas } = await supabase
        .from("lancamentos_caixa")
        .select("valor, data_lancamento, categoria, descricao")
        .eq("tipo", "despesa")
        .gte("data_lancamento", dataInicioStr)
        .lte("data_lancamento", dataFimStr);
      if (erroDespesas) throw erroDespesas;

      const despesasMarketing = despesas?.filter(d =>
        d.categoria?.toLowerCase().includes("marketing") ||
        d.categoria?.toLowerCase().includes("google") ||
        d.descricao?.toLowerCase().includes("google")
      ) || [];
      const investimentoManual = despesasMarketing.reduce((sum, d) => sum + Number(d.valor), 0);

      if (investimentoAds > 0 && investimentoAds >= investimentoManual) {
        investimento = investimentoAds; usandoGoogleAds = true;
      } else if (investimentoManual > 0) {
        investimento = investimentoManual; usandoGoogleAds = false;
      } else {
        investimento = investimentoAds; usandoGoogleAds = investimentoAds > 0;
      }
      setFonteInvestimento(usandoGoogleAds ? "google_ads" : "manual");

      const totalConversoesGoogle = adsMetrics?.reduce((sum, m) => sum + Number(m.conversions || 0), 0) || 0;
      setConversoesGoogle(Math.round(totalConversoesGoogle * 100) / 100);

      // Cotações — agora com campos para o drawer
      let cotacoesQuery = supabase
        .from("cotacoes")
        .select("id, status, created_at, origem_lead, valor_estimado, tvs_itens, clientes(nome, telefone, bairro)")
        .gte("created_at", dataInicioStr + "T00:00:00")
        .lte("created_at", dataFimStr + "T23:59:59");
      if (origemFiltro !== "todos") {
        cotacoesQuery = cotacoesQuery.ilike("origem_lead", `%${origemFiltro}%`);
      }
      const { data: cotacoes, error: erroCotacoes } = await cotacoesQuery;
      if (erroCotacoes) throw erroCotacoes;

      const leads = cotacoes?.length || 0;
      const cotacaoIds = cotacoes?.map((c) => c.id) || [];
      setCotacoesTimestamps(cotacoes?.map(c => c.created_at).filter(Boolean) as string[] || []);
      setCotacoesDetalhadas((cotacoes || []) as CotacaoDetalhe[]);

      // Mapa cotação_id → info do cliente para enriquecer serviços
      const cotacaoInfoMap: Record<string, { nome_cliente: string; bairro: string | null; valor_mao_obra: number }> = {};
      for (const c of cotacoes || []) {
        const cl = (c as any).clientes;
        const tvs = (c as any).tvs_itens as Array<{ valor_mao_obra?: number }> | null;
        const somaTV = tvs ? tvs.reduce((sum: number, tv: { valor_mao_obra?: number }) => sum + Number(tv.valor_mao_obra ?? 0), 0) : 0;
        const valorFinal = somaTV > 0 ? somaTV : Number((c as any).valor_estimado ?? 0);
        cotacaoInfoMap[c.id] = { nome_cliente: cl?.nome || "—", bairro: cl?.bairro || null, valor_mao_obra: valorFinal };
      }

      let agendados = 0;
      let receita = 0;
      let totalAgendados = 0;
      let servicosRaw: any[] = [];
      let servicosAtivos: any[] = [];

      if (cotacaoIds.length > 0) {
        const { data: servicosData, error: erroServicos } = await supabase
          .from("servicos")
          .select("id, valor_total, status, cotacao_id, created_at, data_servico_agendada, data_conclusao")
          .in("cotacao_id", cotacaoIds);
        if (erroServicos) throw erroServicos;
        servicosRaw = servicosData || [];
        const servicosConcl = servicosRaw.filter(s => s.status === "concluido");
        servicosAtivos = servicosRaw.filter(s => s.status !== "cancelado");
        agendados = servicosAtivos.length;
        receita = servicosConcl.reduce((sum, s) => sum + Number(cotacaoInfoMap[s.cotacao_id ?? ""]?.valor_mao_obra ?? 0), 0);
        totalAgendados = servicosAtivos.reduce((sum, s) => sum + Number(cotacaoInfoMap[s.cotacao_id ?? ""]?.valor_mao_obra ?? 0), 0);
      }

      // Enriquecer serviços com nome do cliente via cotação
      const servicosEnriquecidos: ServicoDetalhe[] = servicosAtivos.map((s) => {
        const info = s.cotacao_id ? cotacaoInfoMap[s.cotacao_id] : null;
        return {
          id: s.id,
          cotacao_id: s.cotacao_id,
          valor_total: Number(s.valor_total ?? 0),
          valor_mao_obra: s.cotacao_id ? (cotacaoInfoMap[s.cotacao_id]?.valor_mao_obra ?? 0) : 0,
          status: s.status,
          data_servico_agendada: s.data_servico_agendada,
          data_conclusao: s.data_conclusao,
          nome_cliente: info?.nome_cliente ?? "—",
          bairro: info?.bairro || null,
        };
      });
      setServicosDetalhados(servicosEnriquecidos);

      const cpl = leads > 0 ? investimento / leads : 0;
      const cpc = agendados > 0 ? investimento / agendados : 0;
      const roas = investimento > 0 ? receita / investimento : 0;
      const taxaConversao = leads > 0 ? (agendados / leads) * 100 : 0;
      const ticketMedio = agendados > 0 ? receita / agendados : 0;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      setFunnelData({
        investimento, leads, agendados, receita, totalAgendados,
        cpl, cpc, roas, taxaConversao, ticketMedio,
        clicks: totalClicks, impressions: totalImpressions, ctr,
      });

      const days = eachDayOfInterval({ start: dataInicio, end: dataFim });
      const dailyMetrics: DailyData[] = days.map(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayLabel = format(day, "dd/MM", { locale: ptBR });
        let dayInvestimento = 0;
        let dayClicks = 0;
        let dayImpressions = 0;
        let dayConversoesGoogle = 0;
        if (adsMetrics && adsMetrics.length > 0) {
          const dayAds = adsMetrics.filter(m => m.data === dayStr);
          dayClicks = dayAds.reduce((sum, m) => sum + (m.clicks || 0), 0);
          dayImpressions = dayAds.reduce((sum, m) => sum + (m.impressions || 0), 0);
          dayConversoesGoogle = dayAds.reduce((sum, m) => sum + Number(m.conversions || 0), 0);
          if (usandoGoogleAds) {
            dayInvestimento = dayAds.reduce((sum, m) => sum + Number(m.cost_micros || 0), 0) / 1_000_000;
          }
        }
        if (!usandoGoogleAds && investimentoManual > 0) {
          dayInvestimento = investimentoManual / days.length;
        }
        const dayCotacaoIds = (cotacoes || []).filter(c =>
          c.created_at && c.created_at.startsWith(dayStr)
        ).map(c => c.id);
        const dayServicos = servicosRaw.filter(s =>
          s.cotacao_id && dayCotacaoIds.includes(s.cotacao_id) && s.status !== "cancelado"
        );
        const dayServicosConc = dayServicos.filter(s => s.status === "concluido");
        const dayTotalAgendados = servicosEnriquecidos
          .filter(s => s.data_servico_agendada?.startsWith(dayStr))
          .reduce((sum, s) => sum + Number(s.valor_mao_obra || 0), 0);
        return {
          data: dayStr, dataLabel: dayLabel,
          investimento: dayInvestimento,
          leads: (cotacoes || []).filter(c => c.created_at?.startsWith(dayStr)).length,
          conversoes: dayServicos.length,
          receita: dayServicosConc.reduce((sum, s) => sum + Number(cotacaoInfoMap[s.cotacao_id ?? ""]?.valor_mao_obra ?? 0), 0),
          clicks: dayClicks, impressions: dayImpressions,
          conversoesGoogle: dayConversoesGoogle,
          totalAgendados: dayTotalAgendados,
        };
      });
      setDailyData(dailyMetrics);
    } catch (error: any) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregarDados(); }, [dataInicio, dataFim, origemFiltro]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatNumber = (value: number) =>
    new Intl.NumberFormat("pt-BR").format(value);
  const fmtCell = (value: number, tipo: "brl" | "num" | "pct" | "ratio" | "roas") => {
    if (!value) return "—";
    switch (tipo) {
      case "brl": return formatCurrency(value);
      case "num": return formatNumber(Math.round(value));
      case "pct": return `${value.toFixed(2)}%`;
      case "ratio": return value.toFixed(1);
      case "roas": return `${value.toFixed(2)}x`;
    }
  };

  // Resumo do funil - métricas derivadas
  const cliquesPorLead = funnelData.leads > 0 ? funnelData.clicks / funnelData.leads : 0;
  const custoPorAgendado = funnelData.agendados > 0 ? funnelData.investimento / funnelData.agendados : 0;
  const cliquesPorAgendado = funnelData.agendados > 0 ? funnelData.clicks / funnelData.agendados : 0;
  const roasAgendados = funnelData.investimento > 0 ? funnelData.totalAgendados / funnelData.investimento : 0;

  // Classe compartilhada para blocos clicáveis do funil
  const funilBlocoBase = "cursor-pointer hover:opacity-90 hover:scale-[1.02] transition-all active:scale-[0.99] select-none";

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-lg">Período de Análise</CardTitle>
            {lastSync && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3" />
                Última sync: {format(new Date(lastSync), "dd/MM/yyyy HH:mm")}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-2">Mês</label>
              <Select value={mesSelecionado} onValueChange={handleMesSelect}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Selecionar mês" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesMeses.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Origem</label>
              <Select value={origemFiltro} onValueChange={setOrigemFiltro}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar origem" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS_LEAD.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Data Início</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataInicio} onSelect={(date) => date && setDataInicio(date)} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Data Fim</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !dataFim && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataFim} onSelect={(date) => date && setDataFim(date)} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={carregarDados} disabled={loading}>
              {loading ? "Carregando..." : "Atualizar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs">Investimento</p>
                <p className="text-lg font-bold">{formatCurrency(funnelData.investimento)}</p>
                <p className="text-blue-200 text-[10px] mt-0.5">
                  {fonteInvestimento === "google_ads" ? "📡 Google Ads" : "📝 Lançamentos manuais"}
                </p>
              </div>
              <DollarSign className="h-8 w-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-xs">Impressões</p>
                <p className="text-lg font-bold">{formatNumber(funnelData.impressions)}</p>
              </div>
              <Eye className="h-8 w-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-sky-500 to-sky-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sky-100 text-xs">Cliques</p>
                <p className="text-lg font-bold">{formatNumber(funnelData.clicks)}</p>
              </div>
              <MousePointerClick className="h-8 w-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-xs">CTR</p>
                <p className="text-lg font-bold">{funnelData.ctr.toFixed(2)}%</p>
              </div>
              <BarChart3 className="h-8 w-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        {conversoesGoogle > 0 && (
          <Card className="bg-gradient-to-br from-violet-500 to-violet-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-violet-100 text-xs">Conv. Google</p>
                  <p className="text-lg font-bold">{conversoesGoogle.toFixed(0)}</p>
                  <p className="text-violet-200 text-[10px] mt-0.5">
                    {funnelData.leads > 0 ? `${((funnelData.leads / conversoesGoogle) * 100).toFixed(0)}% confirmados` : "—"}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs">CPL</p>
                <p className="text-lg font-bold">{formatCurrency(funnelData.cpl)}</p>
              </div>
              <Users className="h-8 w-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-xs">Custo/Conversão</p>
                <p className="text-lg font-bold">{formatCurrency(funnelData.cpc)}</p>
              </div>
              <Target className="h-8 w-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-xs">ROAS</p>
                <p className="text-lg font-bold">{funnelData.roas.toFixed(2)}x</p>
              </div>
              <TrendingUp className="h-8 w-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-100 text-xs">Ticket Médio</p>
                <p className="text-lg font-bold">{formatCurrency(funnelData.ticketMedio)}</p>
              </div>
              <Receipt className="h-8 w-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Linha */}
      <MetricasLineChart dailyData={dailyData} loading={loading} />

      {/* Funil Visual — blocos clicáveis */}
      <Card>
        <CardHeader>
          <CardTitle>Funil de Conversão - {origemLabel}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Clique em qualquer bloco para ver os registros detalhados.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4">

            {/* Conversões Google Ads */}
            {conversoesGoogle > 0 && (
              <>
                <div
                  className={`w-full max-w-lg ${funilBlocoBase}`}
                  onClick={() => setDrawerAberto("google_conv")}
                  title="Ver detalhes das conversões Google Ads"
                >
                  <div className="bg-violet-500 text-white p-6 rounded-t-lg text-center relative">
                    <ExternalLink className="absolute top-3 right-3 h-4 w-4 opacity-60" />
                    <p className="text-lg font-semibold">Conversões Google Ads</p>
                    <p className="text-4xl font-bold">{conversoesGoogle.toFixed(0)}</p>
                    <p className="text-violet-200 text-xs mt-1">Reportadas pelo Google</p>
                  </div>
                </div>
                <ArrowDown className="h-8 w-8 text-muted-foreground" />
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">
                    {conversoesGoogle > 0
                      ? `${((funnelData.leads / conversoesGoogle) * 100).toFixed(0)}% confirmados no sistema`
                      : "—"}
                  </span>
                </div>
                <ArrowDown className="h-8 w-8 text-muted-foreground" />
              </>
            )}

            {/* Leads */}
            <div
              className={`w-full max-w-md ${funilBlocoBase}`}
              onClick={() => setDrawerAberto("leads")}
              title="Ver lista de cotações"
            >
              <div className="bg-blue-500 text-white p-6 rounded-lg text-center relative">
                <ExternalLink className="absolute top-3 right-3 h-4 w-4 opacity-60" />
                <p className="text-lg font-semibold">Leads (Cotações)</p>
                <p className="text-4xl font-bold">{funnelData.leads}</p>
              </div>
            </div>

            <ArrowDown className="h-8 w-8 text-muted-foreground" />
            <div className="flex items-center gap-2 text-muted-foreground">
              <Percent className="h-5 w-5" />
              <span className="font-semibold">{funnelData.taxaConversao.toFixed(1)}% de conversão</span>
            </div>
            <ArrowDown className="h-8 w-8 text-muted-foreground" />

            {/* Serviços Agendados */}
            <div
              className={`w-full max-w-sm ${funilBlocoBase}`}
              onClick={() => setDrawerAberto("agendados")}
              title="Ver lista de serviços agendados"
            >
              <div className="bg-green-500 text-white p-6 rounded-lg text-center relative">
                <ExternalLink className="absolute top-3 right-3 h-4 w-4 opacity-60" />
                <p className="text-lg font-semibold">Serviços Agendados</p>
                <div className="flex items-center justify-center gap-3">
                  <p className="text-4xl font-bold">{funnelData.agendados}</p>
                  <p className="text-lg font-semibold opacity-80">{formatCurrency(funnelData.totalAgendados)}</p>
                </div>
              </div>
            </div>

            <ArrowDown className="h-8 w-8 text-gray-400" />

            {/* Receita Gerada */}
            <div
              className={`w-full max-w-xs ${funilBlocoBase}`}
              onClick={() => setDrawerAberto("receita")}
              title="Ver serviços concluídos"
            >
              <div className="bg-amber-500 text-white p-6 rounded-lg text-center relative">
                <ExternalLink className="absolute top-3 right-3 h-4 w-4 opacity-60" />
                <p className="text-lg font-semibold">Receita Gerada</p>
                <p className="text-3xl font-bold">{formatCurrency(funnelData.receita)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo do Funil - tabela diária */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo do Funil</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="text-xs border-collapse table-fixed">
              <colgroup>
                <col className="w-16" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-20" />
                <col className="w-[70px]" />
                <col className="w-[90px]" />
                <col className="w-[70px]" />
                <col className="w-20" />
                <col className="w-[90px]" />
                <col className="w-20" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
              </colgroup>
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-2 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Data</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">Invest.</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap border-l">Impressões</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">Cliques</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">CTR</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap border-l">Conv. Google</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">Leads</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">CPL</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">Cliques/Lead</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap border-l">Agendados</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">Valor Agend.</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">Custo/Agend.</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">Cliques/Agend.</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap border-l">Receita</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">ROAS Receita</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">ROAS Agend.</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.map((day, i) => {
                  const dayCtr = day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0;
                  const dayCpl = day.leads > 0 ? day.investimento / day.leads : 0;
                  const dayCliquesPorLead = day.leads > 0 ? day.clicks / day.leads : 0;
                  const dayCustoPorAgendado = day.conversoes > 0 ? day.investimento / day.conversoes : 0;
                  const dayCliquesPorAgendado = day.conversoes > 0 ? day.clicks / day.conversoes : 0;
                  const dayRoasReceita = day.investimento > 0 ? day.receita / day.investimento : 0;
                  const dayRoasAgendados = day.investimento > 0 ? day.totalAgendados / day.investimento : 0;
                  return (
                    <tr key={day.data} className={cn("transition-colors", i % 2 === 0 ? "bg-background" : "bg-muted/10")}>
                      <td className="px-2 py-1.5 text-left tabular-nums whitespace-nowrap">{day.dataLabel}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(day.investimento, "brl")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums border-l">{fmtCell(day.impressions, "num")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(day.clicks, "num")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(dayCtr, "pct")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums border-l">{fmtCell(day.conversoesGoogle, "ratio")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(day.leads, "num")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(dayCpl, "brl")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(dayCliquesPorLead, "ratio")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums border-l">{fmtCell(day.conversoes, "num")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(day.totalAgendados, "brl")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(dayCustoPorAgendado, "brl")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(dayCliquesPorAgendado, "ratio")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums border-l">{fmtCell(day.receita, "brl")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(dayRoasReceita, "roas")}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(dayRoasAgendados, "roas")}</td>
                    </tr>
                  );
                })}
                <tr className="font-bold bg-muted/60 border-t-2 border-border">
                  <td className="px-2 py-1.5 text-left whitespace-nowrap">TOTAL</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(funnelData.investimento, "brl")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums border-l">{fmtCell(funnelData.impressions, "num")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(funnelData.clicks, "num")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(funnelData.ctr, "pct")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums border-l">{fmtCell(conversoesGoogle, "ratio")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(funnelData.leads, "num")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(funnelData.cpl, "brl")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(cliquesPorLead, "ratio")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums border-l">{fmtCell(funnelData.agendados, "num")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(funnelData.totalAgendados, "brl")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(custoPorAgendado, "brl")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(cliquesPorAgendado, "ratio")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums border-l">{fmtCell(funnelData.receita, "brl")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(funnelData.roas, "roas")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtCell(roasAgendados, "roas")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Horários de Pico */}
      <HorariosPicoChart timestamps={cotacoesTimestamps} />

      {/* Resumo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-muted-foreground text-sm">Investimento Total</p>
              <p className="text-xl font-bold">{formatCurrency(funnelData.investimento)}</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-muted-foreground text-sm">Total de Leads</p>
              <p className="text-xl font-bold">{funnelData.leads}</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-muted-foreground text-sm">Conversões</p>
              <p className="text-xl font-bold">{funnelData.agendados}</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-muted-foreground text-sm">Receita Total</p>
              <p className="text-xl font-bold">{formatCurrency(funnelData.receita)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drawer de detalhes */}
      <FunilDrawer
        tipo={drawerAberto}
        onClose={() => setDrawerAberto(null)}
        cotacoes={cotacoesDetalhadas}
        servicos={servicosDetalhados}
        conversoesGoogle={conversoesGoogle}
      />
    </div>
  );
}
