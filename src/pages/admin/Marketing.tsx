import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { TrendingUp, Users, Target, DollarSign, ArrowDown, Percent } from "lucide-react";

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

export default function Marketing() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd")
  );
  const [dataFim, setDataFim] = useState(format(new Date(), "yyyy-MM-dd"));
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

  async function carregarDados() {
    setLoading(true);
    try {
      // 1. Buscar investimento em Google Ads das despesas
      const { data: despesas, error: erroDespesas } = await supabase
        .from("lancamentos_caixa")
        .select("valor, data_lancamento")
        .eq("tipo", "despesa")
        .ilike("categoria", "%google%")
        .gte("data_lancamento", dataInicio)
        .lte("data_lancamento", dataFim);

      if (erroDespesas) throw erroDespesas;

      const investimento = despesas?.reduce((sum, d) => sum + Number(d.valor), 0) || 0;

      // 2. Buscar cotações com origem Google no período
      const { data: cotacoes, error: erroCotacoes } = await supabase
        .from("cotacoes")
        .select("id, status")
        .ilike("origem_lead", "%google%")
        .gte("created_at", dataInicio)
        .lte("created_at", dataFim + "T23:59:59");

      if (erroCotacoes) throw erroCotacoes;

      const leads = cotacoes?.length || 0;

      // 3. Buscar serviços criados a partir dessas cotações (agendados)
      const cotacaoIds = cotacoes?.map((c) => c.id) || [];
      
      let agendados = 0;
      let receita = 0;

      if (cotacaoIds.length > 0) {
        const { data: servicos, error: erroServicos } = await supabase
          .from("servicos")
          .select("id, valor_total, status")
          .in("cotacao_id", cotacaoIds);

        if (erroServicos) throw erroServicos;

        agendados = servicos?.length || 0;
        receita = servicos?.reduce((sum, s) => sum + Number(s.valor_total), 0) || 0;
      }

      // 4. Calcular métricas
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
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketing</h1>
          <p className="text-gray-600">Funil de conversão e métricas de performance</p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Período de Análise</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-40"
                />
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

        {/* Funil Visual */}
        <Card>
          <CardHeader>
            <CardTitle>Funil de Conversão - Google Ads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              {/* Etapa 1: Leads */}
              <div className="w-full max-w-md">
                <div className="bg-blue-500 text-white p-6 rounded-t-lg text-center">
                  <p className="text-lg font-semibold">Leads (Cotações)</p>
                  <p className="text-4xl font-bold">{funnelData.leads}</p>
                </div>
              </div>
              
              <ArrowDown className="h-8 w-8 text-gray-400" />
              
              {/* Taxa de Conversão */}
              <div className="flex items-center gap-2 text-gray-600">
                <Percent className="h-5 w-5" />
                <span className="font-semibold">{funnelData.taxaConversao.toFixed(1)}% de conversão</span>
              </div>

              <ArrowDown className="h-8 w-8 text-gray-400" />

              {/* Etapa 2: Agendados */}
              <div className="w-full max-w-sm">
                <div className="bg-green-500 text-white p-6 rounded-lg text-center">
                  <p className="text-lg font-semibold">Serviços Agendados</p>
                  <p className="text-4xl font-bold">{funnelData.agendados}</p>
                </div>
              </div>

              <ArrowDown className="h-8 w-8 text-gray-400" />

              {/* Receita Total */}
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
    </AdminLayout>
  );
}
