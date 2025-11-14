import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { supabase } from '@/integrations/supabase/client'
import { Plus, Trash2, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

interface Despesa {
  categoria: string
  descricao: string
  valor: string
  data_lancamento: string
  forma_pagamento: string
}

interface DespesaSalva {
  id: string
  categoria: string
  descricao: string
  valor: number
  data_lancamento: string
  forma_pagamento: string
  created_at: string
}

export default function Despesas() {
  const [despesas, setDespesas] = useState<Despesa[]>([{
    categoria: '',
    descricao: '',
    valor: '',
    data_lancamento: new Date().toISOString().split('T')[0],
    forma_pagamento: 'Pix'
  }])
  const [loading, setLoading] = useState(false)
  const [despesasSalvas, setDespesasSalvas] = useState<DespesaSalva[]>([])
  const [loadingLista, setLoadingLista] = useState(true)

  const categorias = [
    'Combustível',
    'Alimentação',
    'Material',
    'Transporte',
    'Hospedagem',
    'Manutenção',
    'Telefone/Internet',
    'Aluguel',
    'Conta de Luz',
    'Conta de Água',
    'Marketing',
    'Outros'
  ]

  const formasPagamento = ['Pix', 'Dinheiro', 'Cartão Débito', 'Cartão Crédito', 'Boleto']

  useEffect(() => {
    carregarDespesas()
  }, [])

  async function carregarDespesas() {
    try {
      setLoadingLista(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()

      if (!userData) return

      const { data, error } = await supabase
        .from('lancamentos_caixa')
        .select('*')
        .eq('empresa_id', userData.empresa_id)
        .eq('tipo', 'despesa')
        .is('servico_id', null)
        .order('data_lancamento', { ascending: false })
        .limit(20)

      if (error) throw error

      setDespesasSalvas(data || [])
    } catch (error) {
      console.error('Erro ao carregar despesas:', error)
    } finally {
      setLoadingLista(false)
    }
  }

  function adicionarLinha() {
    setDespesas([...despesas, {
      categoria: '',
      descricao: '',
      valor: '',
      data_lancamento: new Date().toISOString().split('T')[0],
      forma_pagamento: 'Pix'
    }])
  }

  function removerLinha(index: number) {
    if (despesas.length === 1) {
      toast({
        title: 'Atenção',
        description: 'É necessário ter pelo menos uma linha',
        variant: 'destructive'
      })
      return
    }
    setDespesas(despesas.filter((_, i) => i !== index))
  }

  function atualizarDespesa(index: number, campo: keyof Despesa, valor: string) {
    const novasDespesas = [...despesas]
    novasDespesas[index][campo] = valor
    setDespesas(novasDespesas)
  }

  async function salvarDespesas() {
    try {
      // Validar
      const despesasValidas = despesas.filter(d => 
        d.categoria && d.descricao && d.valor && d.data_lancamento
      )

      if (despesasValidas.length === 0) {
        toast({
          title: 'Erro',
          description: 'Preencha pelo menos uma despesa completa',
          variant: 'destructive'
        })
        return
      }

      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()

      if (!userData) throw new Error('Dados do usuário não encontrados')

      // Preparar dados para inserção
      const lancamentos = despesasValidas.map(d => ({
        empresa_id: userData.empresa_id,
        tipo: 'despesa',
        categoria: d.categoria,
        descricao: d.descricao,
        valor: parseFloat(d.valor),
        data_lancamento: d.data_lancamento,
        forma_pagamento: d.forma_pagamento,
        servico_id: null,
        observacoes: null
      }))

      const { error } = await supabase
        .from('lancamentos_caixa')
        .insert(lancamentos)

      if (error) throw error

      toast({
        title: 'Sucesso',
        description: `${despesasValidas.length} despesa(s) adicionada(s) com sucesso`
      })

      // Resetar formulário
      setDespesas([{
        categoria: '',
        descricao: '',
        valor: '',
        data_lancamento: new Date().toISOString().split('T')[0],
        forma_pagamento: 'Pix'
      }])

      // Recarregar lista
      carregarDespesas()

    } catch (error: any) {
      console.error('Erro ao salvar despesas:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar as despesas',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  async function deletarDespesa(id: string) {
    if (!confirm('Tem certeza que deseja deletar esta despesa?')) return

    try {
      const { error } = await supabase
        .from('lancamentos_caixa')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Sucesso',
        description: 'Despesa removida com sucesso'
      })

      carregarDespesas()
    } catch (error: any) {
      console.error('Erro ao deletar despesa:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível deletar a despesa',
        variant: 'destructive'
      })
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">💸 Adicionar Despesas</h1>
          <div className="flex gap-2">
            <Button onClick={adicionarLinha} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Linha
            </Button>
            <Button onClick={salvarDespesas} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Todas'}
            </Button>
          </div>
        </div>

        {/* Formulário de Despesas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Nova(s) Despesa(s)</h2>
          <div className="space-y-3">
            {despesas.map((despesa, index) => (
              <div key={index} className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 border rounded-lg hover:bg-gray-50">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium mb-1">Data</label>
                  <input
                    type="date"
                    value={despesa.data_lancamento}
                    onChange={(e) => atualizarDespesa(index, 'data_lancamento', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium mb-1">Categoria *</label>
                  <select
                    value={despesa.categoria}
                    onChange={(e) => atualizarDespesa(index, 'categoria', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="">Selecione</option>
                    {categorias.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <label className="block text-xs font-medium mb-1">Descrição *</label>
                  <input
                    type="text"
                    value={despesa.descricao}
                    onChange={(e) => atualizarDespesa(index, 'descricao', e.target.value)}
                    placeholder="Ex: Gasolina posto Shell"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium mb-1">Valor *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={despesa.valor}
                    onChange={(e) => atualizarDespesa(index, 'valor', e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium mb-1">Forma Pagamento</label>
                  <select
                    value={despesa.forma_pagamento}
                    onChange={(e) => atualizarDespesa(index, 'forma_pagamento', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    {formasPagamento.map(forma => (
                      <option key={forma} value={forma}>{forma}</option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-1 flex items-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removerLinha(index)}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lista de Despesas Recentes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">📋 Últimas 20 Despesas Manuais</h2>
          {loadingLista ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : despesasSalvas.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhuma despesa manual cadastrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pagamento</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {despesasSalvas.map((despesa) => (
                    <tr key={despesa.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        {new Date(despesa.data_lancamento).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{despesa.categoria}</td>
                      <td className="px-4 py-3 text-sm">{despesa.descricao}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-red-600">
                        R$ {Number(despesa.valor).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">{despesa.forma_pagamento}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deletarDespesa(despesa.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold text-right">TOTAL:</td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-red-600">
                      R$ {despesasSalvas.reduce((s, d) => s + Number(d.valor), 0).toFixed(2)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
