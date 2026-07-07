import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImportacaoCotacoes } from '@/components/admin/ImportacaoCotacoes'
import { useToast } from '@/hooks/use-toast'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X, Loader2, Plus, Trash2 } from 'lucide-react'
import { normalizarTelefone } from '@/lib/utils'
import { SelectorPrecoTV, type TVItem, type TotaisTV, novoItemTV } from '@/components/admin/SelectorPrecoTV'
import { ehInstalacaoTV } from '@/lib/precosTV'
import { CatalogoItem, Fornecedor, calcularRepasseAcessorio, formatarBRL } from '@/lib/orcamento'

interface TipoServico {
  id: string
  nome: string
}

interface ItemExtra {
  id: string
  descricao: string
  valor: string
  // Presentes só quando o item veio do catálogo de acessórios (fornecedor sempre "empresa" no admin)
  catalogoId?: string
  custoUnitario?: number
  quantidade?: number
  fornecedor?: Fornecedor
  repasseInstalador?: number
  repasseEmpresa?: number
}

export default function NovaCotacao() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tiposServico, setTiposServico] = useState<TipoServico[]>([])
  const [showOutroInput, setShowOutroInput] = useState(false)
  const [clienteBuscado, setClienteBuscado] = useState(false)
  const [clienteEncontrado, setClienteEncontrado] = useState(false)
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [tvItens, setTvItens] = useState<TVItem[]>([novoItemTV()])
  const [tvIndisponivel, setTvIndisponivel] = useState(false)
  const [itensExtras, setItensExtras] = useState<ItemExtra[]>([])
  const [catalogoAcessorios, setCatalogoAcessorios] = useState<CatalogoItem[]>([])
  const [estoqueSaldos, setEstoqueSaldos] = useState<Record<string, number>>({})

  const [formData, setFormData] = useState({
    cliente_nome: '',
    cliente_telefone: '',
    cliente_idade: '',
    endereco_completo: '',
    cep: '',
    bairro: '',
    origem_lead: 'Google',
    ocasiao: '',
    data_servico_desejada: '',
    horario_inicio: '',
    duracao: '60',
    tipo_servico: '',
    tipo_servico_outro: '',
    descricao: '',
    valor_mao_obra: '',
    valor_material: '',
    observacoes: '',
    origem_suporte: '',
    custo_suporte: ''
  })

  const totalItensExtras = itensExtras.reduce((s, i) => s + (parseFloat(i.valor) || 0), 0)
  const valorTotalComExtras = (parseFloat(formData.valor_mao_obra) || 0) + totalItensExtras

  const repasseTotal = itensExtras
    .filter(i => i.catalogoId)
    .reduce((acc, i) => {
      const r = calcularRepasseAcessorio(parseFloat(i.valor) || 0, (i.custoUnitario ?? 0) * (i.quantidade ?? 1), 'empresa')
      return { instalador: acc.instalador + r.repasse_instalador, empresa: acc.empresa + r.repasse_empresa }
    }, { instalador: 0, empresa: 0 })

  useEffect(() => {
    async function fetchTiposServico() {
      const { data } = await supabase
        .from('tipos_servico')
        .select('id, nome')
        .eq('ativo', true)
        .order('ordem')
      
      setTiposServico(data || [])
    }
    async function fetchEmpresa() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).maybeSingle()
      if (data) setEmpresaId(data.empresa_id)
    }
    async function fetchAcessorios() {
      const { data } = await supabase
        .from('catalogo_servicos')
        .select('*')
        .eq('ativo', true)
        .eq('categoria', 'acessorios')
        .order('ordem')

      setCatalogoAcessorios((data || []) as CatalogoItem[])
    }
    async function fetchEstoqueSaldos() {
      const { data } = await supabase
        .from('estoque_saldo')
        .select('catalogo_id, saldo')

      const mapa: Record<string, number> = {}
      for (const linha of (data || []) as { catalogo_id: string; saldo: number }[]) {
        mapa[linha.catalogo_id] = linha.saldo ?? 0
      }
      setEstoqueSaldos(mapa)
    }
    fetchTiposServico()
    fetchEmpresa()
    fetchAcessorios()
    fetchEstoqueSaldos()
  }, [])

  const isInstalacaoTV = ehInstalacaoTV(formData.tipo_servico)

  function handleTotaisCalculados(totais: TotaisTV, indisponivel: boolean) {
    setTvIndisponivel(indisponivel)
    setFormData(prev => ({
      ...prev,
      valor_mao_obra: totais.totalMaoObra ? totais.totalMaoObra.toString() : '',
      valor_material: totais.origemSuporte === 'empresa' ? '' : (totais.totalMaterial ? totais.totalMaterial.toString() : ''),
      origem_suporte: totais.origemSuporte,
      custo_suporte: totais.totalCustoSuporte ? totais.totalCustoSuporte.toString() : '',
    }))
  }

  // Gerar opções de horário de 8:00 às 19:00 em intervalos de 30 minutos
  const horariosDisponiveis = []
  for (let hora = 8; hora <= 19; hora++) {
    horariosDisponiveis.push(`${hora.toString().padStart(2, '0')}:00`)
    if (hora < 19) {
      horariosDisponiveis.push(`${hora.toString().padStart(2, '0')}:30`)
    }
  }

  // Opções de duração em intervalos de 30 minutos
  const duracoesDisponiveis = [
    { valor: '30', label: '30 minutos' },
    { valor: '60', label: '1 hora' },
    { valor: '90', label: '1h30' },
    { valor: '120', label: '2 horas' },
    { valor: '150', label: '2h30' },
    { valor: '180', label: '3 horas' },
    { valor: '210', label: '3h30' },
    { valor: '240', label: '4 horas' },
    { valor: '300', label: '5 horas' },
    { valor: '360', label: '6 horas' },
    { valor: '480', label: '8 horas' },
  ]

  // Calcular horário fim baseado no início + duração
  const calcularHorarioFim = (inicio: string, duracaoMinutos: string) => {
    if (!inicio) return ''
    const [horas, minutos] = inicio.split(':').map(Number)
    const totalMinutos = horas * 60 + minutos + parseInt(duracaoMinutos)
    const horaFim = Math.floor(totalMinutos / 60)
    const minutoFim = totalMinutos % 60
    return `${horaFim.toString().padStart(2, '0')}:${minutoFim.toString().padStart(2, '0')}`
  }

  async function buscarCliente() {
    if (!formData.cliente_telefone) {
      toast({ title: "Digite um telefone", variant: "destructive" })
      return
    }
    
    setBuscandoCliente(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .maybeSingle()
      
      if (!userData) throw new Error('Dados do usuário não encontrados')

      const { data: cliente } = await supabase
        .from('clientes')
        .select('*')
        .eq('telefone', formData.cliente_telefone)
        .eq('empresa_id', userData.empresa_id)
        .maybeSingle()
      
      if (cliente) {
        setFormData({
          ...formData,
          cliente_nome: cliente.nome || '',
          bairro: cliente.bairro || '',
          endereco_completo: cliente.endereco_completo || '',
          origem_lead: cliente.origem_lead || 'Google',
          cliente_idade: cliente.idade?.toString() || ''
        })
        setClienteEncontrado(true)
        toast({ title: "✅ Cliente encontrado!", description: cliente.nome })
      } else {
        setFormData({
          ...formData,
          cliente_nome: '',
          bairro: '',
          endereco_completo: '',
          origem_lead: 'Google',
          cliente_idade: ''
        })
        setClienteEncontrado(false)
        toast({ title: "Cliente não encontrado", description: "Preencha os dados do novo cliente" })
      }
      
      setClienteBuscado(true)
    } catch (error: any) {
      toast({ title: "Erro ao buscar cliente", description: error.message, variant: "destructive" })
    } finally {
      setBuscandoCliente(false)
    }
  }

  function limparBusca() {
    setClienteBuscado(false)
    setClienteEncontrado(false)
    setFormData({
      ...formData,
      cliente_telefone: '',
      cliente_nome: '',
      bairro: '',
      endereco_completo: '',
      origem_lead: 'Google',
      cliente_idade: ''
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()

      if (!userData) throw new Error('Dados do usuário não encontrados')

      let clienteId
      const { data: clienteExistente } = await supabase
        .from('clientes')
        .select('id')
        .eq('telefone', formData.cliente_telefone)
        .eq('empresa_id', userData.empresa_id)
        .single()

      if (clienteExistente) {
        clienteId = clienteExistente.id
      } else {
        const { data: novoCliente, error: erroCliente } = await supabase
          .from('clientes')
          .insert({
            empresa_id: userData.empresa_id,
            nome: formData.cliente_nome,
            telefone: formData.cliente_telefone,
            idade: formData.cliente_idade ? parseInt(formData.cliente_idade) : null,
            endereco_completo: formData.endereco_completo,
            cep: formData.cep,
            bairro: formData.bairro,
            origem_lead: formData.origem_lead
          })
          .select()
          .single()

        if (erroCliente) throw erroCliente
        clienteId = novoCliente.id
      }

      const tipoServicoFinal = formData.tipo_servico === 'Outros' && formData.tipo_servico_outro 
        ? formData.tipo_servico_outro 
        : formData.tipo_servico

      const { error: erroCotacao } = await supabase
        .from('cotacoes')
        .insert({
          empresa_id: userData.empresa_id,
          cliente_id: clienteId,
          data_servico_desejada: formData.data_servico_desejada,
          horario_inicio: formData.horario_inicio || null,
          horario_fim: formData.horario_inicio ? calcularHorarioFim(formData.horario_inicio, formData.duracao) : null,
          tipo_servico: [tipoServicoFinal],
          descricao_servico: formData.descricao || tipoServicoFinal,
          valor_estimado: valorTotalComExtras > 0 ? valorTotalComExtras : null,
          itens_extras: itensExtras
            .filter(i => i.descricao.trim() && parseFloat(i.valor) > 0)
            .map(i => {
              const descricao = i.descricao.trim()
              const valor = parseFloat(i.valor)
              if (!i.catalogoId) return { descricao, valor }
              const repasse = calcularRepasseAcessorio(valor, (i.custoUnitario ?? 0) * (i.quantidade ?? 1), 'empresa')
              return {
                descricao,
                valor,
                eh_acessorio: true,
                catalogo_id: i.catalogoId,
                quantidade: i.quantidade ?? 1,
                custo_unitario: i.custoUnitario ?? 0,
                fornecedor: 'empresa' as Fornecedor,
                repasse_instalador: repasse.repasse_instalador,
                repasse_empresa: repasse.repasse_empresa,
              }
            }) as any,
          valor_material: formData.origem_suporte === 'empresa' ? 0 : (formData.valor_material ? parseFloat(formData.valor_material) : 0),
          origem_lead: formData.origem_lead,
          ocasiao: formData.ocasiao,
          observacoes: formData.observacoes,
          origem_suporte: formData.origem_suporte || null,
          custo_suporte: formData.custo_suporte ? parseFloat(formData.custo_suporte) : 0,
          tv_tamanho: tvItens[0]?.tamanho || null,
          tv_parede: tvItens[0]?.parede || null,
          tv_cobertura: tvItens[0]?.cobertura || null,
          tvs_itens: isInstalacaoTV ? (tvItens as any) : null,
          status: 'pendente'
        } as any)

      if (erroCotacao) throw erroCotacao

      toast({
        title: "✅ Cotação criada!",
        description: "A cotação foi registrada com sucesso.",
      })
      navigate('/admin/cotacoes')
      
    } catch (error: any) {
      console.error('Erro ao criar cotação:', error)
      toast({
        title: "❌ Erro ao criar cotação",
        description: error.message || 'Ocorreu um erro inesperado',
        variant: "destructive"
      })
      setError(error.message || 'Erro ao criar cotação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Nova Cotação</h1>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="manual">Cadastro Manual</TabsTrigger>
            <TabsTrigger value="importacao">Importação em Massa</TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Dados do Cliente</h2>
            
            {/* Linha de busca - sempre visível */}
            <div className="flex gap-4 items-end mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Telefone *</label>
                <Input 
                  type="tel" 
                  required 
                  value={formData.cliente_telefone} 
                  onChange={(e) => {
                    // Normaliza o telefone removendo caracteres especiais (incluindo Unicode do WhatsApp)
                    const telefoneNormalizado = normalizarTelefone(e.target.value)
                    setFormData({...formData, cliente_telefone: telefoneNormalizado})
                    if (clienteBuscado) {
                      setClienteBuscado(false)
                      setClienteEncontrado(false)
                    }
                  }} 
                  placeholder="Ex: 11999998888"
                />
              </div>
              {!clienteBuscado ? (
                <Button 
                  type="button" 
                  onClick={buscarCliente}
                  disabled={buscandoCliente || !formData.cliente_telefone}
                  className="gap-2"
                >
                  {buscandoCliente ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar Cliente
                </Button>
              ) : (
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={limparBusca}
                  className="gap-2"
                >
                  <X className="h-4 w-4" /> Limpar
                </Button>
              )}
            </div>
            
            {/* Indicador de status */}
            {clienteBuscado && (
              <div className={`mb-4 p-3 rounded-md ${clienteEncontrado ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                {clienteEncontrado 
                  ? '✅ Cliente encontrado! Dados preenchidos automaticamente.'
                  : '⚠️ Cliente novo. Preencha os dados abaixo.'}
              </div>
            )}
            
            {/* Campos expandidos - só aparecem após busca */}
            {clienteBuscado && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nome *</label>
                  <Input type="text" required value={formData.cliente_nome} onChange={(e) => setFormData({...formData, cliente_nome: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Bairro *</label>
                  <Input type="text" required value={formData.bairro} onChange={(e) => setFormData({...formData, bairro: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Origem *</label>
                  <select value={formData.origem_lead} onChange={(e) => setFormData({...formData, origem_lead: e.target.value})} className="w-full px-3 py-2 border rounded-md bg-background">
                    <option value="Google">Google</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Já era cliente">Já era cliente</option>
                    <option value="Indicação">Indicação</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Idade</label>
                  <Input type="number" value={formData.cliente_idade} onChange={(e) => setFormData({...formData, cliente_idade: e.target.value})} placeholder="Ex: 35" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Endereço *</label>
                  <Input type="text" required value={formData.endereco_completo} onChange={(e) => setFormData({...formData, endereco_completo: e.target.value})} placeholder="Rua, número, complemento" />
                </div>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Dados do Serviço</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Data Desejada *</label>
                <input type="date" required value={formData.data_servico_desejada} onChange={(e) => setFormData({...formData, data_servico_desejada: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Valor Mão de Obra</label>
                <input type="number" step="0.01" value={formData.valor_mao_obra} onChange={(e) => setFormData({...formData, valor_mao_obra: e.target.value})} className="w-full px-3 py-2 border rounded-md" placeholder="R$ 0,00" />
                {isInstalacaoTV && formData.valor_mao_obra && (
                  <p className="text-xs text-muted-foreground mt-1">💡 Calculado pela calculadora. Edite se necessário.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Horário Início</label>
                <select 
                  value={formData.horario_inicio} 
                  onChange={(e) => setFormData({...formData, horario_inicio: e.target.value})} 
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Selecione...</option>
                  {horariosDisponiveis.map((horario) => (
                    <option key={horario} value={horario}>{horario}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Duração</label>
                <select 
                  value={formData.duracao} 
                  onChange={(e) => setFormData({...formData, duracao: e.target.value})} 
                  className="w-full px-3 py-2 border rounded-md"
                >
                  {duracoesDisponiveis.map((d) => (
                    <option key={d.valor} value={d.valor}>{d.label}</option>
                  ))}
                </select>
                {formData.horario_inicio && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Término previsto: {calcularHorarioFim(formData.horario_inicio, formData.duracao)}
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Tipo de Serviço *</label>
                <select 
                  required 
                  value={formData.tipo_servico} 
                  onChange={(e) => {
                    const value = e.target.value
                    setFormData({...formData, tipo_servico: value})
                    setShowOutroInput(value === 'Outros')
                  }} 
                  className="w-full px-3 py-2 border rounded-md bg-white"
                >
                  <option value="">Selecione...</option>
                  {tiposServico.map((tipo) => (
                    <option key={tipo.id} value={tipo.nome}>{tipo.nome}</option>
                  ))}
                </select>
              </div>
              {showOutroInput && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Especifique o serviço *</label>
                  <Input 
                    type="text" 
                    required={showOutroInput}
                    value={formData.tipo_servico_outro} 
                    onChange={(e) => setFormData({...formData, tipo_servico_outro: e.target.value})} 
                    placeholder="Ex: Instalação de câmera, Suporte articulado..." 
                  />
                </div>
              )}
              {isInstalacaoTV && (
                <SelectorPrecoTV
                  empresaId={empresaId}
                  items={tvItens}
                  onItemsChange={setTvItens}
                  onTotaisChange={handleTotaisCalculados}
                />
              )}

              {/* Itens extras */}
              <div className="col-span-2 border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium">Itens Extras</span>
                  <div className="flex gap-2">
                    {catalogoAcessorios.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          const item = catalogoAcessorios.find(c => c.id === e.target.value)
                          if (!item) return
                          const quantidade = 1
                          const valor = item.preco * quantidade
                          const repasse = calcularRepasseAcessorio(valor, item.custo * quantidade, 'empresa')
                          setItensExtras(prev => [...prev, {
                            id: `${Date.now()}`,
                            descricao: item.nome,
                            valor: valor.toString(),
                            catalogoId: item.id,
                            custoUnitario: item.custo,
                            quantidade,
                            fornecedor: 'empresa',
                            repasseInstalador: repasse.repasse_instalador,
                            repasseEmpresa: repasse.repasse_empresa,
                          }])
                        }}
                        className="px-2 py-1 border rounded-md text-sm bg-white"
                      >
                        <option value="">+ Acessório do catálogo...</option>
                        {catalogoAcessorios.map(item => {
                          const saldo = estoqueSaldos[item.id] ?? 0
                          return (
                            <option key={item.id} value={item.id} disabled={saldo === 0}>
                              {item.nome} — {saldo} em estoque
                            </option>
                          )
                        })}
                      </select>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setItensExtras(prev => [...prev, { id: `${Date.now()}`, descricao: '', valor: '' }])}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Adicionar Item
                    </Button>
                  </div>
                </div>
                {itensExtras.length === 0 && (
                  <p className="text-xs text-muted-foreground">Ex: suporte extra, material adicional, bronca...</p>
                )}
                {itensExtras.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Descrição do item"
                        value={item.descricao}
                        onChange={(e) => setItensExtras(prev => prev.map(i => i.id === item.id ? { ...i, descricao: e.target.value } : i))}
                        className="flex-1 px-3 py-2 border rounded-md text-sm"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={item.valor}
                        onChange={(e) => setItensExtras(prev => prev.map(i => i.id === item.id ? { ...i, valor: e.target.value } : i))}
                        className="w-28 px-3 py-2 border rounded-md text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setItensExtras(prev => prev.filter(i => i.id !== item.id))}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                    {item.catalogoId && (
                      <p className="text-xs text-muted-foreground pl-1">
                        Acessório · Fornecedor: Empresa
                        {typeof item.repasseInstalador === 'number' && (
                          <> · Repasse instalador: {formatarBRL(item.repasseInstalador)}</>
                        )}
                      </p>
                    )}
                  </div>
                ))}
                {itensExtras.length > 0 && (
                  <div className="text-sm text-right text-muted-foreground border-t pt-2">
                    Mão de obra: R$ {(parseFloat(formData.valor_mao_obra) || 0).toFixed(2)}
                    {totalItensExtras > 0 && <> + Itens extras: R$ {totalItensExtras.toFixed(2)}</>}
                    <span className="font-semibold text-foreground ml-2">= R$ {valorTotalComExtras.toFixed(2)}</span>
                    {(repasseTotal.instalador > 0 || repasseTotal.empresa > 0) && (
                      <div className="text-xs mt-1">
                        Repasse acessórios — Instalador: {formatarBRL(repasseTotal.instalador)} · Empresa: {formatarBRL(repasseTotal.empresa)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Descrição do Serviço</label>
                <textarea 
                  value={formData.descricao} 
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})} 
                  className="w-full px-3 py-2 border rounded-md" 
                  rows={4}
                  placeholder="Descreva detalhes adicionais sobre o serviço (modelo da TV, tipo de parede, acesso, etc.)"
                />
              </div>
              
            </div>
          </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => navigate('/admin/cotacoes')} className="px-6 py-2 border rounded-md">Cancelar</button>
                <button type="submit" disabled={loading || tvIndisponivel} className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Salvando...' : tvIndisponivel ? 'Combinação indisponível' : 'Criar Cotação'}</button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="importacao">
            <ImportacaoCotacoes />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
}
