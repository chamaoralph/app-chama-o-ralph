import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { 
  Home, 
  FileText, 
  Wrench, 
  DollarSign, 
  Menu, 
  Users, 
  BookOpen, 
  Award, 
  LogOut, 
  X,
  ClipboardList,
  BarChart3,
  CheckCircle,
  TrendingUp,
  Receipt,
  Settings
} from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";

interface MobileAdminLayoutProps {
  children: ReactNode;
  pendingCount?: number;
}

const navItems = [
  { to: "/admin", icon: Home, label: "Início" },
  { to: "/admin/cotacoes", icon: FileText, label: "Cotações" },
  { to: "/admin/servicos", icon: Wrench, label: "Serviços" },
  { to: "/admin/caixa", icon: DollarSign, label: "Caixa" },
];

const moreItems = [
  { to: "/admin/clientes", icon: Users, label: "Clientes" },
  { to: "/admin/instaladores", icon: Users, label: "Instaladores" },
  { to: "/admin/despesas", icon: Receipt, label: "Despesas" },
  { to: "/admin/conteudo", icon: BookOpen, label: "Gerenciar Conteúdo" },
  { to: "/admin/questionarios", icon: ClipboardList, label: "Questionários" },
  { to: "/admin/certificacoes", icon: Award, label: "Certificações" },
  { to: "/admin/relatorios", icon: BarChart3, label: "Relatórios" },
  { to: "/admin/marketing", icon: TrendingUp, label: "Marketing" },
  { to: "/admin/aprovacoes", icon: CheckCircle, label: "Aprovações" },
  { to: "/admin/configuracoes", icon: Settings, label: "Configurações" },
];

export function MobileAdminLayout({ children, pendingCount = 0 }: MobileAdminLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleSignOut() {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  }

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div>
          <h1 className="text-lg font-bold">Chama o Ralph</h1>
          <p className="text-xs text-gray-400">Administração</p>
        </div>
        <div className="text-xs text-gray-400 truncate max-w-[120px]">
          {user?.email}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20">
        <div className="p-4">{children}</div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
                  active
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-[10px] mt-1">{item.label}</span>
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-gray-900 rounded-b-full" />
                )}
              </Link>
            );
          })}

          {/* More Drawer */}
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild>
              <button
                className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
                  drawerOpen
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <div className="relative">
                  <Menu className="h-6 w-6" />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-1">Mais</span>
              </button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85vh]">
              <DrawerHeader className="border-b">
                <div className="flex items-center justify-between">
                  <DrawerTitle>Menu Completo</DrawerTitle>
                  <DrawerClose asChild>
                    <button className="p-2 hover:bg-gray-100 rounded-full">
                      <X className="h-5 w-5" />
                    </button>
                  </DrawerClose>
                </div>
              </DrawerHeader>
              <div className="p-4 space-y-1 overflow-y-auto max-h-[60vh]">
                {moreItems.map((item) => {
                  const Icon = item.icon;
                  const isAprovacoes = item.to === "/admin/aprovacoes";
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex items-center justify-between p-4 rounded-lg hover:bg-gray-100 transition-colors ${
                        isActive(item.to) ? "bg-gray-100" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <Icon className="h-5 w-5 text-gray-600" />
                        <span className="text-gray-900 font-medium">{item.label}</span>
                      </div>
                      {isAprovacoes && pendingCount > 0 && (
                        <Badge variant="destructive">{pendingCount}</Badge>
                      )}
                    </Link>
                  );
                })}
                <div className="border-t my-4" />
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-4 p-4 rounded-lg hover:bg-red-50 transition-colors w-full text-left"
                >
                  <LogOut className="h-5 w-5 text-red-600" />
                  <span className="text-red-600 font-medium">Sair</span>
                </button>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </nav>
    </div>
  );
}
