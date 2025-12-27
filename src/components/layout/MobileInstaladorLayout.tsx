import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Home, Calendar, ClipboardList, Wallet, Menu, BookOpen, Award, LogOut, X } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";

interface MobileInstaladorLayoutProps {
  children: ReactNode;
  servicosDisponiveis?: number;
}

const navItems = [
  { to: "/instalador", icon: Home, label: "Início" },
  { to: "/instalador/servicos-disponiveis", icon: ClipboardList, label: "Disponíveis", showBadge: true },
  { to: "/instalador/minha-agenda", icon: Calendar, label: "Agenda" },
  { to: "/instalador/extrato", icon: Wallet, label: "Extrato" },
];

const moreItems = [
  { to: "/instalador/conhecimento", icon: BookOpen, label: "Base de Conhecimento" },
  { to: "/instalador/meus-certificados", icon: Award, label: "Minhas Certificações" },
];

export function MobileInstaladorLayout({ children, servicosDisponiveis = 0 }: MobileInstaladorLayoutProps) {
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
    if (path === "/instalador") {
      return location.pathname === "/instalador";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div>
          <h1 className="text-lg font-bold">Chama o Ralph</h1>
          <p className="text-xs text-blue-200">Instalador</p>
        </div>
        <div className="text-xs text-blue-200 truncate max-w-[120px]">
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
                    ? "text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <div className="relative">
                  <Icon className="h-6 w-6" />
                  {item.showBadge && servicosDisponiveis > 0 && (
                    <Badge className="absolute -top-2 -right-3 h-5 min-w-[20px] flex items-center justify-center bg-green-500 text-[10px] px-1">
                      {servicosDisponiveis}
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] mt-1">{item.label}</span>
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-600 rounded-b-full" />
                )}
              </Link>
            );
          })}

          {/* More Drawer */}
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild>
              <button
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  drawerOpen
                    ? "text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Menu className="h-6 w-6" />
                <span className="text-[10px] mt-1">Mais</span>
              </button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader className="border-b">
                <div className="flex items-center justify-between">
                  <DrawerTitle>Menu</DrawerTitle>
                  <DrawerClose asChild>
                    <button className="p-2 hover:bg-gray-100 rounded-full">
                      <X className="h-5 w-5" />
                    </button>
                  </DrawerClose>
                </div>
              </DrawerHeader>
              <div className="p-4 space-y-2">
                {moreItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setDrawerOpen(false)}
                      className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <Icon className="h-6 w-6 text-blue-600" />
                      <span className="text-gray-900 font-medium">{item.label}</span>
                    </Link>
                  );
                })}
                <div className="border-t my-4" />
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-4 p-4 rounded-lg hover:bg-red-50 transition-colors w-full text-left"
                >
                  <LogOut className="h-6 w-6 text-red-600" />
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
