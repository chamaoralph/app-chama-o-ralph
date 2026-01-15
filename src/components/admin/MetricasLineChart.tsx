import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Target, Receipt } from "lucide-react";

type MetricaType = 'roas' | 'cpl' | 'cpc' | 'ticketMedio';

interface DailyData {
  data: string;
  dataLabel: string;
  investimento: number;
  leads: number;
  conversoes: number;
  receita: number;
}

interface MetricasLineChartProps {
  dailyData: DailyData[];
  loading?: boolean;
}

const metricas: { key: MetricaType; label: string; icon: React.ReactNode; color: string; format: (value: number) => string }[] = [
  { 
    key: 'roas', 
    label: 'ROAS', 
    icon: <TrendingUp className="h-4 w-4" />, 
    color: 'hsl(var(--chart-1))',
    format: (v) => `${v.toFixed(2)}x`
  },
  { 
    key: 'cpl', 
    label: 'Custo por Lead', 
    icon: <Users className="h-4 w-4" />, 
    color: 'hsl(var(--chart-2))',
    format: (v) => `R$ ${v.toFixed(2)}`
  },
  { 
    key: 'cpc', 
    label: 'Custo de Conversão', 
    icon: <Target className="h-4 w-4" />, 
    color: 'hsl(var(--chart-3))',
    format: (v) => `R$ ${v.toFixed(2)}`
  },
  { 
    key: 'ticketMedio', 
    label: 'Ticket Médio', 
    icon: <Receipt className="h-4 w-4" />, 
    color: 'hsl(var(--chart-4))',
    format: (v) => `R$ ${v.toFixed(2)}`
  },
];

export function MetricasLineChart({ dailyData, loading }: MetricasLineChartProps) {
  const [metricaSelecionada, setMetricaSelecionada] = useState<MetricaType>('roas');

  // Calcular métricas ACUMULATIVAS para mostrar evolução real
  const chartData = useMemo(() => {
    let acumInvestimento = 0;
    let acumLeads = 0;
    let acumConversoes = 0;
    let acumReceita = 0;

    return dailyData.map(d => {
      // Acumular valores
      acumInvestimento += d.investimento;
      acumLeads += d.leads;
      acumConversoes += d.conversoes;
      acumReceita += d.receita;

      // Calcular métricas acumuladas
      const roas = acumInvestimento > 0 ? acumReceita / acumInvestimento : 0;
      const cpl = acumLeads > 0 ? acumInvestimento / acumLeads : 0;
      const cpc = acumConversoes > 0 ? acumInvestimento / acumConversoes : 0;
      const ticketMedio = acumConversoes > 0 ? acumReceita / acumConversoes : 0;
      
      return {
        dataLabel: d.dataLabel,
        roas,
        cpl,
        cpc,
        ticketMedio,
        // Guardar acumulados para tooltip
        acumInvestimento,
        acumLeads,
        acumConversoes,
        acumReceita,
      };
    });
  }, [dailyData]);

  const metricaAtual = metricas.find(m => m.key === metricaSelecionada)!;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evolução de Métricas</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evolução de Métricas</CardTitle>
        </CardHeader>
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
              <Button
                key={m.key}
                variant={metricaSelecionada === m.key ? "default" : "outline"}
                size="sm"
                onClick={() => setMetricaSelecionada(m.key)}
                className="gap-2"
              >
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
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="dataLabel" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
                tickFormatter={(value) => {
                  if (metricaSelecionada === 'roas') return `${value.toFixed(1)}x`;
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
              <Line
                type="monotone"
                dataKey={metricaSelecionada}
                stroke={metricaAtual.color}
                strokeWidth={3}
                dot={{ fill: metricaAtual.color, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
