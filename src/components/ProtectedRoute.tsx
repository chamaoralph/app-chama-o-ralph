import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredType?: 'admin' | 'instalador'
}

export function ProtectedRoute({ children, requiredType }: ProtectedRouteProps) {
  const { user, userType, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredType && userType !== requiredType) {
    return <Navigate to={userType === 'admin' ? '/admin' : '/instalador'} replace />
  }

  return <>{children}</>
}
