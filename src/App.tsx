import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
// Pages
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import NotFound from "@/pages/NotFound";
// Admin Pages
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminCotacoesLista from "@/pages/admin/cotacoes/Lista";
import AdminCotacoesNova from "@/pages/admin/cotacoes/Nova";
import AdminServicosLista from "@/pages/admin/servicos/Lista";
import AdminAprovacoes from "@/pages/admin/Aprovacoes";
import Caixa from "@/pages/admin/Caixa";
import AdminInstaladores from "@/pages/admin/Instaladores";
import AdminRelatorios from "@/pages/admin/Relatorios";
import AdminDespesas from "@/pages/admin/Despesas";
// Instalador Pages
import InstaladorDashboard from "@/pages/instalador/Dashboard";
import InstaladorServicosDisponiveis from "@/pages/instalador/ServicosDisponiveis";
import InstaladorMinhaAgenda from "@/pages/instalador/MinhaAgenda";
import InstaladorFinalizarServico from "@/pages/instalador/FinalizarServico";
import InstaladorMeuExtrato from "@/pages/instalador/MeuExtrato";
import InstaladorBaseConhecimento from "@/pages/instalador/BaseConhecimento";
import AdminGerenciarConteudo from "@/pages/admin/GerenciarConteudo";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredType="admin">
                  <Outlet />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="cotacoes" element={<AdminCotacoesLista />} />
              <Route path="cotacoes/nova" element={<AdminCotacoesNova />} />
              <Route path="servicos" element={<AdminServicosLista />} />
              <Route path="aprovacoes" element={<AdminAprovacoes />} />
              <Route path="caixa" element={<Caixa />} />
              <Route path="despesas" element={<AdminDespesas />} />
              <Route path="instaladores" element={<AdminInstaladores />} />
              <Route path="relatorios" element={<AdminRelatorios />} />
              <Route path="conteudo" element={<AdminGerenciarConteudo />} />
            </Route>

            {/* Instalador Routes */}
            <Route
              path="/instalador"
              element={
                <ProtectedRoute requiredType="instalador">
                  <Outlet />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/instalador/dashboard" replace />} />
              <Route path="dashboard" element={<InstaladorDashboard />} />
              <Route path="servicos-disponiveis" element={<InstaladorServicosDisponiveis />} />
              <Route path="minha-agenda" element={<InstaladorMinhaAgenda />} />
              <Route path="finalizar-servico/:id" element={<InstaladorFinalizarServico />} />
              <Route path="extrato" element={<InstaladorMeuExtrato />} />
              <Route path="conhecimento" element={<InstaladorBaseConhecimento />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          <ShadcnToaster />
          <SonnerToaster />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
