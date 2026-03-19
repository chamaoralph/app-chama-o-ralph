import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, Users, Target, DollarSign, ArrowDown, Percent, CalendarIcon, Receipt, MousePointerClick, Eye, BarChart3, RefreshCw } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MetricasLineChart } from "./MetricasLineChart";

interface FunnelData {
  investimento: number;
  leads: number;
  agendados: number;
  receita: number;
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
}

const ORIGENS_LEAD = [
  { value: "todos", label: "Todos" },
  { value: "google", label: "Google" },
  { value: "indicação", label: "Indicação" },
  { value: "instagram", label: "Instagram" },
  { value: "já era cliente", label: "Já era cliente" },
  { value: "importação", label: "Importação" },
  { value: "whatsapp auto", label: "WhatsApp Auto" },
];

export function FunilConversaoContent() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [dataFim, setDataFim] = useState<Date>(new Date());
  const [funnelData, setFunnelData] = useState<FunnelData>({
    investimento: 0, leads: 0, agendados: 0, receita: 0,
    cpl: 0, cpc: 0, roas: 0, taxaConversao: 0, ticketMedio: 0,
    clicks: 0, impressions: 0, ctr: 0,
  });
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState<string>("");
  const [origemFiltro, setOrigemFiltro] = useState<string>("todos");

  const origemLabel = ORIGENS_LEAD.find(o => o.value === origemFiltro)?.label || "Todos";

  // Gerar lista de meses: de janeiro 2026 até o mês atual
  const opcoesMeses = (() => {
    const meses = [];
    const inicio = new Date(2026, 0, 1); // Janeiro 2026
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

      // Fetch investment from lancamentos_caixa (real money spent)
      const { data: despesas, error: erroDespesas } = await supabase
        .from("lancamentos_caixa")
        .select("valor, data_lancamento, categoria, descricao")
        .eq("tipo", "despesa")
        .gte("data_lancamento", dataInicioStr)
        .lte("data_lancamento", dataFimStr);

      if (erroDespesas) throw erroDespesas;

      const despesasMarketing = despesas?.filter(d =>
        d.categoria?.toLowerCase().includes('marketing') ||
        d.categoria?.toLowerCase().includes('google') ||
        d.descricao?.toLowerCase().includes('google')
      ) || [];

      let investimento = despesasMarketing.reduce((sum, d) => sum + Number(d.valor), 0);

      // Fetch Google Ads metrics (engagement only: clicks, impressions)
      const { data: adsMetrics, error: erroAds } = await supabase
        .from("google_ads_metrics")
        .select("*")
        .gte("data", dataInicioStr)
        .lte("data", dataFimStr);

      if (erroAds) throw erroAds;

      let totalClicks = 0;
      let totalImpressions = 0;

      if (adsMetrics && adsMetrics.length > 0) {
        totalClicks = adsMetrics.reduce((sum, m) => sum + (m.clicks || 0), 0);
        totalImpressions = adsMetrics.reduce((sum, m) => sum + (m.impressions || 0), 0);

        const maxSync = adsMetrics.reduce((max, m) => {
          const s = m.synced_at;
          return s && s > max ? s : max;
        }, "");
        if (maxSync) setLastSync(maxSync);
      }

      // Leads & conversions
      let cotacoesQuery = supabase
        .from("cotacoes")
        .select("id, status, created_at")
        .gte("created_at", dataInicioStr)
        .lte("created_at", dataFimStr + "T23:59:59");

      if (origemFiltro !== "todos") {
        cotacoesQuery = cotacoesQuery.ilike("origem_lead", `%${origemFiltro}%`);
      }

      const { data: cotacoes, error: erroCotacoes } = await cotacoesQuery;

      if (erroCotacoes) throw erroCotacoes;

      const leads = cotacoes?.length || 0;
      const cotacaoIds = cotacoes?.map((c) => c.id) || [];

      let agendados = 0;
      let receita = 0;
      let servicos: any[] = [];

      if (cotacaoIds.length > 0) {
        const { data: servicosData, error: erroServicos } = await supabase
          .from("servicos")
          .select("id, valor_total, status, cotacao_id, created_at")
          .in("cotacao_id", cotacaoIds);

        if (erroServicos) throw erroServicos;

        servicos = servicosData || [];
        agendados = servicos.length;
        receita = servicos.reduce((sum, s) => sum + Number(s.valor_total), 0);
      }

      const cpl = leads > 0 ? investimento / leads : 0;
      const cpc = agendados > 0 ? investimento / agendados : 0;
      const roas = investimento > 0 ? receita / investimento : 0;
      const taxaConversao = leads > 0 ? (agendados / leads) * 100 : 0;
      const ticketMedio = agendados > 0 ? receita / agendados : 0;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      setFunnelData({
        investimento, leads, agendados, receita,
        cpl, cpc, roas, taxaConversao, ticketMedio,
        clicks: totalClicks, impressions: totalImpressions, ctr,
      });

      // Build daily data
      const days = eachDayOfInterval({ start: dataInicio, end: dataFim });
      const dailyMetrics: DailyData[] = days.map(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayLabel = format(day, "dd/MM", { locale: ptBR });

        let dayInvestimento = 0;
        let dayClicks = 0;
        let dayImpressions = 0;

        // Investment from caixa
        const dayDespesas = despesasMarketing.filter(d => d.data_lancamento === dayStr);
        dayInvestimento = dayDespesas.reduce((sum, d) => sum + Number(d.valor), 0);

        // Engagement from Google Ads
        if (adsMetrics && adsMetrics.length > 0) {
          const dayAds = adsMetrics.filter(m => m.data === dayStr);
          dayClicks = dayAds.reduce((sum, m) => sum + (m.clicks || 0), 0);
          dayImpressions = dayAds.reduce((sum, m) => sum + (m.impressions || 0), 0);
        }

        const dayLeads = cotacoes?.filter(c =>
          c.created_at && c.created_at.startsWith(dayStr)
        ).length || 0;

        const dayCotacaoIds = cotacoes?.filter(c =>
          c.created_at && c.created_at.startsWith(dayStr)
        ).map(c => c.id) || [];

        const dayServicos = servicos.filter(s =>
          s.cotacao_id && dayCotacaoIds.includes(s.cotacao_id)
        );

        return {
          data: dayStr,
          dataLabel: dayLabel,
          investimento: dayInvestimento,
          leads: dayLeads,
          conversoes: dayServicos.length,
          receita: dayServicos.reduce((sum, s) => sum + Number(s.valor_total), 0),
          clicks: dayClicks,
          impressions: dayImpressions,
        };
      });

      setDailyData(dailyMetrics);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, [dataInicio, dataFim]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("pt-BR").format(value);

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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs">Investimento</p>
                <p className="text-lg font-bold">{formatCurrency(funnelData.investimento)}</p>
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

      {/* Funil Visual */}
      <Card>
        <CardHeader>
          <CardTitle>Funil de Conversão - Google Ads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <div className="w-full max-w-md">
              <div className="bg-blue-500 text-white p-6 rounded-t-lg text-center">
                <p className="text-lg font-semibold">Leads (Cotações)</p>
                <p className="text-4xl font-bold">{funnelData.leads}</p>
              </div>
            </div>
            <ArrowDown className="h-8 w-8 text-gray-400" />
            <div className="flex items-center gap-2 text-gray-600">
              <Percent className="h-5 w-5" />
              <span className="font-semibold">{funnelData.taxaConversao.toFixed(1)}% de conversão</span>
            </div>
            <ArrowDown className="h-8 w-8 text-gray-400" />
            <div className="w-full max-w-sm">
              <div className="bg-green-500 text-white p-6 rounded-lg text-center">
                <p className="text-lg font-semibold">Serviços Agendados</p>
                <p className="text-4xl font-bold">{funnelData.agendados}</p>
              </div>
            </div>
            <ArrowDown className="h-8 w-8 text-gray-400" />
            <div className="w-full max-w-xs">
              <div className="bg-amber-500 text-white p-6 rounded-b-lg text-center">
                <p className="text-lg font-semibold">Receita Gerada</p>
                <p className="text-3xl font-bold">{formatCurrency(funnelData.receita)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
