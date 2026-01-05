import { useEffect, useState } from "react";
import { InstaladorLayout } from "@/components/layout/InstaladorLayout";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { AgendaSemanal } from "@/components/instalador/AgendaSemanal";

export default function MinhaAgenda() {
  const [servicos, setServicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </InstaladorLayout>
    );
  }

  return (
    <InstaladorLayout>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">
          Minha Agenda
        </h1>

        <AgendaSemanal
          servicos={servicos}
          onIniciar={iniciarServico}
          onFinalizar={finalizarServico}
        />
      </div>
    </InstaladorLayout>
  );
}
