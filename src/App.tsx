import { lazy, Suspense } from "react";
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
import Instalar from "@/pages/Instalar";
import NotFound from "@/pages/NotFound";
// Admin Pages
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminCotacoesLista from "@/pages/admin/cotacoes/Lista";
import AdminCotacoesNova from "@/pages/admin/cotacoes/Nova";
import AdminServicosLista from "@/pages/admin/servicos/Lista";
import AdminServicoDetalhe from "@/pages/admin/servicos/Detalhe";
import AdminAprovacoes from "@/pages/admin/Aprovacoes";
import Caixa from "@/pages/admin/Caixa";
import AdminInstaladores from "@/pages/admin/Instaladores";
import AdminRelatorios from "@/pages/admin/Relatorios";
import AdminDespesas from "@/pages/admin/Despesas";
import AdminMarketing from "@/pages/admin/Marketing";
import AdminClientes from "@/pages/admin/Clientes";
// Instalador Pages
import InstaladorDashboard from "@/pages/instalador/Dashboard";
import InstaladorServicosDisponiveis from "@/pages/instalador/ServicosDisponiveis";
import InstaladorMinhaAgenda from "@/pages/instalador/MinhaAgenda";
import InstaladorFinalizarServico from "@/pages/instalador/FinalizarServico";
import InstaladorMeuExtrato from "@/pages/instalador/MeuExtrato";
import InstaladorBaseConhecimento from "@/pages/instalador/BaseConhecimento";
import AdminGerenciarConteudo from "@/pages/admin/GerenciarConteudo";

const AdminQuestionarios = lazy(() => import('./pages/admin/Questionarios'));
const AdminGerenciarPerguntas = lazy(() => import('./pages/admin/GerenciarPerguntas'));
const AdminCertificacoes = lazy(() => import('./pages/admin/CertificacoesInstaladores'));
const InstaladorFazerQuestionario = lazy(() => import('./pages/instalador/FazerQuestionario'));
const InstaladorResultado = lazy(() => import('./pages/instalador/ResultadoQuestionario'));
const InstaladorCertificados = lazy(() => import('./pages/instalador/MeusCertificados'));

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
            <Route path="/instalar" element={<Instalar />} />

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
              <Route path="servicos/:id" element={<AdminServicoDetalhe />} />
              <Route path="aprovacoes" element={<AdminAprovacoes />} />
              <Route path="caixa" element={<Caixa />} />
              <Route path="despesas" element={<AdminDespesas />} />
              <Route path="instaladores" element={<AdminInstaladores />} />
              <Route path="clientes" element={<AdminClientes />} />
              <Route path="relatorios" element={<AdminRelatorios />} />
              <Route path="marketing" element={<AdminMarketing />} />
              <Route path="conteudo" element={<AdminGerenciarConteudo />} />
              <Route path="questionarios" element={<Suspense><AdminQuestionarios /></Suspense>} />
              <Route path="questionarios/:id/perguntas" element={<Suspense><AdminGerenciarPerguntas /></Suspense>} />
              <Route path="certificacoes" element={<Suspense><AdminCertificacoes /></Suspense>} />
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
              <Route path="fazer-questionario/:id" element={<Suspense><InstaladorFazerQuestionario /></Suspense>} />
              <Route path="resultado-questionario/:tentativaId" element={<Suspense><InstaladorResultado /></Suspense>} />
              <Route path="meus-certificados" element={<Suspense><InstaladorCertificados /></Suspense>} />
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
