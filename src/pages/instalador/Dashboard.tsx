import { InstaladorLayout } from '@/components/layout/InstaladorLayout'

export default function InstaladorDashboard() {
  return (
    <InstaladorLayout>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Meu Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Hoje</h3>
              <span className="text-3xl">📅</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Serviços:</span>
                <span className="font-bold">2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Ganho:</span>
                <span className="font-bold text-green-600">R$ 450,00</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Esta Semana</h3>
              <span className="text-3xl">📊</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Serviços:</span>
                <span className="font-bold">8</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Ganho:</span>
                <span className="font-bold text-green-600">R$ 1.800,00</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Este Mês</h3>
              <span className="text-3xl">📈</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Serviços:</span>
                <span className="font-bold">34</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Ganho:</span>
                <span className="font-bold text-green-600">R$ 7.600,00</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm opacity-90 mb-1">💰 A Receber</div>
                <div className="text-3xl font-bold">R$ 1.240,00</div>
              </div>
              <span className="text-6xl opacity-30">💵</span>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm opacity-90 mb-1">📊 Seu Nível</div>
                <div className="text-3xl font-bold">Nível 5 ⭐⭐⭐</div>
                <div className="text-sm opacity-90 mt-1">🏆 2º lugar no ranking</div>
              </div>
              <span className="text-6xl opacity-30">🎖️</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Próximos Serviços</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div>
                <div className="font-semibold">SRV-2025-045</div>
                <div className="text-sm text-gray-600">📅 Hoje - 14:00</div>
                <div className="text-sm text-gray-600">📍 Vila Mariana</div>
                <div className="text-sm text-gray-600">🔧 TV 50" + Suporte</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600">R$ 225,00</div>
                <button className="mt-2 bg-blue-600 text-white text-sm px-4 py-1 rounded hover:bg-blue-700">
                  Ver Detalhes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </InstaladorLayout>
  )
}
