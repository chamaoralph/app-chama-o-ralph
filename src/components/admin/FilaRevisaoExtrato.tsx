import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { AlertTriangle, Check, Loader2, X } from 'lucide-react'
import { buscarFilaRevisao, confirmarRevisao, ignorarRevisao, type ItemFilaRevisao } from '@/lib/extrato-conciliacao-service'

interface FilaRevisaoExtratoProps {
  empresaId: string | null
  /** Muda esse valor (ex: incrementando um contador) pra forçar recarregar a fila de fora. */
  refreshKey?: number
}

export function FilaRevisaoExtrato({ empresaId, refreshKey }: FilaRevisaoExtratoProps) {
  const [itens, setItens] = useState<ItemFilaRevisao[]>([])
  const [loading, setLoading] = useState(true)
  const [selecionado, setSelecionado] = useState<Record<string, string>>({})
  const [processando, setProcessando] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      const dados = await buscarFilaRevisao(empresaId)
      setItens(dados)
      // Pré-seleciona quando só há 1 candidato, pra bastar clicar em confirmar.
      setSelecionado(prev => {
        const novo = { ...prev }
        for (const item of dados) {
          if (item.candidatos.length === 1 && !novo[item.id]) novo[item.id] = item.candidatos[0].id
        }
        return novo
      })
    } catch (error) {
      console.error('Erro ao carregar fila de revisão do extrato:', error)
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    carregar()
  }, [carregar, refreshKey])

  async function handleConfirmar(item: ItemFilaRevisao) {
    const reciboId = selecionado[item.id]
    if (!reciboId || !empresaId) return
    setProcessando(item.id)
    try {
      await confirmarRevisao(empresaId, item.id, reciboId)
      toast({ title: 'Baixa confirmada', description: 'Recibo marcado como pago e lançado no caixa.' })
      await carregar()
    } catch (error) {
      console.error('Erro ao confirmar revisão:', error)
      toast({ title: 'Erro', description: 'Não foi possível confirmar essa baixa', variant: 'destructive' })
    } finally {
      setProcessando(null)
    }
  }

  async function handleIgnorar(item: ItemFilaRevisao) {
    setProcessando(item.id)
    try {
      await ignorarRevisao(item.id)
      toast({ title: 'Ignorado', description: 'Essa transação saiu da fila de revisão.' })
      await carregar()
    } catch (error) {
      console.error('Erro ao ignorar revisão:', error)
      toast({ title: 'Erro', description: 'Não foi possível ignorar', variant: 'destructive' })
    } finally {
      setProcessando(null)
    }
  }

  if (loading || itens.length === 0) return null

  return (
    <div className="border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700 rounded-lg shadow p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-blue-800 dark:text-blue-300">
          Fila de Revisão do Extrato ({itens.length} transaç{itens.length > 1 ? 'ões' : 'ão'} pra conferir)
        </h3>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Remetente (extrato)</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Recibo candidato</TableHead>
              <TableHead className="text-center">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map(item => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap">
                  {format(new Date(item.data_transacao + 'T12:00:00'), 'dd/MM/yyyy')}
                </TableCell>
                <TableCell className="text-xs max-w-[220px] truncate" title={item.nome_remetente}>
                  {item.nome_remetente}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">R$ {item.valor.toFixed(2)}</TableCell>
                <TableCell>
                  {item.candidatos.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Nenhum candidato válido</span>
                  ) : (
                    <select
                      className="text-xs px-2 py-1 border rounded bg-background max-w-[260px]"
                      value={selecionado[item.id] || ''}
                      onChange={(e) => setSelecionado(prev => ({ ...prev, [item.id]: e.target.value }))}
                    >
                      <option value="">Selecione...</option>
                      {item.candidatos.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.instalador_nome} — {format(new Date(c.data_referencia + 'T12:00:00'), 'dd/MM')} — R$ {c.valor_a_pagar.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      size="sm"
                      onClick={() => handleConfirmar(item)}
                      disabled={!selecionado[item.id] || processando === item.id}
                    >
                      {processando === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleIgnorar(item)}
                      disabled={processando === item.id}
                      title="Ignorar (não é nenhum desses candidatos)"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
