import { useEffect, useState, useMemo } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatarDataBR } from "@/lib/utils";

// Categorias que são acerto de caixa com o instalador (ele pagando a empresa
// ou a empresa pagando ele), não receita/despesa nova — a receita do serviço
// já foi lançada em "Receita de Serviço" na aprovação; isso aqui é só o
// dinheiro que ele já tinha em mãos voltando pra empresa (ou vice-versa).
// Fica de fora de Receitas/Despesas Gerais; aparece só no card "Instaladores"
// (fonte: recibos_diarios) e no filtro "Instaladores" da lista.
const CATEGORIAS_INSTALADORES = new Set(["Pagamento Instalador", "Reembolso Materiais", "Recebimento Instalador"]);

// Cores para o gráfico pizza
const CORES_PIZZA = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', 
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
  '#6366F1', '#84CC16', '#14B8A6', '#64748B'
];

export default function Caixa() {
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "receitas" | "despesas_gerais" | "instaladores">("todos");
  const [ordenacao, setOrdenacao] = useState<{
    coluna: "data" | "tipo" | "categoria" | "descricao" | "forma_pagamento" | "valor";
    direcao: "asc" | "desc";
  }>({ coluna: "data", direcao: "desc" });
  
  // Total de instaladores baseado em recibos pagos (fonte única de verdade)
  const [totalInstaladoresRecibos, setTotalInstaladoresRecibos] = useState(0);
  const [totalProjecao, setTotalProjecao] = useState(0);

  const alternarOrdenacao = (coluna: typeof ordenacao.coluna) => {
    setOrdenacao(prev => ({
      coluna,
      direcao: prev.coluna === coluna && prev.direcao === "asc" ? "desc" : "asc"
    }));
  };

  useEffect(() => {
    // Setar mês atual como padrão
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    setFiltroMes(mesAtual);
  }, []);

  useEffect(() => {
    if (filtroMes) {
      carregarLancamentos();
      carregarTotalRecibos();
      carregarProjecao();
    }
  }, [filtroMes]);

  async function carregarTotalRecibos() {
    try {
      const [ano, mes] = filtroMes.split("-");
      const primeiroDia = `${ano}-${mes}-01`;
      const lastDay = new Date(Number(ano), Number(mes), 0).getDate();
      const ultimoDia = `${ano}-${mes}-${String(lastDay).padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("servicos")
        .select("valor_mao_obra_instalador")
        .eq("status", "concluido")
        .gte("data_conclusao", primeiroDia)
        .lte("data_conclusao", ultimoDia + "T23:59:59");

      if (error) throw error;
      const total = (data || []).reduce((sum, s) => sum + Number(s.valor_mao_obra_instalador), 0);
      setTotalInstaladoresRecibos(total);
    } catch (error) {
      console.error("Erro ao carregar total de recibos:", error);
    }
  }

  async function carregarProjecao() {
    try {
      const [ano, mes] = filtroMes.split("-");
      const primeiroDia = `${ano}-${mes}-01`;
      const lastDay = new Date(Number(ano), Number(mes), 0).getDate();
      const ultimoDia = `${ano}-${mes}-${String(lastDay).padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("servicos")
        .select("valor_total, valor_mao_obra_instalador")
        .gte("data_servico_agendada", primeiroDia)
        .lte("data_servico_agendada", ultimoDia + "T23:59:59")
        .not("status", "eq", "cancelado");

      if (error) throw error;
      const total = (data || []).reduce((sum, s) => {
        const maoObra = Number(s.valor_mao_obra_instalador || 0);
        return sum + (maoObra === 0 ? Number(s.valor_total || 0) : maoObra * 2);
      }, 0);
      setTotalProjecao(total);
    } catch (error) {
      console.error("Erro ao carregar projeção:", error);
    }
  }

  async function carregarLancamentos() {
    setLoading(true);
    try {
      const [ano, mes] = filtroMes.split("-");
      const year = Number(ano);
      const monthIndex = Number(mes) - 1;
      const primeiroDia = `${ano}-${mes}-01`;
      const lastDay = new Date(year, monthIndex + 1, 0).getDate();
      const ultimoDia = `${ano}-${mes}-${String(lastDay).padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("lancamentos_caixa")
        .select("*")
        .gte("data_lancamento", primeiroDia)
        .lte("data_lancamento", ultimoDia)
        .order("data_lancamento", { ascending: false });

      if (error) throw error;
      setLancamentos(data || []);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  }

  const totalReceitas = lancamentos
    .filter((l) => l.tipo === "receita" && !CATEGORIAS_INSTALADORES.has(l.categoria))
    .reduce((acc, l) => acc + Number(l.valor), 0);

  // Lucro da empresa na venda de acessórios (já somado em totalReceitas acima,
  // aqui só pra destacar separadamente — sem isso fica escondido dentro do
  // total genérico de Receitas)
  const totalLucroAcessorios = lancamentos
    .filter((l) => l.tipo === "receita" && l.categoria === "Lucro Acessórios")
    .reduce((acc, l) => acc + Number(l.valor), 0);

  const totalDespesasGerais = lancamentos
    .filter((l) => l.tipo === "despesa" && !CATEGORIAS_INSTALADORES.has(l.categoria))
    .reduce((acc, l) => acc + Number(l.valor), 0);

  // Usar o total de recibos pagos como fonte única de verdade
  const totalInstaladores = totalInstaladoresRecibos;

  const saldo = totalReceitas - totalDespesasGerais - totalInstaladores;

  // Lançamentos filtrados para exibição
  const lancamentosFiltrados = lancamentos.filter((l) => {
    if (filtroTipo === "receitas") return l.tipo === "receita" && !CATEGORIAS_INSTALADORES.has(l.categoria);
    if (filtroTipo === "despesas_gerais") return l.tipo === "despesa" && !CATEGORIAS_INSTALADORES.has(l.categoria);
    if (filtroTipo === "instaladores") return CATEGORIAS_INSTALADORES.has(l.categoria);
    return true;
  });

  // Lançamentos ordenados
  const lancamentosOrdenados = [...lancamentosFiltrados].sort((a, b) => {
    const direcao = ordenacao.direcao === "asc" ? 1 : -1;
    
    switch (ordenacao.coluna) {
      case "data":
        return (new Date(a.data_lancamento).getTime() - new Date(b.data_lancamento).getTime()) * direcao;
      case "tipo":
        return a.tipo.localeCompare(b.tipo) * direcao;
      case "categoria":
        return (a.categoria || "").localeCompare(b.categoria || "") * direcao;
      case "descricao":
        return (a.descricao || "").localeCompare(b.descricao || "") * direcao;
      case "forma_pagamento":
        return (a.forma_pagamento || "").localeCompare(b.forma_pagamento || "") * direcao;
      case "valor":
        return (Number(a.valor) - Number(b.valor)) * direcao;
      default:
        return 0;
    }
  });

  const getTituloFiltro = () => {
    if (filtroTipo === "receitas") return "Receitas";
    if (filtroTipo === "despesas_gerais") return "Despesas Gerais";
    if (filtroTipo === "instaladores") return "Pagamentos Instaladores";
    return "Todos os Lançamentos";
  };

  // Dados agregados para o gráfico pizza (apenas despesas gerais)
  const dadosGraficoDespesas = useMemo(() => {
    const despesasGerais = lancamentos.filter(
      l => l.tipo === 'despesa' && !CATEGORIAS_INSTALADORES.has(l.categoria)
    );
    
    const agregado = despesasGerais.reduce((acc, item) => {
      const cat = item.categoria || 'Outros';
      acc[cat] = (acc[cat] || 0) + Number(item.valor);
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(agregado)
      .map(([categoria, valor]) => ({ categoria, valor: valor as number }))
      .sort((a, b) => b.valor - a.valor);
  }, [lancamentos]);

  const totalGraficoDespesas = dadosGraficoDespesas.reduce((s, d) => s + d.valor, 0);

  // Tooltip customizado para o gráfico
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const { categoria, valor } = payload[0].payload;
    const percentual = ((valor / totalGraficoDespesas) * 100).toFixed(1);
    
    return (
      <div className="bg-white border rounded-lg shadow-lg p-3">
        <p className="font-semibold">{categoria}</p>
        <p className="text-red-600">R$ {valor.toFixed(2)}</p>
        <p className="text-gray-500 text-sm">{percentual}%</p>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6">
          <h1 className="text-3xl font-bold">Caixa</h1>

          <div>
            <label className="mr-2 font-medium">Mês:</label>
            <input
              type="month"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-6">
            <p className="text-sm text-amber-600 font-medium mb-1">PROJEÇÃO</p>
            <p className="text-3xl font-bold text-amber-700">R$ {totalProjecao.toFixed(2)}</p>
          </div>

          <div 
            onClick={() => setFiltroTipo(filtroTipo === "receitas" ? "todos" : "receitas")}
            className={`bg-green-50 border-2 rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg ${
              filtroTipo === "receitas" ? "border-green-500 ring-2 ring-green-300" : "border-green-200"
            }`}
          >
            <p className="text-sm text-green-600 font-medium mb-1">RECEITAS</p>
            <p className="text-3xl font-bold text-green-700">R$ {totalReceitas.toFixed(2)}</p>
            {totalLucroAcessorios > 0 && (
              <p className="text-xs text-green-600 mt-1">
                inclui R$ {totalLucroAcessorios.toFixed(2)} de lucro em acessórios
              </p>
            )}
          </div>

          <div 
            onClick={() => setFiltroTipo(filtroTipo === "despesas_gerais" ? "todos" : "despesas_gerais")}
            className={`bg-red-50 border-2 rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg ${
              filtroTipo === "despesas_gerais" ? "border-red-500 ring-2 ring-red-300" : "border-red-200"
            }`}
          >
            <p className="text-sm text-red-600 font-medium mb-1">DESPESAS GERAIS</p>
            <p className="text-3xl font-bold text-red-700">R$ {totalDespesasGerais.toFixed(2)}</p>
          </div>

          <div 
            onClick={() => setFiltroTipo(filtroTipo === "instaladores" ? "todos" : "instaladores")}
            className={`bg-purple-50 border-2 rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg ${
              filtroTipo === "instaladores" ? "border-purple-500 ring-2 ring-purple-300" : "border-purple-200"
            }`}
          >
            <p className="text-sm text-purple-600 font-medium mb-1">INSTALADORES</p>
            <p className="text-3xl font-bold text-purple-700">R$ {totalInstaladores.toFixed(2)}</p>
          </div>

          <div
            className={`border-2 rounded-lg p-6 ${
              saldo >= 0 ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"
            }`}
          >
            <p className={`text-sm font-medium mb-1 ${saldo >= 0 ? "text-blue-600" : "text-orange-600"}`}>
              RESULTADO DO MÊS
            </p>
            <p className={`text-3xl font-bold ${saldo >= 0 ? "text-blue-700" : "text-orange-700"}`}>
              R$ {saldo.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Receita − despesas − mão de obra só do mês filtrado, não é o caixa acumulado.
            </p>
          </div>
        </div>

        {/* Título com filtro ativo */}
        {filtroTipo !== "todos" && (
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-semibold">{getTituloFiltro()}</h2>
            <button 
              onClick={() => setFiltroTipo("todos")}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              (ver todos)
            </button>
          </div>
        )}

        {/* Gráfico Pizza - Visível apenas no filtro Despesas Gerais */}
        {filtroTipo === "despesas_gerais" && dadosGraficoDespesas.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold mb-4">📊 Despesas por Categoria</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico Pizza */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosGraficoDespesas}
                      dataKey="valor"
                      nameKey="categoria"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {dadosGraficoDespesas.map((_, index) => (
                        <Cell key={index} fill={CORES_PIZZA[index % CORES_PIZZA.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* Legenda detalhada com valores */}
              <div className="space-y-2">
                {dadosGraficoDespesas.map((item, index) => {
                  const percentual = ((item.valor / totalGraficoDespesas) * 100).toFixed(1);
                  
                  return (
                    <div key={item.categoria} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: CORES_PIZZA[index % CORES_PIZZA.length] }}
                        />
                        <span className="font-medium">{item.categoria}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-red-600">R$ {item.valor.toFixed(2)}</span>
                        <span className="text-gray-500 text-sm ml-2">({percentual}%)</span>
                      </div>
                    </div>
                  );
                })}
                
                {/* Linha de Total */}
                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                  <span>Total:</span>
                  <span className="text-red-600">
                    R$ {totalGraficoDespesas.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Lançamentos */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Carregando...</div>
          </div>
        ) : lancamentosFiltrados.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Nenhum lançamento neste período</p>
          </div>
        ) : (
          <>
            {/* Mobile: lista em cards, sem scroll horizontal nem colunas cortadas */}
            <div className="md:hidden bg-white rounded-lg shadow divide-y divide-gray-200">
              {lancamentosOrdenados.map((lanc) => (
                <div key={lanc.id} className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        lanc.tipo === "receita" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {lanc.tipo === "receita" ? "📈 Receita" : "📉 Despesa"}
                    </span>
                    <span className="text-xs text-gray-500">{formatarDataBR(lanc.data_lancamento)}</span>
                  </div>
                  <p className="text-sm font-medium">{lanc.categoria}</p>
                  {lanc.descricao && (
                    <p className="text-sm text-gray-500 mt-0.5">{lanc.descricao}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">{lanc.forma_pagamento || "-"}</span>
                    <span
                      className={`text-base font-semibold ${
                        lanc.tipo === "receita" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {lanc.tipo === "receita" ? "+" : "-"} R$ {parseFloat(lanc.valor).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabela completa com ordenação por coluna */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    onClick={() => alternarOrdenacao("data")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center gap-1">
                      Data
                      {ordenacao.coluna === "data" && (
                        <span>{ordenacao.direcao === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => alternarOrdenacao("tipo")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center gap-1">
                      Tipo
                      {ordenacao.coluna === "tipo" && (
                        <span>{ordenacao.direcao === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => alternarOrdenacao("categoria")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center gap-1">
                      Categoria
                      {ordenacao.coluna === "categoria" && (
                        <span>{ordenacao.direcao === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => alternarOrdenacao("descricao")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center gap-1">
                      Descrição
                      {ordenacao.coluna === "descricao" && (
                        <span>{ordenacao.direcao === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => alternarOrdenacao("forma_pagamento")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center gap-1">
                      Forma Pgto
                      {ordenacao.coluna === "forma_pagamento" && (
                        <span>{ordenacao.direcao === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => alternarOrdenacao("valor")}
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Valor
                      {ordenacao.coluna === "valor" && (
                        <span>{ordenacao.direcao === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lancamentosOrdenados.map((lanc) => (
                  <tr key={lanc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {formatarDataBR(lanc.data_lancamento)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          lanc.tipo === "receita" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {lanc.tipo === "receita" ? "📈 Receita" : "📉 Despesa"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">{lanc.categoria}</td>
                    <td className="px-6 py-4 text-sm">{lanc.descricao}</td>
                    <td className="px-6 py-4 text-sm">{lanc.forma_pagamento || "-"}</td>
                    <td
                      className={`px-6 py-4 text-right font-semibold ${
                        lanc.tipo === "receita" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {lanc.tipo === "receita" ? "+" : "-"} R$ {parseFloat(lanc.valor).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
