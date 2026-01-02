import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileAdminLayout } from "./MobileAdminLayout";
import { supabase } from "@/integrations/supabase/client";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function fetchPendingCount() {
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
            .in("status", ["solicitado", "aguardando_aprovacao"]);

          setPendingCount(count || 0);
        }
      } catch (error) {
        console.error("Erro ao buscar pendências:", error);
      }
    }

    if (user?.id) {
      fetchPendingCount();
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
      <MobileAdminLayout pendingCount={pendingCount}>
        {children}
      </MobileAdminLayout>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-2xl font-bold">Chama o Ralph</h1>
          <p className="text-sm text-gray-400 mt-1">Administração</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link to="/admin" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            📊 Dashboard
          </Link>
          <Link to="/admin/cotacoes" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            📝 Cotações
          </Link>
          <Link to="/admin/clientes" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            👥 Clientes
          </Link>
          <Link to="/admin/servicos" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            🔧 Serviços
          </Link>
          <Link to="/admin/instaladores" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            👷 Instaladores
          </Link>
          <Link to="/admin/caixa" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            💰 Caixa
          </Link>
          <Link to="/admin/despesas" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            💸 Despesas
          </Link>
          <Link to="/admin/conteudo" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            📚 Gerenciar Conteúdo
          </Link>
          <Link to="/admin/questionarios" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            📝 Questionários
          </Link>
          <Link to="/admin/certificacoes" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            🏆 Certificações
          </Link>
          <Link to="/admin/relatorios" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            📊 Relatórios
          </Link>
          <Link to="/admin/analise-rfm" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            🎯 Análise RFM
          </Link>
          <Link to="/admin/marketing" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            📈 Marketing
          </Link>
          <Link to="/admin/aprovacoes" className="flex items-center justify-between px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            <span>✅ Aprovações</span>
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </Link>
          <Link to="/admin/configuracoes" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            ⚙️ Configurações
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="text-sm text-gray-400 mb-2">{user?.email}</div>
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
