import { useEffect, useState } from "react";
import { InstaladorLayout } from "@/components/layout/InstaladorLayout";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MinhaAgenda() {
  const [servicos, setServicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    carregarMeusServicos();
  }, []);

  async function carregarMeusServicos() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (!user) {
        console.error("Usuário não autenticado");
        return;
      }

      console.log("Buscando serviços para instalador:", user.id);

      const { data, error } = await supabase
        .from("servicos")
        .select(
          `
          *,
          clientes (nome, telefone, endereco_completo, bairro)
        `
        )
        .eq("instalador_id", user.id)
        .in("status", ["atribuido", "em_andamento"])
        .order("data_servico_agendada", { ascending: true });

      if (error) {
        console.error("Erro ao buscar serviços:", error);
        throw error;
      }
      
      console.log("Serviços encontrados:", data);
      setServicos(data || []);
    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
    } finally {
      setLoading(false);
    }
  }

  async function iniciarServico(servicoId: string) {
    try {
      const { error } = await supabase
        .from("servicos")
        .update({
          status: "em_andamento",
        })
        .eq("id", servicoId);

      if (error) throw error;
      alert("✅ Serviço iniciado!");
      carregarMeusServicos();
    } catch (error: any) {
      alert("❌ Erro: " + error.message);
    }
  }

  if (loading) {
    return (
      <InstaladorLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Carregando...</div>
        </div>
      </InstaladorLayout>
    );
  }

  return (
    <InstaladorLayout>
      <div>
        <h1 className="text-3xl font-bold mb-6">Minha Agenda</h1>

        {servicos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Você não tem serviços agendados</p>
          </div>
        ) : (
          <div className="space-y-4">
            {servicos.map((servico) => (
              <div key={servico.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{servico.codigo}</h3>
                    <div className="space-y-1 text-gray-600">
                      <p>📅 {format(new Date(servico.data_servico_agendada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                      <p>👤 {servico.clientes.nome}</p>
                      <p>📞 {servico.clientes.telefone}</p>
                      <p>📍 {servico.clientes.endereco_completo}</p>
                      <p>🏘️ {servico.clientes.bairro}</p>
                      <p>🔧 {servico.tipo_servico?.join(", ")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600 mb-2">
                      R$ {servico.valor_mao_obra_instalador?.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500 mb-4">sua parte</p>

                    <div className="space-y-2">
                      <button
                        onClick={() => window.open(`https://maps.google.com/?q=${servico.clientes.endereco_completo}`)}
                        className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                      >
                        🗺️ Ver no Mapa
                      </button>

                      <button
                        onClick={() => (window.location.href = `tel:${servico.clientes.telefone}`)}
                        className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                      >
                        📞 Ligar
                      </button>

                      {servico.status === "atribuido" && (
                        <button
                          onClick={() => iniciarServico(servico.id)}
                          className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        >
                          ▶️ Iniciar Serviço
                        </button>
                      )}

                      {servico.status === "em_andamento" && (
                        <button
                          onClick={() => navigate(`/instalador/finalizar-servico/${servico.id}`)}
                          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        >
                          ✅ Finalizar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </InstaladorLayout>
  );
}
