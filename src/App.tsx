import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
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
// Instalador Pages
import InstaladorDashboard from "@/pages/instalador/Dashboard";
import InstaladorServicosDisponiveis from "@/pages/instalador/ServicosDisponiveis";
import InstaladorMinhaAgenda from "@/pages/instalador/MinhaAgenda";
import InstaladorFinalizarServico from "@/pages/instalador/FinalizarServico";

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
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
