import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-2xl font-bold">Chama o Ralph</h1>
          <p className="text-sm text-gray-400 mt-1">Administração</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link to="/admin" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            📊 Dashboard
          </Link>
          <Link to="/admin/cotacoes" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            📝 Cotações
          </Link>
          <Link to="/admin/servicos" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            🔧 Serviços
          </Link>
          <Link to="/admin/instaladores" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            👥 Instaladores
          </Link>
          <Link to="/admin/caixa" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            💰 Financeiro
          </Link>
          <Link to="/admin/aprovacoes" className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors">
            ✅ Aprovações
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
