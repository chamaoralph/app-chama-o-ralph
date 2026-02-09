import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Target, Receipt, MousePointerClick, Eye, BarChart3 } from "lucide-react";

type MetricaType = 'roas' | 'cpl' | 'cpc' | 'ticketMedio' | 'clicks' | 'impressions' | 'ctr';

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

interface MetricasLineChartProps {
  dailyData: DailyData[];
  loading?: boolean;
}

const metricas: { key: MetricaType; label: string; icon: React.ReactNode; color: string; format: (value: number) => string }[] = [
  { key: 'roas', label: 'ROAS', icon: <TrendingUp className="h-4 w-4" />, color: 'hsl(var(--chart-1))', format: (v) => `${v.toFixed(2)}x` },
  { key: 'cpl', label: 'CPL', icon: <Users className="h-4 w-4" />, color: 'hsl(var(--chart-2))', format: (v) => `R$ ${v.toFixed(2)}` },
  { key: 'cpc', label: 'Custo Conv.', icon: <Target className="h-4 w-4" />, color: 'hsl(var(--chart-3))', format: (v) => `R$ ${v.toFixed(2)}` },
  { key: 'ticketMedio', label: 'Ticket', icon: <Receipt className="h-4 w-4" />, color: 'hsl(var(--chart-4))', format: (v) => `R$ ${v.toFixed(2)}` },
  { key: 'clicks', label: 'Cliques', icon: <MousePointerClick className="h-4 w-4" />, color: 'hsl(var(--chart-5))', format: (v) => v.toLocaleString('pt-BR') },
  { key: 'impressions', label: 'Impressões', icon: <Eye className="h-4 w-4" />, color: 'hsl(200 70% 50%)', format: (v) => v.toLocaleString('pt-BR') },
  { key: 'ctr', label: 'CTR', icon: <BarChart3 className="h-4 w-4" />, color: 'hsl(160 60% 45%)', format: (v) => `${v.toFixed(2)}%` },
];

export function MetricasLineChart({ dailyData, loading }: MetricasLineChartProps) {
  const [metricaSelecionada, setMetricaSelecionada] = useState<MetricaType>('roas');

  const chartData = useMemo(() => {
    let acumInvestimento = 0, acumLeads = 0, acumConversoes = 0, acumReceita = 0;
    let acumClicks = 0, acumImpressions = 0;

    return dailyData.map(d => {
      acumInvestimento += d.investimento;
      acumLeads += d.leads;
      acumConversoes += d.conversoes;
      acumReceita += d.receita;
      acumClicks += d.clicks;
      acumImpressions += d.impressions;

      return {
        dataLabel: d.dataLabel,
        roas: acumInvestimento > 0 ? acumReceita / acumInvestimento : 0,
        cpl: acumLeads > 0 ? acumInvestimento / acumLeads : 0,
        cpc: acumConversoes > 0 ? acumInvestimento / acumConversoes : 0,
        ticketMedio: acumConversoes > 0 ? acumReceita / acumConversoes : 0,
        clicks: acumClicks,
        impressions: acumImpressions,
        ctr: acumImpressions > 0 ? (acumClicks / acumImpressions) * 100 : 0,
        acumInvestimento, acumLeads, acumConversoes, acumReceita,
      };
    });
  }, [dailyData]);

  const metricaAtual = metricas.find(m => m.key === metricaSelecionada)!;

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">Evolução de Métricas</CardTitle></CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">Evolução de Métricas</CardTitle></CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <p className="text-muted-foreground">Sem dados para o período selecionado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Evolução de Métricas (Acumulado)</CardTitle>
            <p className="text-sm text-muted-foreground">Valores acumulados desde o início do período</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {metricas.map((m) => (
              <Button key={m.key} variant={metricaSelecionada === m.key ? "default" : "outline"} size="sm" onClick={() => setMetricaSelecionada(m.key)} className="gap-1 text-xs">
                {m.icon}
                {m.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="dataLabel" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="text-muted-foreground"
                tickFormatter={(value) => {
                  if (metricaSelecionada === 'roas') return `${value.toFixed(1)}x`;
                  if (metricaSelecionada === 'ctr') return `${value.toFixed(1)}%`;
                  if (metricaSelecionada === 'clicks' || metricaSelecionada === 'impressions') return value.toLocaleString('pt-BR');
                  return `R$ ${value.toFixed(0)}`;
                }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const value = payload[0].value as number;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border rounded-lg shadow-lg p-3">
                        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
                        <p className="text-lg font-semibold" style={{ color: metricaAtual.color }}>
                          {metricaAtual.format(value)}
                        </p>
                        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground space-y-1">
                          <p>Investimento: R$ {data.acumInvestimento?.toFixed(2)}</p>
                          <p>Leads: {data.acumLeads}</p>
                          <p>Conversões: {data.acumConversoes}</p>
                          <p>Receita: R$ {data.acumReceita?.toFixed(2)}</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line type="monotone" dataKey={metricaSelecionada} stroke={metricaAtual.color} strokeWidth={3} dot={{ fill: metricaAtual.color, strokeWidth: 2, r: 4 }} activeDot={{ r: 6, strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
