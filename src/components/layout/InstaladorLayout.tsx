import { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

interface InstaladorLayoutProps {
  children: ReactNode
}

export function InstaladorLayout({ children }: InstaladorLayoutProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Erro ao sair:', error)
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-blue-900 text-white flex flex-col">
        <div className="p-4 border-b border-blue-800">
          <h1 className="text-2xl font-bold">Ralph & Ray</h1>
          <p className="text-sm text-blue-200 mt-1">Instalador</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link to="/instalador" className="block px-4 py-2 rounded hover:bg-blue-800 transition-colors">
            📊 Meu Dashboard
          </Link>
          <Link to="/instalador/disponiveis" className="block px-4 py-2 rounded hover:bg-blue-800 transition-colors">
            🆕 Serviços Disponíveis
          </Link>
          <Link to="/instalador/agenda" className="block px-4 py-2 rounded hover:bg-blue-800 transition-colors">
            📅 Minha Agenda
          </Link>
          <Link to="/instalador/ganhos" className="block px-4 py-2 rounded hover:bg-blue-800 transition-colors">
            💰 Meus Ganhos
          </Link>
          <Link to="/instalador/treinamentos" className="block px-4 py-2 rounded hover:bg-blue-800 transition-colors">
            🎓 Treinamentos
          </Link>
          <Link to="/instalador/wiki" className="block px-4 py-2 rounded hover:bg-blue-800 transition-colors">
            📚 Base de Conhecimento
          </Link>
        </nav>

        <div className="p-4 border-t border-blue-800">
          <div className="text-sm text-blue-200 mb-2">{user?.email}</div>
          <button onClick={handleSignOut} className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors">
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
