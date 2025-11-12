import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/auth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import AdminDashboard from '@/pages/admin/Dashboard'
import InstaladorDashboard from '@/pages/instalador/Dashboard'
import ListaCotacoes from '@/pages/admin/cotacoes/Lista'
import NovaCotacao from '@/pages/admin/cotacoes/Nova'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin" element={<ProtectedRoute requiredType="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/cotacoes" element={<ProtectedRoute requiredType="admin"><ListaCotacoes /></ProtectedRoute>} />
          <Route path="/admin/cotacoes/nova" element={<ProtectedRoute requiredType="admin"><NovaCotacao /></ProtectedRoute>} />
          <Route path="/instalador" element={<ProtectedRoute requiredType="instalador"><InstaladorDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
