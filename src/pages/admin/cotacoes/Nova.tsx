import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImportacaoCotacoes } from '@/components/admin/ImportacaoCotacoes'

export default function NovaCotacao() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    cliente_nome: '',
    cliente_telefone: '',
    cliente_idade: '',
    endereco_completo: '',
    cep: '',
    bairro: '',
    origem_lead: 'WhatsApp',
    ocasiao: '',
    data_servico_desejada: '',
    tipo_servico: '',
    valor_estimado: '',
    observacoes: ''
  })

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

      const { error: erroCotacao } = await supabase
        .from('cotacoes')
        .insert({
          empresa_id: userData.empresa_id,
          cliente_id: clienteId,
          data_servico_desejada: formData.data_servico_desejada,
          tipo_servico: [formData.tipo_servico],
          descricao_servico: formData.tipo_servico,
          valor_estimado: formData.valor_estimado ? parseFloat(formData.valor_estimado) : null,
          origem_lead: formData.origem_lead,
          ocasiao: formData.ocasiao,
          observacoes: formData.observacoes,
          status: 'enviada'
        })

      if (erroCotacao) throw erroCotacao

      alert('Cotação criada com sucesso!')
      navigate('/admin/cotacoes')
      
    } catch (error: any) {
      console.error('Erro ao criar cotação:', error)
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome *</label>
                <input type="text" required value={formData.cliente_nome} onChange={(e) => setFormData({...formData, cliente_nome: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Telefone *</label>
                <input type="tel" required value={formData.cliente_telefone} onChange={(e) => setFormData({...formData, cliente_telefone: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Bairro *</label>
                <input type="text" required value={formData.bairro} onChange={(e) => setFormData({...formData, bairro: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Origem *</label>
                <select value={formData.origem_lead} onChange={(e) => setFormData({...formData, origem_lead: e.target.value})} className="w-full px-3 py-2 border rounded-md">
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Google">Google</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Endereço *</label>
                <input type="text" required value={formData.endereco_completo} onChange={(e) => setFormData({...formData, endereco_completo: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Dados do Serviço</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Data Desejada *</label>
                <input type="date" required value={formData.data_servico_desejada} onChange={(e) => setFormData({...formData, data_servico_desejada: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Valor Estimado</label>
                <input type="number" step="0.01" value={formData.valor_estimado} onChange={(e) => setFormData({...formData, valor_estimado: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Tipo de Serviço *</label>
                <input type="text" required value={formData.tipo_servico} onChange={(e) => setFormData({...formData, tipo_servico: e.target.value})} className="w-full px-3 py-2 border rounded-md" placeholder="TV 50, Suporte fixo" />
              </div>
            </div>
          </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => navigate('/admin/cotacoes')} className="px-6 py-2 border rounded-md">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">{loading ? 'Salvando...' : 'Criar Cotação'}</button>
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
