import { useEffect, useState } from "react";
import { InstaladorLayout } from "@/components/layout/InstaladorLayout";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileServicoCard } from "@/components/instalador/MobileServicoCard";
import { Phone, MapPin, Play, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MinhaAgenda() {
  const [servicos, setServicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();

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

      const { data, error } = await supabase
        .from("servicos")
        .select(
          `
          *,
          clientes (nome, telefone, endereco_completo, bairro)
        `
        )
        .eq("instalador_id", user.id)
        .in("status", ["solicitado", "atribuido", "em_andamento"])
        .order("data_servico_agendada", { ascending: true });

      if (error) throw error;
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
        .update({ status: "em_andamento" })
        .eq("id", servicoId);

      if (error) throw error;
      toast({
        title: "✅ Serviço iniciado!",
        description: "Bom trabalho! Você pode finalizar quando concluir.",
      });
      carregarMeusServicos();
    } catch (error: any) {
      toast({
        title: "❌ Erro ao iniciar serviço",
        description: error.message,
        variant: "destructive",
      });
    }
  }

  function finalizarServico(servicoId: string) {
    navigate(`/instalador/finalizar-servico/${servicoId}`);
  }

  if (loading) {
    return (
      <InstaladorLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </InstaladorLayout>
    );
  }

  return (
    <InstaladorLayout>
      <div>
        <h1 className={`font-bold mb-4 ${isMobile ? "text-2xl" : "text-3xl mb-6"}`}>
          Minha Agenda
        </h1>

        {servicos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-gray-500">Você não tem serviços agendados</p>
          </div>
        ) : (
          <div className="space-y-4">
            {servicos.map((servico) =>
              isMobile ? (
                <MobileServicoCard
                  key={servico.id}
                  servico={servico}
                  variant="agenda"
                  onIniciar={iniciarServico}
                  onFinalizar={finalizarServico}
                />
              ) : (
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

                        {servico.status === "solicitado" && (
                          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded text-sm text-center">
                            ⏳ Aguardando aprovação
                          </div>
                        )}

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
                            onClick={() => finalizarServico(servico.id)}
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                          >
                            ✅ Finalizar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </InstaladorLayout>
  );
}
