import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Loader2, Upload } from 'lucide-react'
import { processarExtratoOFX, type ResumoConciliacao } from '@/lib/extrato-conciliacao-service'

interface ImportarExtratoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string | null
  /** Chamado depois de um import bem-sucedido, pra tela pai recarregar recibos + fila de revisão. */
  onConcluido?: () => void
}

export function ImportarExtratoModal({ open, onOpenChange, empresaId, onConcluido }: ImportarExtratoModalProps) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [processando, setProcessando] = useState(false)
  const [resumo, setResumo] = useState<ResumoConciliacao | null>(null)

  async function handleImportar() {
    if (!arquivo || !empresaId) return
    setProcessando(true)
    setResumo(null)
    try {
      const conteudo = await arquivo.text()
      const resultado = await processarExtratoOFX(empresaId, conteudo)
      setResumo(resultado)

      if (resultado.erros.length === 0) {
        toast({
          title: 'Extrato importado',
          description: `${resultado.automaticos} baixa(s) automática(s), ${resultado.revisao} pra revisão, ${resultado.semCorrespondencia} sem correspondência.`
        })
      } else {
        toast({
          title: 'Extrato importado com alguns erros',
          description: `${resultado.erros.length} transação(ões) com erro — veja detalhes abaixo.`,
          variant: 'destructive'
        })
      }
      onConcluido?.()
    } catch (error) {
      console.error('Erro ao importar extrato:', error)
      toast({ title: 'Erro', description: 'Não foi possível importar o extrato', variant: 'destructive' })
    } finally {
      setProcessando(false)
    }
  }

  function handleFechar() {
    setArquivo(null)
    setResumo(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Extrato Bancário (OFX)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="arquivoOfx">Arquivo .ofx</Label>
            <Input
              id="arquivoOfx"
              type="file"
              accept=".ofx"
              onChange={(e) => {
                setArquivo(e.target.files?.[0] || null)
                setResumo(null)
              }}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Baixe o extrato do banco no formato OFX e selecione o arquivo. Transações já importadas antes
              (mesmo período repetido) não são processadas de novo.
            </p>
          </div>

          {resumo && (
            <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
              <p>
                <strong>{resumo.totalTransacoesCredito}</strong> crédito(s) no extrato
                {resumo.jaProcessadas > 0 && ` (${resumo.jaProcessadas} já processado(s) antes)`}
              </p>
              <p className="text-green-600">✅ <strong>{resumo.automaticos}</strong> baixa(s) automática(s)</p>
              <p className="text-amber-600">⚠️ <strong>{resumo.revisao}</strong> pra revisão manual</p>
              <p className="text-muted-foreground">— <strong>{resumo.semCorrespondencia}</strong> sem correspondência</p>
              {resumo.erros.length > 0 && (
                <div className="text-destructive pt-2 border-t">
                  <p className="font-medium">Erros:</p>
                  <ul className="list-disc list-inside">
                    {resumo.erros.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleFechar}>
            Fechar
          </Button>
          <Button onClick={handleImportar} disabled={!arquivo || processando}>
            {processando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            {processando ? 'Processando...' : 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
