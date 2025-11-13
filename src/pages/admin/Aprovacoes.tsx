import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";

export default function Aprovacoes() {
  const [servicos, setServicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarPendentes();
  }, []);

  async function carregarPendentes() {
    try {
      const { data, error } = await supabase
        .from("servicos")
        .select(
          `
          *,
          clientes (nome, telefone),
          instaladores!inner (id, usuarios!inner (nome))
        `,
        )
        .eq("status", "aguardando_aprovacao")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setServicos(data || []);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  }

  async function aprovarServico(servicoId: string) {
    if (!confirm("Aprovar este serviço?")) return;

    try {
      const { error } = await supabase.from("servicos").update({ status: "concluido" }).eq("id", servicoId);

      if (error) throw error;

      alert("✅ Serviço aprovado!");
      carregarPendentes();
    } catch (error: any) {
      alert("❌ Erro: " + error.message);
    }
  }

  async function solicitarCorrecao(servicoId: string) {
    const motivo = prompt("Digite o motivo da correção:");
    if (!motivo) return;

    try {
      const { error } = await supabase
        .from("servicos")
        .update({
          status: "em_andamento",
          observacoes_gestor: `CORREÇÃO: ${motivo}`,
        })
        .eq("id", servicoId);

      if (error) throw error;

      alert("✅ Correção solicitada!");
      carregarPendentes();
    } catch (error: any) {
      alert("❌ Erro: " + error.message);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Carregando...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div>
        <h1 className="text-3xl font-bold mb-6">Aprovações Pendentes ({servicos.length})</h1>

        {servicos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Nenhum serviço aguardando aprovação</p>
          </div>
        ) : (
          <div className="space-y-6">
            {servicos.map((servico) => (
              <div key={servico.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{servico.codigo}</h2>
                    <div className="space-y-1 text-gray-600">
                      <p>
                        <strong>Cliente:</strong> {servico.clientes.nome}
                      </p>
                      <p>
                        <strong>Telefone:</strong> {servico.clientes.telefone}
                      </p>
                      <p>
                        <strong>Instalador:</strong> {servico.instaladores?.usuarios?.nome || "N/A"}
                      </p>
                      <p>
                        <strong>Serviço:</strong> {servico.tipo_servico?.join(", ")}
                      </p>
                      <p>
                        <strong>Concluído em:</strong> {new Date(servico.updated_at).toLocaleString("pt-BR")}
                      </p>
                      {servico.observacoes_instalador && (
                        <p className="mt-2 text-sm">
                          <strong>Observações:</strong> {servico.observacoes_instalador}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg">
                      <strong>Valor Total:</strong> R$ {servico.valor_total?.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Mão de obra: R$ {servico.valor_mao_obra_instalador?.toFixed(2)}
                    </p>
                    {servico.valor_reembolso_despesas > 0 && (
                      <p className="text-sm text-orange-600">
                        Reembolso: R$ {servico.valor_reembolso_despesas?.toFixed(2)}
                      </p>
                    )}
                    <p className="text-lg font-bold text-green-600 mt-2">
                      Lucro: R${" "}
                      {(
                        servico.valor_total -
                        servico.valor_mao_obra_instalador -
                        (servico.valor_reembolso_despesas || 0)
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Fotos */}
                <div className="mb-4">
                  <h3 className="font-semibold mb-3">📸 Fotos do Serviço:</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {servico.fotos_conclusao?.map((foto: string, index: number) => (
                      <img
                        key={index}
                        src={foto}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-80"
                        onClick={() => window.open(foto, "_blank")}
                      />
                    ))}
                  </div>
                </div>

                {/* Nota Fiscal */}
                {servico.nota_fiscal_url && (
                  <div className="mb-4">
                    <a href={servico.nota_fiscal_url} target="_blank" className="text-blue-600 hover:underline">
                      📄 Ver Nota Fiscal
                    </a>
                  </div>
                )}

                {/* Botões */}
                <div className="flex gap-3">
                  <button
                    onClick={() => aprovarServico(servico.id)}
                    className="flex-1 bg-green-600 text-white py-3 rounded-md hover:bg-green-700 font-semibold"
                  >
                    ✅ Aprovar e Registrar no Caixa
                  </button>
                  <button
                    onClick={() => solicitarCorrecao(servico.id)}
                    className="px-6 bg-red-600 text-white py-3 rounded-md hover:bg-red-700 font-semibold"
                  >
                    ❌ Solicitar Correção
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
