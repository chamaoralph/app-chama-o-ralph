import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'

interface Servico {
  id: string
  codigo: string
  empresa_id: string
  cliente_id: string
  instalador_id: string | null
  tipo_servico: string[]
  status: string
  created_at: string
  data_servico_agendada: string
  valor_total: number
  valor_mao_obra_instalador: number | null
  clientes: {
    nome: string
  }
  usuarios?: {
    nome: string
  }
}

export default function ListaServicos() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchServicos()
  }, [user])

  async function fetchServicos() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          *,
          clientes(nome),
          usuarios!fk_servicos_instalador(nome)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setServicos(data as any || [])
    } catch (err) {
      console.error('Erro ao buscar serviços:', err)
      setError('Erro ao carregar serviços')
    } finally {
      setLoading(false)
    }
  }

  async function disponibilizarServico(servicoId: string) {
    try {
      const { error } = await supabase
        .from('servicos')
        .update({ status: 'disponivel' })
        .eq('id', servicoId)

      if (error) throw error

      toast({
        title: "Serviço disponibilizado",
        description: "O serviço foi disponibilizado para os instaladores",
      })

      fetchServicos()
    } catch (err) {
      console.error('Erro ao disponibilizar serviço:', err)
      toast({
        title: "Erro",
        description: "Não foi possível disponibilizar o serviço",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      aguardando_distribuicao: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Aguardando Distribuição' },
      disponivel: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Disponível' },
      atribuido: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Atribuído' },
      em_andamento: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Em Andamento' },
      aguardando_aprovacao: { bg: 'bg-cyan-100', text: 'text-cyan-800', label: 'Aguardando Aprovação' },
      concluido: { bg: 'bg-green-100', text: 'text-green-800', label: 'Concluído' },
      cancelado: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelado' },
    }
    const badge = badges[status] || badges.aguardando_distribuicao
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Carregando serviços...</div>
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Serviços</h1>
            <p className="text-gray-600 mt-2">Gerencie todos os serviços da empresa</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Serviço
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Instalador
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Agendada
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {servicos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        <p className="text-lg font-medium">Nenhum serviço cadastrado</p>
                        <p className="text-sm mt-1">Confirme uma cotação para criar um serviço</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  servicos.map((servico) => (
                    <tr key={servico.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{servico.codigo}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{servico.clientes.nome}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {servico.tipo_servico?.join(', ') || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {servico.usuarios?.nome || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(servico.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          R$ {Number(servico.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(servico.data_servico_agendada).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {servico.status === 'aguardando_distribuicao' && (
                          <button
                            onClick={() => disponibilizarServico(servico.id)}
                            className="text-blue-600 hover:text-blue-800 font-medium mr-4"
                          >
                            Disponibilizar
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/admin/servicos/${servico.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
          <div>
            Mostrando {servicos.length} serviço(s)
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
