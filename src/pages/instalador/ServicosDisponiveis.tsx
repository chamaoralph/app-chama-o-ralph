import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InstaladorLayout } from '@/components/layout/InstaladorLayout'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Lock, Calendar, MapPin as MapPinIcon, List, CalendarDays, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileServicoCard } from '@/components/instalador/MobileServicoCard'
import { AgendaSemanalDisponiveis } from '@/components/instalador/AgendaSemanalDisponiveis'

type OrdenacaoTipo = 'data' | 'bairro'
type VisualizacaoTipo = 'lista' | 'agenda'

// Função para formatar data sem conversão de timezone
function formatarDataServico(dataString: string): string {
  const match = dataString.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) {
    const [, ano, mes, dia, hora, minuto] = match;
    return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
  }
  return dataString;
}

interface AcessorioVendido {
  catalogo_id: string | null
  quantidade: number
  origem_estoque?: 'empresa' | 'instalador'
  fornecedor?: 'empresa' | 'instalador'
}

interface Servico {
  id: string
  codigo: string
  tipo_servico: string[]
  data_servico_agendada: string
  endereco_completo: string
  valor_mao_obra_instalador: number
  descricao: string
  acessorios_vendidos: AcessorioVendido[] | null
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
  const [visualizacao, setVisualizacao] = useState<VisualizacaoTipo>('lista')
  // Aviso de suporte indisponível: aberto quando o instalador tenta
  // solicitar um serviço sem ter, em mãos, algum acessório necessário.
  const [avisoSuporte, setAvisoSuporte] = useState<{
    servico: Servico
    itens: { catalogoId: string; quantidade: number }[]
  } | null>(null)
  const [carregandoAviso, setCarregandoAviso] = useState(false)
  const [instaladoresPorItem, setInstaladoresPorItem] = useState<Record<string, string[]>>({})
  const { user } = useAuth()
  const { toast } = useToast()
  const isMobile = useIsMobile()

  // Saldo próprio do instalador logado, por catalogo_id (mesmo cálculo de
  // FinalizarServico.tsx / /admin/suportes) — usado só pra filtrar quais
  // serviços com acessório "pendente de estoque central" (origem_estoque=
  // 'instalador' — ver migration 20260810120000) ele consegue de fato
  // atender.
  const { data: movimentacoesProprias } = useQuery({
    queryKey: ['movimentacoes-suportes-proprio-disponiveis', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('movimentacoes_suportes')
        .select('catalogo_id, tipo_movimento, quantidade')
        .eq('instalador_id', user.id)
      if (error) throw error
      return (data || []) as { catalogo_id: string | null; tipo_movimento: string; quantidade: number }[]
    },
    enabled: !!user,
  })

  const saldoProprioPorCatalogo = (() => {
    const saldo: Record<string, number> = {}
    ;(movimentacoesProprias ?? []).forEach((m) => {
      if (!m.catalogo_id) return
      if (m.tipo_movimento === 'entrega') saldo[m.catalogo_id] = (saldo[m.catalogo_id] ?? 0) + m.quantidade
      else if (m.tipo_movimento === 'devolucao' || m.tipo_movimento === 'uso') saldo[m.catalogo_id] = (saldo[m.catalogo_id] ?? 0) - m.quantidade
    })
    return saldo
  })()

