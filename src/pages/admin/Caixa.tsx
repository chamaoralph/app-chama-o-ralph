import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";

// Categorias consideradas como custos de instaladores
const CATEGORIAS_INSTALADORES = new Set(["Pagamento Instalador", "Reembolso Materiais"]);

export default function Caixa() {
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "receitas" | "despesas_gerais" | "instaladores">("todos");

  useEffect(() => {
    // Setar mês atual como padrão
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    setFiltroMes(mesAtual);
  }, []);

  useEffect(() => {
    if (filtroMes) {
      carregarLancamentos();
    }
  }, [filtroMes]);

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
    .filter((l) => l.tipo === "receita")
    .reduce((acc, l) => acc + Number(l.valor), 0);

  const totalDespesasGerais = lancamentos
    .filter((l) => l.tipo === "despesa" && !CATEGORIAS_INSTALADORES.has(l.categoria))
    .reduce((acc, l) => acc + Number(l.valor), 0);

  const totalInstaladores = lancamentos
    .filter((l) => CATEGORIAS_INSTALADORES.has(l.categoria))
    .reduce((acc, l) => acc + Number(l.valor), 0);

  const saldo = totalReceitas - totalDespesasGerais - totalInstaladores;

  // Lançamentos filtrados para exibição
  const lancamentosFiltrados = lancamentos.filter((l) => {
    if (filtroTipo === "receitas") return l.tipo === "receita";
    if (filtroTipo === "despesas_gerais") return l.tipo === "despesa" && !CATEGORIAS_INSTALADORES.has(l.categoria);
    if (filtroTipo === "instaladores") return CATEGORIAS_INSTALADORES.has(l.categoria);
    return true;
  });

  const getTituloFiltro = () => {
    if (filtroTipo === "receitas") return "Receitas";
    if (filtroTipo === "despesas_gerais") return "Despesas Gerais";
    if (filtroTipo === "instaladores") return "Pagamentos Instaladores";
    return "Todos os Lançamentos";
  };

  return (
    <AdminLayout>
      <div>
        <div className="flex justify-between items-center mb-6">
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
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div 
            onClick={() => setFiltroTipo(filtroTipo === "receitas" ? "todos" : "receitas")}
            className={`bg-green-50 border-2 rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg ${
              filtroTipo === "receitas" ? "border-green-500 ring-2 ring-green-300" : "border-green-200"
            }`}
          >
            <p className="text-sm text-green-600 font-medium mb-1">RECEITAS</p>
            <p className="text-3xl font-bold text-green-700">R$ {totalReceitas.toFixed(2)}</p>
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
            <p className={`text-sm font-medium mb-1 ${saldo >= 0 ? "text-blue-600" : "text-orange-600"}`}>SALDO</p>
            <p className={`text-3xl font-bold ${saldo >= 0 ? "text-blue-700" : "text-orange-700"}`}>
              R$ {saldo.toFixed(2)}
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
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Forma Pgto</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lancamentosFiltrados.map((lanc) => (
                  <tr key={lanc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(lanc.data_lancamento).toLocaleDateString("pt-BR")}
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
        )}
      </div>
    </AdminLayout>
  );
}
