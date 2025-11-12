import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'

interface Cotacao {
  id: string
  cliente_id: string
  tipo_servico: string[]
  status: string
  created_at: string
  data_servico_desejada: string | null
  valor_estimado: number | null
  clientes: {
    nome: string
  }
}

export default function ListaCotacoes() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCotacoes()
  }, [user])

  async function fetchCotacoes() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('cotacoes')
        .select('*, clientes(*)')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setCotacoes(data || [])
    } catch (err) {
      console.error('Erro ao buscar cotações:', err)
      setError('Erro ao carregar cotações')
    } finally {
      setLoading(false)
    }
  }

  async function confirmarCotacao(id: string) {
    if (!confirm('Confirmar esta cotação?')) return
    
    console.log('Confirmando cotação:', id)
    
    const { data, error } = await supabase
      .from('cotacoes')
      .update({ status: 'confirmada' })
      .eq('id', id)
    
    console.log('Resultado:', { data, error })
    
    if (error) {
      console.error('Erro ao atualizar:', error)
      toast({
        title: 'Erro ao confirmar cotação',
        description: error.message,
        variant: 'destructive'
      })
    } else {
      console.log('Cotação confirmada com sucesso, recarregando lista...')
      toast({
        title: 'Cotação confirmada!',
        description: 'O status foi atualizado com sucesso.'
      })
      await fetchCotacoes()
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      enviada: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Enviada' },
      pendente: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendente' },
      em_analise: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Em Análise' },
      aprovada: { bg: 'bg-green-100', text: 'text-green-800', label: 'Aprovada' },
      recusada: { bg: 'bg-red-100', text: 'text-red-800', label: 'Recusada' },
    }
    const badge = badges[status] || badges.enviada
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
          <div className="text-gray-500">Carregando cotações...</div>
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
            <h1 className="text-3xl font-bold text-gray-900">Cotações</h1>
            <p className="text-gray-600 mt-2">Gerencie todas as cotações de serviços</p>
          </div>
          <button
            onClick={() => navigate('/admin/cotacoes/nova')}
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            + Nova Cotação
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Serviço
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cotacoes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-lg font-medium">Nenhuma cotação cadastrada</p>
                        <p className="text-sm mt-1">Clique em "Nova Cotação" para começar</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  cotacoes.map((cotacao) => (
                    <tr key={cotacao.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{cotacao.clientes.nome}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {cotacao.tipo_servico?.join(', ') || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(cotacao.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {cotacao.valor_estimado 
                            ? `R$ ${Number(cotacao.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                            : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(cotacao.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {cotacao.status === 'enviada' && (
                          <button
                            onClick={() => confirmarCotacao(cotacao.id)}
                            className="text-green-600 hover:text-green-800 font-medium mr-4"
                          >
                            Confirmar
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/admin/cotacoes/${cotacao.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium mr-4"
                        >
                          Ver Detalhes
                        </button>
                        <button className="text-gray-600 hover:text-gray-800 font-medium">
                          Editar
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
            Mostrando {cotacoes.length} cotação(ões)
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              Anterior
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              Próxima
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
