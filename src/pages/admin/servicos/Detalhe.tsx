import { useParams, useNavigate } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, User, MapPin, Calendar, Phone, DollarSign, FileText } from 'lucide-react'

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
  valor_reembolso_despesas: number | null
  descricao: string | null
  endereco_completo: string
  observacoes_instalador: string | null
  fotos_conclusao: string[] | null
  nota_fiscal_url: string | null
  clientes: {
    nome: string
    telefone: string
    bairro: string | null
  }
  usuarios?: {
    nome: string
    telefone: string | null
  }
}

export default function DetalheServico() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [servico, setServico] = useState<Servico | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) fetchServico()
  }, [id])

  async function fetchServico() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          *,
          clientes(nome, telefone, bairro),
          usuarios!fk_servicos_instalador(nome, telefone)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      setServico(data as any)
    } catch (err) {
      console.error('Erro ao buscar serviço:', err)
      toast({ title: "Erro ao carregar serviço", variant: "destructive" })
    } finally {
      setLoading(false)
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
      <Badge className={`${badge.bg} ${badge.text}`}>
        {badge.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    )
  }

  if (!servico) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Serviço não encontrado</p>
          <Button onClick={() => navigate('/admin/servicos')} className="mt-4">
            Voltar para Lista
          </Button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/servicos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-gray-900">{servico.codigo}</h1>
              {getStatusBadge(servico.status)}
            </div>
            <p className="text-gray-600 mt-1">
              Criado em {new Date(servico.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informações do Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Nome</p>
                <p className="font-medium">{servico.clientes.nome}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Telefone</p>
                <p className="font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {servico.clientes.telefone}
                </p>
              </div>
              {servico.clientes.bairro && (
                <div>
                  <p className="text-sm text-gray-600">Bairro</p>
                  <p className="font-medium">{servico.clientes.bairro}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Informações do Serviço */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Serviço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Tipo de Serviço</p>
                <p className="font-medium">{servico.tipo_servico?.join(', ') || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Data Agendada</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {new Date(servico.data_servico_agendada).toLocaleDateString('pt-BR')} às {new Date(servico.data_servico_agendada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Endereço</p>
                <p className="font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {servico.endereco_completo}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Valores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Valores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Valor Total</span>
                <span className="font-bold text-lg">
                  R$ {Number(servico.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Mão de Obra Instalador</span>
                <span className="font-medium text-green-600">
                  R$ {Number(servico.valor_mao_obra_instalador || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {servico.valor_reembolso_despesas && servico.valor_reembolso_despesas > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Reembolso Despesas</span>
                  <span className="font-medium">
                    R$ {Number(servico.valor_reembolso_despesas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instalador */}
          <Card>
            <CardHeader>
              <CardTitle>Instalador</CardTitle>
            </CardHeader>
            <CardContent>
              {servico.usuarios ? (
                <div className="space-y-2">
                  <p className="font-medium">{servico.usuarios.nome}</p>
                  {servico.usuarios.telefone && (
                    <p className="text-gray-600 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {servico.usuarios.telefone}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">Nenhum instalador atribuído</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Descrição */}
        {servico.descricao && (
          <Card>
            <CardHeader>
              <CardTitle>Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{servico.descricao}</p>
            </CardContent>
          </Card>
        )}

        {/* Observações do Instalador */}
        {servico.observacoes_instalador && (
          <Card>
            <CardHeader>
              <CardTitle>Observações do Instalador</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{servico.observacoes_instalador}</p>
            </CardContent>
          </Card>
        )}

        {/* Fotos de Conclusão */}
        {servico.fotos_conclusao && servico.fotos_conclusao.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Fotos de Conclusão</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {servico.fotos_conclusao.map((foto, index) => (
                  <a key={index} href={foto} target="_blank" rel="noopener noreferrer">
                    <img
                      src={foto}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg hover:opacity-80 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
