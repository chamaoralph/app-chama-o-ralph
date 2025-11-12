import { AdminLayout } from '@/components/layout/AdminLayout'

export default function AdminDashboard() {
  return (
    <AdminLayout>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard Administrativo</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Hoje</h3>
              <span className="text-3xl">📅</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Serviços:</span>
                <span className="font-bold">5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Faturamento:</span>
                <span className="font-bold text-green-600">R$ 1.200,00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Lucro:</span>
                <span className="font-bold text-blue-600">R$ 600,00</span>
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
                <span className="font-bold">23</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Faturamento:</span>
                <span className="font-bold text-green-600">R$ 6.800,00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Lucro:</span>
                <span className="font-bold text-blue-600">R$ 3.200,00</span>
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
                <span className="font-bold">99</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Faturamento:</span>
                <span className="font-bold text-green-600">R$ 28.400,00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Lucro:</span>
                <span className="font-bold text-blue-600">R$ 12.800,00</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Serviços Hoje</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">2</div>
              <div className="text-sm text-gray-600">Em andamento</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-3xl font-bold text-yellow-600">3</div>
              <div className="text-sm text-gray-600">Agendados</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">0</div>
              <div className="text-sm text-gray-600">Concluídos</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-3xl font-bold text-red-600">0</div>
              <div className="text-sm text-gray-600">Atrasados</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Instaladores Ativos</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <div className="font-semibold">João</div>
                <div className="text-sm text-gray-600">2 serviços hoje</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-yellow-600">Nível 5 ⭐</div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <div className="font-semibold">Ralph & Ray</div>
                <div className="text-sm text-gray-600">3 serviços hoje</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-yellow-600">Nível 8 ⭐⭐</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
