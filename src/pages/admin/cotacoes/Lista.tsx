import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImportacaoCotacoes } from '@/components/admin/ImportacaoCotacoes'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Trash2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

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
  const [cotacaoParaExcluir, setCotacaoParaExcluir] = useState<string | null>(null)
  const [cotacaoParaNaoGerou, setCotacaoParaNaoGerou] = useState<string | null>(null)
  const [motivoNaoGerou, setMotivoNaoGerou] = useState<string>('')
  const [observacaoNaoGerou, setObservacaoNaoGerou] = useState<string>('')

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
    try {
      const { error } = await supabase
        .from('cotacoes')
        .update({ status: 'confirmada' })
        .eq('id', id)
      
      if (error) {
        console.error('Erro:', error)
        alert('Erro ao confirmar: ' + error.message)
        return
      }
      
      alert('Cotação confirmada com sucesso!')
      window.location.reload()
      
    } catch (err) {
      console.error('Erro catch:', err)
      alert('Erro: ' + err)
    }
  }

  async function excluirCotacao(id: string) {
    try {
      const { error } = await supabase
        .from('cotacoes')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      toast({
        title: "Cotação excluída",
        description: "A cotação foi removida com sucesso.",
      })
      
      fetchCotacoes()
    } catch (err) {
      console.error('Erro ao excluir cotação:', err)
      toast({
        title: "Erro",
        description: "Não foi possível excluir a cotação.",
        variant: "destructive"
      })
    }
  }

  async function marcarNaoGerou() {
    if (!cotacaoParaNaoGerou || !motivoNaoGerou) return

    try {
      const { error } = await supabase
        .from('cotacoes')
        .update({ 
          status: motivoNaoGerou,
          observacoes: observacaoNaoGerou || null
        })
        .eq('id', cotacaoParaNaoGerou)
      
      if (error) throw error
      
      toast({
        title: "Status atualizado",
        description: "A cotação foi marcada como não gerou serviço.",
      })
      
      setCotacaoParaNaoGerou(null)
      setMotivoNaoGerou('')
      setObservacaoNaoGerou('')
      fetchCotacoes()
    } catch (err) {
      console.error('Erro ao atualizar cotação:', err)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a cotação.",
        variant: "destructive"
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      enviada: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Enviada' },
      confirmada: { bg: 'bg-green-100', text: 'text-green-800', label: 'Confirmada' },
      pendente: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendente' },
      em_analise: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Em Análise' },
      aprovada: { bg: 'bg-green-100', text: 'text-green-800', label: 'Aprovada' },
      recusada: { bg: 'bg-red-100', text: 'text-red-800', label: 'Recusada' },
      nao_gerou_longe: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Não Gerou - Longe' },
      nao_gerou_caro: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Não Gerou - Caro' },
      nao_gerou_cliente_sumiu: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Não Gerou - Cliente Sumiu' },
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

        <Tabs defaultValue="lista" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="lista">Lista de Cotações</TabsTrigger>
            <TabsTrigger value="importacao">Importação em Massa</TabsTrigger>
          </TabsList>

          <TabsContent value="lista">
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
                            <div className="flex items-center gap-2">
                              {cotacao.status === 'enviada' && (
                                <Button
                                  onClick={() => {
                                    if (confirm('Confirmar esta cotação?')) {
                                      confirmarCotacao(cotacao.id)
                                    }
                                  }}
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  Confirmar
                                </Button>
                              )}
                              {!cotacao.status.startsWith('nao_gerou') && (
                                <Button
                                  onClick={() => setCotacaoParaNaoGerou(cotacao.id)}
                                  size="sm"
                                  variant="outline"
                                  className="text-orange-600 hover:text-orange-700"
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Não Gerou
                                </Button>
                              )}
                              <Button
                                onClick={() => setCotacaoParaExcluir(cotacao.id)}
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="importacao">
            <ImportacaoCotacoes />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!cotacaoParaExcluir} onOpenChange={() => setCotacaoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta cotação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cotacaoParaExcluir) {
                  excluirCotacao(cotacaoParaExcluir)
                  setCotacaoParaExcluir(null)
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Não Gerou Serviço */}
      <Dialog open={!!cotacaoParaNaoGerou} onOpenChange={() => setCotacaoParaNaoGerou(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Não Gerou Serviço</DialogTitle>
            <DialogDescription>
              Selecione o motivo pelo qual esta cotação não gerou um serviço.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo</label>
              <Select value={motivoNaoGerou} onValueChange={setMotivoNaoGerou}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_gerou_longe">Local muito longe</SelectItem>
                  <SelectItem value="nao_gerou_caro">Cliente achou caro</SelectItem>
                  <SelectItem value="nao_gerou_cliente_sumiu">Cliente sumiu/não respondeu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Observações (opcional)</label>
              <Textarea
                value={observacaoNaoGerou}
                onChange={(e) => setObservacaoNaoGerou(e.target.value)}
                placeholder="Adicione observações adicionais sobre esta cotação..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCotacaoParaNaoGerou(null)
              setMotivoNaoGerou('')
              setObservacaoNaoGerou('')
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={marcarNaoGerou}
              disabled={!motivoNaoGerou}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
