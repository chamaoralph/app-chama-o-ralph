import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react'
import { formatarDataBR } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface Servico {
  id: string
  codigo: string
  instalador_id: string
  cliente_id: string
  tipo_servico: string[]
  descricao: string
  endereco_completo: string
  data_servico_agendada: string
  valor_total: number
  valor_mao_obra_instalador: number
  valor_reembolso_despesas: number
  fotos_conclusao: string[]
  nota_fiscal_url: string | null
  observacoes_instalador: string | null
  status: string
  cliente_nome: string
  cliente_telefone: string
  instalador_nome: string | null
}

interface CorrecaoModal {
  open: boolean
  servicoId: string | null
  observacao: string
}

export default function Aprovacoes() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendentes' | 'aprovados'>('pendentes')
  const [signedUrls, setSignedUrls] = useState<Record<string, string[]>>({})
  const [fotoPaths, setFotoPaths] = useState<Record<string, string[]>>({})
  const [correcaoModal, setCorrecaoModal] = useState<CorrecaoModal>({
    open: false,
    servicoId: null,
    observacao: ''
  })

  useEffect(() => {
    fetchServicos()
  }, [filtroStatus])

  async function fetchServicos() {
    try {
      setLoading(true)

      let query = supabase
        .from('servicos')
        .select(`
          *,
          clientes(nome, telefone),
          usuarios!fk_servicos_instalador(nome)
        `)

      // Aplicar filtro
      if (filtroStatus === 'pendentes') {
        query = query.eq('status', 'aguardando_aprovacao')
      } else if (filtroStatus === 'aprovados') {
        query = query.eq('status', 'concluido')
      }
      // 'todos' não aplica filtro

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      // Transformar os dados para o formato correto
      const servicosFormatados = data?.map(servico => ({
        ...servico,
        cliente_nome: (servico.clientes as any)?.nome || '',
        cliente_telefone: (servico.clientes as any)?.telefone || '',
        instalador_nome: (servico.usuarios as any)?.nome || null
      })) || []

      setServicos(servicosFormatados)

      // Gerar URLs assinadas para as fotos e salvar paths originais
      const urlsMap: Record<string, string[]> = {}
      const pathsMap: Record<string, string[]> = {}
      for (const servico of servicosFormatados) {
        if (servico.fotos_conclusao && servico.fotos_conclusao.length > 0) {
          pathsMap[servico.id] = servico.fotos_conclusao
          const urls = await Promise.all(
            servico.fotos_conclusao.map(async (path: string) => {
              const url = await getSignedUrl(path)
              return url || ''
            })
          )
          urlsMap[servico.id] = urls.filter(u => u !== '')
        }
      }
      setSignedUrls(urlsMap)
      setFotoPaths(pathsMap)
    } catch (error) {
      console.error('Erro ao buscar serviços:', error)
      toast.error('Erro ao carregar serviços')
    } finally {
      setLoading(false)
    }
  }

  async function aprovarServico(servicoId: string) {
    const prevServicos = [...servicos]
    try {
      setProcessingId(servicoId)

      // Otimista: atualiza UI imediatamente
      setServicos((list) => list.map((s) => (s.id === servicoId ? { ...s, status: 'concluido' } : s)))

      const { data, error } = await supabase
        .from('servicos')
        .update({ status: 'concluido' })
        .eq('id', servicoId)
        .select()

      if (error) {
        console.error('Erro detalhado:', error)
        throw error
      }

      if (!data || data.length === 0) {
        throw new Error('Nenhum serviço foi atualizado. Verifique as permissões.')
      }

      toast.success('Serviço aprovado com sucesso!')
      fetchServicos()
    } catch (error: any) {
      // Reverte UI em caso de erro
      setServicos(prevServicos)
      console.error('Erro ao aprovar serviço:', error)
      toast.error(error.message || 'Erro ao aprovar serviço')
    } finally {
      setProcessingId(null)
    }
  }

  function abrirModalCorrecao(servicoId: string) {
    setCorrecaoModal({
      open: true,
      servicoId,
      observacao: ''
    })
  }

  async function handleSubmitCorrecao() {
    const { servicoId, observacao } = correcaoModal
    
    if (!servicoId) return

    // Validate input
    const trimmed = observacao.trim()
    if (trimmed.length === 0) {
      toast.error('Observação não pode estar vazia')
      return
    }
    if (trimmed.length > 500) {
      toast.error('Observação muito longa (máximo 500 caracteres)')
      return
    }

    try {
      setProcessingId(servicoId)

      const { error } = await supabase
        .from('servicos')
        .update({ 
          status: 'correcao_solicitada',
          observacoes_instalador: trimmed
        })
        .eq('id', servicoId)

      if (error) throw error

      setCorrecaoModal({ open: false, servicoId: null, observacao: '' })
      toast.success('Correção solicitada com sucesso!')
      fetchServicos()
    } catch (error) {
      console.error('Erro ao solicitar correção:', error)
      toast.error('Erro ao solicitar correção')
    } finally {
      setProcessingId(null)
    }
  }

  async function desaprovarServico(servicoId: string) {
    try {
      setProcessingId(servicoId)

      const { error } = await supabase
        .from('servicos')
        .update({ status: 'aguardando_aprovacao' })
        .eq('id', servicoId)

      if (error) throw error

      toast.success('Serviço desaprovado com sucesso!')
      fetchServicos()
    } catch (error) {
      console.error('Erro ao desaprovar serviço:', error)
      toast.error('Erro ao desaprovar serviço')
    } finally {
      setProcessingId(null)
    }
  }

  async function excluirFoto(servicoId: string, fotoPath: string, fotoIndex: number) {
    if (!confirm('Tem certeza que deseja excluir esta foto? Esta ação não pode ser desfeita.')) {
      return
    }
    
    try {
      // Extrair o path correto se for URL
      let path = fotoPath
      if (fotoPath.startsWith('http://') || fotoPath.startsWith('https://')) {
        const match = fotoPath.match(/fotos-servicos\/(.+)$/)
        if (match) {
          path = match[1]
        }
      }
      
      // 1. Remover arquivo do storage
      const { error: storageError } = await supabase.storage
        .from('fotos-servicos')
        .remove([path])
      
      if (storageError) {
        console.error('Erro ao remover do storage:', storageError)
        // Continuar mesmo se falhar no storage (arquivo pode não existir)
      }
      
      // 2. Atualizar array no banco de dados
      const servico = servicos.find(s => s.id === servicoId)
      if (!servico) throw new Error('Serviço não encontrado')
      
      const novasFotos = servico.fotos_conclusao.filter((_, idx) => idx !== fotoIndex)
      
      const { error: dbError } = await supabase
        .from('servicos')
        .update({ fotos_conclusao: novasFotos })
        .eq('id', servicoId)
      
      if (dbError) throw dbError
      
      toast.success('Foto excluída com sucesso!')
      fetchServicos()
      
    } catch (error: any) {
      console.error('Erro ao excluir foto:', error)
      toast.error('Erro ao excluir foto: ' + error.message)
    }
  }

  async function getSignedUrl(pathOrUrl: string) {
    try {
      let path = pathOrUrl
      
      // Se for uma URL completa, extrair o path
      if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
        // Extrair path da URL: .../fotos-servicos/PATH
        const match = pathOrUrl.match(/fotos-servicos\/(.+)$/)
        if (match) {
          path = match[1]
        } else {
          // URL não reconhecida, retornar como está
          return pathOrUrl
        }
      }
      
      // Gera URL assinada a partir do path
      const { data, error } = await supabase.storage
        .from('fotos-servicos')
        .createSignedUrl(path, 3600)

      if (error) throw error
      return data.signedUrl
    } catch (error) {
      console.error('Erro ao gerar URL assinada:', error)
      return null
    }
  }

  async function getNotaFiscalUrl(pathOrUrl: string) {
    try {
      let path = pathOrUrl
      
      // Se for uma URL completa, extrair o path
      if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
        // Extrair path da URL: .../notas-fiscais/PATH
        const match = pathOrUrl.match(/notas-fiscais\/(.+)$/)
        if (match) {
          path = match[1]
        } else {
          return pathOrUrl
        }
      }
      
      // Gera URL assinada a partir do path
      const { data, error } = await supabase.storage
        .from('notas-fiscais')
        .createSignedUrl(path, 3600)

      if (error) throw error
      return data.signedUrl
    } catch (error) {
      console.error('Erro ao gerar URL da nota fiscal:', error)
      return null
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Aprovações</h1>
            <p className="text-gray-600 mt-2">
              Gerenciar serviços ({servicos.length})
            </p>
          </div>
          
          {/* Filtro de Status */}
          <div className="flex gap-2">
            <button
              onClick={() => setFiltroStatus('pendentes')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                filtroStatus === 'pendentes'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pendentes
            </button>
            <button
              onClick={() => setFiltroStatus('aprovados')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                filtroStatus === 'aprovados'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Aprovados
            </button>
            <button
              onClick={() => setFiltroStatus('todos')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                filtroStatus === 'todos'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
          </div>
        </div>

        {servicos.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">
                {filtroStatus === 'pendentes' 
                  ? 'Nenhum serviço aguardando aprovação' 
                  : filtroStatus === 'aprovados'
                  ? 'Nenhum serviço aprovado encontrado'
                  : 'Nenhum serviço encontrado'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {servicos.map((servico) => (
              <Card key={servico.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">{servico.codigo}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        Cliente: {servico.cliente_nome}
                      </p>
                      <p className="text-sm text-gray-600">
                        Instalador: {servico.instalador_nome || 'Não atribuído'}
                      </p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={
                        servico.status === 'concluido' 
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : servico.status === 'correcao_solicitada'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }
                    >
                      {servico.status === 'concluido' 
                        ? 'Aprovado' 
                        : servico.status === 'correcao_solicitada'
                        ? 'Correção Solicitada'
                        : 'Aguardando Aprovação'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Informações do Serviço */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Tipo de Serviço</h3>
                      <div className="flex flex-wrap gap-2">
                        {(servico.tipo_servico || []).map((tipo, idx) => (
                          <Badge key={idx} variant="secondary">{tipo}</Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Data do Serviço</h3>
                      <p className="text-gray-700">
                        {formatarDataBR(servico.data_servico_agendada)}
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Endereço</h3>
                      <p className="text-gray-700">{servico.endereco_completo}</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Descrição</h3>
                      <p className="text-gray-700">{servico.descricao || 'Sem descrição'}</p>
                    </div>
                  </div>

                  {/* Valores */}
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Valores</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Valor Total</p>
                        <p className="text-lg font-semibold text-gray-900">
                          R$ {servico.valor_total.toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Mão de Obra</p>
                        <p className="text-lg font-semibold text-gray-900">
                          R$ {servico.valor_mao_obra_instalador.toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Reembolso Despesas</p>
                        <p className="text-lg font-semibold text-gray-900">
                          R$ {servico.valor_reembolso_despesas.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Observações do Instalador */}
                  {servico.observacoes_instalador && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Observações do Instalador</h3>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                        {servico.observacoes_instalador}
                      </p>
                    </div>
                  )}

                  {/* Fotos */}
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Fotos do Serviço</h3>
                    {(signedUrls[servico.id] && signedUrls[servico.id].length > 0) ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {signedUrls[servico.id].map((fotoUrl, idx) => (
                          <div key={idx} className="relative aspect-square group">
                            <img
                              src={fotoUrl}
                              alt={`Foto ${idx + 1}`}
                              className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(fotoUrl, '_blank')}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const originalPath = fotoPaths[servico.id]?.[idx]
                                if (originalPath) {
                                  excluirFoto(servico.id, originalPath, idx)
                                }
                              }}
                              className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                              title="Excluir foto"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">Nenhuma foto anexada</p>
                    )}
                  </div>

                  {/* Nota Fiscal */}
                  {servico.nota_fiscal_url && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Nota Fiscal</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const url = await getNotaFiscalUrl(servico.nota_fiscal_url!)
                          if (url) window.open(url, '_blank')
                        }}
                      >
                        Ver Nota Fiscal
                      </Button>
                    </div>
                  )}

                  {/* Botões de Ação */}
                  <div className="border-t pt-4 flex gap-3">
                    {servico.status === 'aguardando_aprovacao' && (
                      <>
                        <Button
                          onClick={() => aprovarServico(servico.id)}
                          disabled={processingId === servico.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {processingId === servico.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Aprovar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => abrirModalCorrecao(servico.id)}
                          disabled={processingId === servico.id}
                          className="text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Solicitar Correção
                        </Button>
                      </>
                    )}
                    {servico.status === 'concluido' && (
                      <Button
                        variant="outline"
                        onClick={() => desaprovarServico(servico.id)}
                        disabled={processingId === servico.id}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        {processingId === servico.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2" />
                        )}
                        Desaprovar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Correção */}
      <Dialog 
        open={correcaoModal.open} 
        onOpenChange={(open) => {
          if (!open) {
            setCorrecaoModal({ open: false, servicoId: null, observacao: '' })
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Solicitar Correção</DialogTitle>
            <DialogDescription>
              Descreva o motivo da solicitação de correção. O instalador receberá esta mensagem.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="observacao">Motivo da Correção</Label>
              <Textarea
                id="observacao"
                placeholder="Descreva o que precisa ser corrigido..."
                value={correcaoModal.observacao}
                onChange={(e) => setCorrecaoModal(prev => ({ ...prev, observacao: e.target.value }))}
                className="min-h-[100px]"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {correcaoModal.observacao.length}/500 caracteres
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCorrecaoModal({ open: false, servicoId: null, observacao: '' })}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitCorrecao}
              disabled={processingId !== null || correcaoModal.observacao.trim().length === 0}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {processingId ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Solicitar Correção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
