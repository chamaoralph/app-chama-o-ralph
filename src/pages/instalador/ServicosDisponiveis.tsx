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
import { Lock, ArrowUpDown, Calendar, MapPin as MapPinIcon } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileServicoCard } from '@/components/instalador/MobileServicoCard'

type OrdenacaoTipo = 'data' | 'bairro'

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

function formatarEndereco(endereco: string, bairro: string | null): string {
  if (!endereco) return bairro || 'N/A'
  
  const partes = endereco.split(',')
  if (partes.length > 0) {
    let rua = partes[0].trim()
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
  const [ordenacao, setOrdenacao] = useState<OrdenacaoTipo>('data')
  const { user } = useAuth()
  const { toast } = useToast()
  const isMobile = useIsMobile()

  // Ordenar serviços
  const servicosOrdenados = [...servicos].sort((a, b) => {
    if (ordenacao === 'data') {
      return new Date(a.data_servico_agendada).getTime() - new Date(b.data_servico_agendada).getTime()
    } else {
      const bairroA = a.clientes?.bairro || ''
      const bairroB = b.clientes?.bairro || ''
      return bairroA.localeCompare(bairroB)
    }
  })

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
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const { error } = await supabase
        .from('servicos')
        .update({
          instalador_id: user.id,
          status: 'solicitado'
        })
        .eq('id', servicoId)
        .eq('status', 'disponivel')

      if (error) throw error

      toast({
        title: "Serviço solicitado!",
        description: "O serviço foi adicionado à sua agenda.",
      })
      
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
        <div className={`mb-4 ${isMobile ? "" : "mb-6"}`}>
          <h1 className={`font-bold text-gray-900 ${isMobile ? "text-2xl" : "text-3xl"}`}>
            Serviços Disponíveis
          </h1>
          <p className="text-gray-600 mt-1">
            {servicos.length} {servicos.length === 1 ? 'serviço disponível' : 'serviços disponíveis'}
          </p>
          
          {/* Botões de ordenação */}
          {servicos.length > 1 && (
            <div className="flex gap-2 mt-3">
              <Button
                variant={ordenacao === 'data' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOrdenacao('data')}
                className={ordenacao === 'data' ? 'bg-blue-600' : ''}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Por Data
              </Button>
              <Button
                variant={ordenacao === 'bairro' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOrdenacao('bairro')}
                className={ordenacao === 'bairro' ? 'bg-blue-600' : ''}
              >
                <MapPinIcon className="w-4 h-4 mr-2" />
                Por Bairro
              </Button>
            </div>
          )}
        </div>

        {servicos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-5xl mb-4">📭</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Nenhum serviço disponível
            </h2>
            <p className="text-gray-600">
              Novos serviços aparecerão aqui assim que forem disponibilizados
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {servicosOrdenados.map((servico) => {
              const temCertificacao = servico.tipo_servico?.some(tipo => 
                certificacoes?.has(tipo)
              ) ?? false

              if (isMobile) {
                return (
                  <MobileServicoCard
                    key={servico.id}
                    servico={servico}
                    variant="disponivel"
                    temCertificacao={temCertificacao}
                    onSolicitar={solicitarServico}
                    isLoading={solicitando === servico.id}
                  />
                )
              }

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