  // Nomes dos acessórios do catálogo — só pra exibir no aviso de suporte
  // indisponível (ex.: "Suporte TV 55 fixo").
  const { data: catalogoAcessorios } = useQuery({
    queryKey: ['catalogo-acessorios-nomes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalogo_servicos')
        .select('id, nome')
        .eq('categoria', 'acessorios')
      if (error) throw error
      return (data || []) as { id: string; nome: string }[]
    },
  })

  const nomeAcessorio = (catalogoId: string) =>
    catalogoAcessorios?.find((c) => c.id === catalogoId)?.nome ?? 'suporte'

  // Serviços agora aparecem pra TODO mundo, mesmo sem o suporte em mãos. Esta
  // função só identifica quais itens do serviço vieram (ou vão vir) do saldo
  // de ALGUM instalador — porque o estoque central não cobria na hora da
  // cotação — e que este instalador não tem, em mãos, na quantidade
  // necessária. Usada pra montar o aviso ao tentar solicitar o serviço.
  const itensFaltantes = (servico: Servico) => {
    return (servico.acessorios_vendidos || [])
      .filter((item) => item.catalogo_id && (item.origem_estoque ?? item.fornecedor) === 'instalador')
      .filter((item) => (saldoProprioPorCatalogo[item.catalogo_id!] ?? 0) < item.quantidade)
      .map((item) => ({ catalogoId: item.catalogo_id as string, quantidade: item.quantidade }))
  }

  const servicosAtendiveis = servicos

  // Ordenar serviços
  const servicosOrdenados = [...servicosAtendiveis].sort((a, b) => {
    if (ordenacao === 'data') {
      return new Date(a.data_servico_agendada).getTime() - new Date(b.data_servico_agendada).getTime()
    } else {
      const bairroA = a.clientes?.bairro || ''
      const bairroB = b.clientes?.bairro || ''
      return bairroA.localeCompare(bairroB)
    }
  })

  const { data: certificacoes, refetch: refetchCertificacoes } = useQuery({
    queryKey: ['minhas-certificacoes', user?.id],
    queryFn: async () => {
      if (!user) return []
      
      const { data } = await supabase
        .from('certificacoes')
        .select('tipos_servico_liberados')
        .eq('instalador_id', user.id)
        .eq('ativa', true)
      
      // Retornar array de tipos certificados em lowercase para comparação
      const tiposCertificados: string[] = []
      data?.forEach(cert => {
        cert.tipos_servico_liberados.forEach((tipo: string) => 
          tiposCertificados.push(tipo.toLowerCase())
        )
      })
      
      return tiposCertificados
    },
    enabled: !!user,
    staleTime: 0, // Sempre buscar dados frescos
  })

  // Função para verificar se instalador tem certificação para o serviço
  // Compara a primeira palavra do tipo de serviço com a certificação
  // Ex: "Tv 75 no drywall" → primeira palavra "tv" → match com certificação "tv"
  // Se não encontrar match específico, verifica se tem certificação "outros"
  const temCertificacaoParaServico = (tiposServico: string[]) => {
    if (!certificacoes || certificacoes.length === 0) return false
    
    // Lista de certificações padrão (exceto "outros")
    const certificacoesPadrao = ['tv', 'fechadura']
    
    return tiposServico.some(tipoServico => {
      const tipoLower = tipoServico.toLowerCase().trim()
      const primeiraPalavra = tipoLower.split(' ')[0]
      
      // Primeiro, verifica se há match direto com certificações específicas
      const temMatchEspecifico = certificacoes.some(tipoCert => {
        const certLower = tipoCert.toLowerCase().trim()
        // Match se: primeira palavra é igual à certificação OU é match exato
        return (primeiraPalavra === certLower || tipoLower === certLower) && certLower !== 'outros'
      })
      
      if (temMatchEspecifico) return true
      
      // Se não encontrou match específico, verifica se o tipo NÃO é uma categoria padrão
      // e se o instalador tem certificação de "outros"
      const ehCategoriaEspecifica = certificacoesPadrao.some(cat => 
        primeiraPalavra === cat || tipoLower.startsWith(cat)
      )
      
      if (!ehCategoriaEspecifica) {
        // O serviço não é TV nem Fechadura, então verifica se tem certificação "outros"
        return certificacoes.includes('outros')
      }
      
      return false
    })
  }

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
          acessorios_vendidos,
          clientes!servicos_cliente_id_fkey (
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
          status: 'atribuido'
        })
        .eq('id', servicoId)
        .eq('status', 'disponivel')

      if (error) throw error

      toast({
        title: "Serviço atribuído!",
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

  // Chamado ao clicar em "Solicitar Serviço". Se faltar algum suporte em
  // mãos, mostra um aviso (toast + modal) com quem tem o suporte em
  // estoque — mas o instalador pode confirmar e solicitar mesmo assim.
  async function handleSolicitarClick(servicoId: string) {
    const servico = servicos.find((s) => s.id === servicoId)
    if (!servico) return

    const faltantes = itensFaltantes(servico)
    if (faltantes.length === 0) {
      solicitarServico(servicoId)
      return
    }

    toast({
      title: "Suporte necessário indisponível",
      description: "Você não tem o suporte necessário para este serviço. Veja os detalhes antes de solicitar.",
    })

    setAvisoSuporte({ servico, itens: faltantes })
    setCarregandoAviso(true)
    setInstaladoresPorItem({})

    try {
      const resultadosPorItem = await Promise.all(
        faltantes.map(async (item) => {
          const { data, error } = await supabase.rpc('instaladores_com_suporte_disponivel', {
            p_catalogo_id: item.catalogoId,
            p_quantidade: item.quantidade,
          })
          if (error) {
            console.error('Erro ao buscar instaladores com suporte:', error)
            return [item.catalogoId, [] as string[]] as const
          }
          const nomes = ((data || []) as { nome: string }[]).map((d) => d.nome)
          return [item.catalogoId, nomes] as const
        })
      )
      setInstaladoresPorItem(Object.fromEntries(resultadosPorItem))
    } finally {
      setCarregandoAviso(false)
    }
  }

  function confirmarSolicitarMesmoAssim() {
    if (avisoSuporte) {
      solicitarServico(avisoSuporte.servico.id)
    }
    setAvisoSuporte(null)
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`font-bold text-gray-900 ${isMobile ? "text-2xl" : "text-3xl"}`}>
                Serviços Disponíveis
              </h1>
              <p className="text-gray-600 mt-1">
                {servicosAtendiveis.length} {servicosAtendiveis.length === 1 ? 'serviço disponível' : 'serviços disponíveis'}
              </p>
            </div>
            
            {/* Botões de alternância de visualização */}
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={visualizacao === 'lista' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setVisualizacao('lista')}
                className={visualizacao === 'lista' ? 'bg-blue-600' : ''}
              >
                <List className="w-4 h-4" />
                {!isMobile && <span className="ml-2">Lista</span>}
              </Button>
              <Button
                variant={visualizacao === 'agenda' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setVisualizacao('agenda')}
                className={visualizacao === 'agenda' ? 'bg-blue-600' : ''}
              >
                <CalendarDays className="w-4 h-4" />
                {!isMobile && <span className="ml-2">Agenda</span>}
              </Button>
            </div>
          </div>
          
          {/* Botões de ordenação - só aparecem na visualização em lista */}
          {servicosAtendiveis.length > 1 && visualizacao === 'lista' && (
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

        {servicosAtendiveis.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-5xl mb-4">📭</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Nenhum serviço disponível
            </h2>
            <p className="text-gray-600">
              Novos serviços aparecerão aqui assim que forem disponibilizados
            </p>
          </div>
        ) : visualizacao === 'agenda' ? (
          <AgendaSemanalDisponiveis
            servicos={servicosAtendiveis}
            certificacoes={certificacoes || []}
            onSolicitar={handleSolicitarClick}
            solicitandoId={solicitando}
          />
        ) : (
          <div className="space-y-4">
            {servicosOrdenados.map((servico) => {
              const temCertificacao = temCertificacaoParaServico(servico.tipo_servico || [])

              if (isMobile) {
                return (
                  <MobileServicoCard
                    key={servico.id}
                    servico={servico}
                    variant="disponivel"
                    temCertificacao={temCertificacao}
                    onSolicitar={handleSolicitarClick}
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
                        {formatarDataServico(servico.data_servico_agendada)}
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
                      onClick={() => handleSolicitarClick(servico.id)}
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

      <Dialog open={!!avisoSuporte} onOpenChange={(open) => !open && setAvisoSuporte(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              Suporte necessário indisponível
            </DialogTitle>
            <DialogDescription>
              Você não tem, em mãos, o suporte necessário para instalar {avisoSuporte?.servico.codigo}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {avisoSuporte?.itens.map((item) => {
              const nomes = instaladoresPorItem[item.catalogoId] ?? []
              return (
                <div key={item.catalogoId} className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="font-medium text-orange-800">
                    {nomeAcessorio(item.catalogoId)} — {item.quantidade}x necessário
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    {carregandoAviso ? (
                      'Verificando quem tem em estoque...'
                    ) : nomes.length > 0 ? (
                      <>
                        Deverá pegar com {nomes.length > 1 ? 'os instaladores' : 'o instalador'}:{' '}
                        <strong>{nomes.join(', ')}</strong>
                      </>
                    ) : (
                      'Nenhum outro instalador tem esse suporte em estoque no momento — fale com o admin.'
                    )}
                  </p>
                </div>
              )
            })}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setAvisoSuporte(null)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarSolicitarMesmoAssim}
              disabled={!!avisoSuporte && solicitando === avisoSuporte.servico.id}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Solicitar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </InstaladorLayout>
  )
}
