import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InstaladorLayout } from '@/components/layout/InstaladorLayout'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock } from 'lucide-react'

interface Servico {
  id: string
  codigo: string
  tipo_servico: string[]
  data_servico_agendada: string
  endereco_completo: string
  valor_mao_obra_instalador: number
  descricao: string
  clientes: {
    nome: string
    telefone: string
    bairro: string | null
  }
}

// Helper para extrair bairro e rua (sem número/complemento)
function formatarEndereco(endereco: string, bairro: string | null): string {
  if (!endereco) return bairro || 'N/A'
  
  // Se temos bairro separado, exibir apenas bairro + rua (parte antes do número)
  const partes = endereco.split(',')
  if (partes.length > 0) {
    // Pegar apenas a primeira parte (rua) e remover números
    let rua = partes[0].trim()
    // Remover números do final (número da casa)
    rua = rua.replace(/\s*\d+\s*$/, '').trim()
    
    if (bairro) {
      return `${bairro} - ${rua}`
    }
    return rua
  }
  
  return bairro || endereco
}

export default function ServicosDisponiveis() {
  const navigate = useNavigate()
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [solicitando, setSolicitando] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  // Buscar certificações do instalador
  const { data: certificacoes } = useQuery({
    queryKey: ['minhas-certificacoes', user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>()
      
      const { data } = await supabase
        .from('certificacoes')
        .select('tipos_servico_liberados')
        .eq('instalador_id', user.id)
        .eq('ativa', true)
      
      const tiposCertificados = new Set<string>()
      data?.forEach(cert => {
        cert.tipos_servico_liberados.forEach((tipo: string) => tiposCertificados.add(tipo))
      })
      
      return tiposCertificados
    },
    enabled: !!user,
  })

  useEffect(() => {
    fetchServicos()
  }, [])

  async function fetchServicos() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id,
          codigo,
          tipo_servico,
          data_servico_agendada,
          endereco_completo,
          valor_mao_obra_instalador,
          descricao,
          clientes (
            nome,
            telefone,
            bairro
          )
        `)
        .eq('status', 'disponivel')
        .order('data_servico_agendada', { ascending: true })

      if (error) throw error
      setServicos(data || [])
    } catch (err) {
      console.error('Erro ao carregar serviços:', err)
      setError('Erro ao carregar serviços disponíveis')
    } finally {
      setLoading(false)
    }
  }

  async function solicitarServico(servicoId: string) {
    try {
      setSolicitando(servicoId)
      
      // 1. Buscar usuário logado
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      // 2. Atualizar serviço para status 'solicitado'
      const { error } = await supabase
        .from('servicos')
        .update({
          instalador_id: user.id,
          status: 'solicitado'
        })
        .eq('id', servicoId)
        .eq('status', 'disponivel') // Só atualiza se ainda estiver disponível

      if (error) throw error

      toast({
        title: "Serviço solicitado!",
        description: "O serviço foi adicionado à sua agenda.",
      })
      
      // 3. Redirecionar para Minha Agenda
      navigate('/instalador/minha-agenda')
      
    } catch (error: any) {
      console.error('Erro ao solicitar serviço:', error)
      toast({
        title: "Erro",
        description: error.message || "Não foi possível solicitar o serviço.",
        variant: "destructive"
      })
    } finally {
      setSolicitando(null)
    }
  }

  if (loading) {
    return (
      <InstaladorLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </InstaladorLayout>
    )
  }

  if (error) {
    return (
      <InstaladorLayout>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </InstaladorLayout>
    )
  }

  return (
    <InstaladorLayout>
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Serviços Disponíveis</h1>
          <p className="text-gray-600 mt-2">
            {servicos.length} {servicos.length === 1 ? 'serviço disponível' : 'serviços disponíveis'}
          </p>
        </div>

        {servicos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Nenhum serviço disponível no momento
            </h2>
            <p className="text-gray-600">
              Novos serviços aparecerão aqui assim que forem disponibilizados
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {servicos.map((servico) => {
              // Verificar se instalador tem certificação para este serviço
              const temCertificacao = servico.tipo_servico?.some(tipo => 
                certificacoes?.has(tipo)
              ) ?? false

              return (
                <div
                  key={servico.id}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-1">
                        {servico.codigo}
                      </h3>
                      <p className="text-gray-600">
                        Cliente: {servico.clientes?.nome || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        R$ {servico.valor_mao_obra_instalador?.toFixed(2) || '0.00'}
                      </div>
                      <p className="text-sm text-gray-600">Seu ganho</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">📅 Data e Hora</p>
                      <p className="font-medium">
                        {format(new Date(servico.data_servico_agendada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">📍 Local</p>
                      <p className="font-medium">
                        {formatarEndereco(servico.endereco_completo, servico.clientes?.bairro)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">🔧 Tipo de Serviço</p>
                      <p className="font-medium">{servico.tipo_servico?.join(', ') || 'N/A'}</p>
                    </div>
                  </div>

                  {servico.descricao && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">📝 Descrição</p>
                      <p className="text-gray-700">{servico.descricao}</p>
                    </div>
                  )}

                  {temCertificacao ? (
                    <Button
                      onClick={() => solicitarServico(servico.id)}
                      disabled={solicitando === servico.id}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3"
                    >
                      {solicitando === servico.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Solicitando...
                        </>
                      ) : (
                        '🎯 Solicitar Serviço'
                      )}
                    </Button>
                  ) : (
                    <Button
                      disabled
                      variant="outline"
                      className="w-full border-orange-300 text-orange-600"
                      onClick={() => navigate('/instalador/base-conhecimento')}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Certificação Necessária
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </InstaladorLayout>
  )
}
