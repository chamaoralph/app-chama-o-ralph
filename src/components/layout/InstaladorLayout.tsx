import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileInstaladorLayout } from "./MobileInstaladorLayout";
import { supabase } from "@/integrations/supabase/client";

interface InstaladorLayoutProps {
  children: ReactNode;
}

export function InstaladorLayout({ children }: InstaladorLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [servicosDisponiveis, setServicosDisponiveis] = useState(0);

  useEffect(() => {
    async function fetchServicosDisponiveis() {
      try {
        const { data: userData } = await supabase
          .from("usuarios")
          .select("empresa_id")
          .eq("id", user?.id)
          .single();

        if (userData) {
          const { count } = await supabase
            .from("servicos")
            .select("id", { count: "exact", head: true })
            .eq("empresa_id", userData.empresa_id)
            .eq("status", "disponivel");

          setServicosDisponiveis(count || 0);
        }
      } catch (error) {
        console.error("Erro ao buscar serviços disponíveis:", error);
      }
    }

    if (user?.id) {
      fetchServicosDisponiveis();
    }
  }, [user?.id]);

  async function handleSignOut() {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  }

  // Usar layout mobile em telas pequenas
  if (isMobile) {
    return (
      <MobileInstaladorLayout servicosDisponiveis={servicosDisponiveis}>
        {children}
      </MobileInstaladorLayout>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-blue-900 text-white flex flex-col">
        <div className="p-4 border-b border-blue-800">
          <h1 className="text-2xl font-bold">Chama o Ralph</h1>
          <p className="text-sm text-blue-200 mt-1">Instalador</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link to="/instalador" className="block px-4 py-2 rounded hover:bg-blue-800 transition-colors">
            📊 Meu Dashboard
          </Link>
          <Link
            to="/instalador/servicos-disponiveis"
            className="block px-4 py-2 rounded hover:bg-blue-800 transition-colors relative"
          >
            🆕 Serviços Disponíveis
            {servicosDisponiveis > 0 && (
              <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                {servicosDisponiveis}
              </span>
            )}
          </Link>
          <Link to="/instalador/minha-agenda" className="block px-4 py-2 rounded hover:bg-blue-800 transition-colors">
            📅 Minha Agenda
          </Link>
          <Link to="/instalador/extrato" className="block px-4 py-2 rounded hover:bg-blue-800 transition-colors">
            💰 Meu Extrato
          </Link>
          <Link to="/instalador/conhecimento" className="block px-4 py-2 rounded hover:bg-blue-800 transition-colors">
            📚 Base de Conhecimento
          </Link>
          <Link to="/instalador/meus-certificados" className="block px-4 py-2 rounded hover:bg-blue-800 transition-colors">
            🏆 Minhas Certificações
          </Link>
        </nav>

        <div className="p-4 border-t border-blue-800">
          <div className="text-sm text-blue-200 mb-2">{user?.email}</div>
          <button
            onClick={handleSignOut}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
