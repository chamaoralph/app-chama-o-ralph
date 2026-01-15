import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, Users, Target, DollarSign, ArrowDown, Percent, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
}

interface DailyData {
  data: string;
  dataLabel: string;
  investimento: number;
  leads: number;
  conversoes: number;
  receita: number;
}

export function FunilConversaoContent() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [dataFim, setDataFim] = useState<Date>(new Date());
  const [funnelData, setFunnelData] = useState<FunnelData>({
    investimento: 0,
    leads: 0,
    agendados: 0,
    receita: 0,
    cpl: 0,
    cpc: 0,
    roas: 0,
    taxaConversao: 0,
  });
  const [dailyData, setDailyData] = useState<DailyData[]>([]);

  async function carregarDados() {
    setLoading(true);
    try {
      const dataInicioStr = format(dataInicio, "yyyy-MM-dd");
      const dataFimStr = format(dataFim, "yyyy-MM-dd");

      const { data: despesas, error: erroDespesas } = await supabase
        .from("lancamentos_caixa")
        .select("valor, data_lancamento, categoria, descricao")
        .eq("tipo", "despesa")
        .gte("data_lancamento", dataInicioStr)
        .lte("data_lancamento", dataFimStr);

      if (erroDespesas) throw erroDespesas;

      const despesasGoogle = despesas?.filter(d => 
        d.categoria?.toLowerCase().includes('google') || 
        d.descricao?.toLowerCase().includes('google')
      ) || [];

      const investimento = despesasGoogle.reduce((sum, d) => sum + Number(d.valor), 0);

      const { data: cotacoes, error: erroCotacoes } = await supabase
        .from("cotacoes")
        .select("id, status, created_at")
        .ilike("origem_lead", "%google%")
        .gte("created_at", dataInicioStr)
        .lte("created_at", dataFimStr + "T23:59:59");

      if (erroCotacoes) throw erroCotacoes;

      const leads = cotacoes?.length || 0;

      const cotacaoIds = cotacoes?.map((c) => c.id) || [];
      
      let agendados = 0;
      let receita = 0;
      let servicos: { id: string; valor_total: number; status: string | null; cotacao_id: string | null; created_at: string | null }[] = [];

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

      setFunnelData({
        investimento,
        leads,
        agendados,
        receita,
        cpl,
        cpc,
        roas,
        taxaConversao,
      });

      // Build daily data for line chart
      const days = eachDayOfInterval({ start: dataInicio, end: dataFim });
      const dailyMetrics: DailyData[] = days.map(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayLabel = format(day, "dd/MM", { locale: ptBR });

        // Daily investment
        const dayInvestimento = despesasGoogle
          .filter(d => d.data_lancamento === dayStr)
          .reduce((sum, d) => sum + Number(d.valor), 0);

        // Daily leads
        const dayLeads = cotacoes?.filter(c => 
          c.created_at && c.created_at.startsWith(dayStr)
        ).length || 0;

        // Daily conversions and revenue
        const dayCotacaoIds = cotacoes?.filter(c => 
          c.created_at && c.created_at.startsWith(dayStr)
        ).map(c => c.id) || [];
        
        const dayServicos = servicos.filter(s => 
          s.cotacao_id && dayCotacaoIds.includes(s.cotacao_id)
        );
        const dayConversoes = dayServicos.length;
        const dayReceita = dayServicos.reduce((sum, s) => sum + Number(s.valor_total), 0);

        return {
          data: dayStr,
          dataLabel: dayLabel,
          investimento: dayInvestimento,
          leads: dayLeads,
          conversoes: dayConversoes,
          receita: dayReceita,
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
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Período de Análise</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-2">Data Início</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-40 justify-start text-left font-normal",
                      !dataInicio && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={(date) => date && setDataInicio(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Data Fim</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-40 justify-start text-left font-normal",
                      !dataFim && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={(date) => date && setDataFim(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={carregarDados} disabled={loading}>
              {loading ? "Carregando..." : "Atualizar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Investimento Google</p>
                <p className="text-2xl font-bold">{formatCurrency(funnelData.investimento)}</p>
              </div>
              <DollarSign className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Custo por Lead (CPL)</p>
                <p className="text-2xl font-bold">{formatCurrency(funnelData.cpl)}</p>
              </div>
              <Users className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Custo por Conversão</p>
                <p className="text-2xl font-bold">{formatCurrency(funnelData.cpc)}</p>
              </div>
              <Target className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">ROAS</p>
                <p className="text-2xl font-bold">{funnelData.roas.toFixed(2)}x</p>
              </div>
              <TrendingUp className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Linha - Evolução de Métricas */}
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

      {/* Resumo Detalhado */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-500 text-sm">Investimento Total</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(funnelData.investimento)}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-500 text-sm">Total de Leads</p>
              <p className="text-xl font-bold text-gray-900">{funnelData.leads}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-500 text-sm">Conversões</p>
              <p className="text-xl font-bold text-gray-900">{funnelData.agendados}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-500 text-sm">Receita Total</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(funnelData.receita)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
