import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ReciboPreview } from './ReciboPreview'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Download, Share2, Loader2, FileText } from 'lucide-react'
import { format } from 'date-fns'
import html2canvas from 'html2canvas'

interface ServicoRecibo {
  id: string
  codigo: string
  cliente_nome: string
  tipo_servico: string[]
  valor_mao_obra_instalador: number
  valor_reembolso_despesas: number
  custo_suporte: number
  ganho_acessorios_instalador?: number | null
  ganho_acessorios_empresa?: number | null
  valor_recebido_cliente: number
  recebimento_cliente: string | null
}

interface GerarReciboModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  servicos: ServicoRecibo[]
  dataReferencia: Date
  instaladorNome: string
  onReciboGerado?: () => void
}

export function GerarReciboModal({
  open,
  onOpenChange,
  servicos,
  dataReferencia,
  instaladorNome,
  onReciboGerado
}: GerarReciboModalProps) {
  const [gerando, setGerando] = useState(false)
  const hiddenContainerRef = useRef<HTMLDivElement>(null)

  const previewWrapperRef = useRef<HTMLDivElement>(null)
  const previewInnerRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)
  const [previewHeight, setPreviewHeight] = useState<number | undefined>()

  useEffect(() => {
    function update() {
      const wrapper = previewWrapperRef.current
      const inner = previewInnerRef.current
      if (!wrapper || !inner) return
      const scale = Math.min(1, wrapper.offsetWidth / 800)
      setPreviewScale(scale)
      setPreviewHeight(inner.scrollHeight * scale)
    }
    update()
    const ro = new ResizeObserver(update)
    if (previewWrapperRef.current) ro.observe(previewWrapperRef.current)
    return () => ro.disconnect()
  }, [servicos])

  const totalMaoObra = servicos.reduce((sum, s) => sum + (s.valor_mao_obra_instalador || 0), 0)
  const totalReembolso = servicos.reduce((sum, s) => sum + (s.valor_reembolso_despesas || 0) + (s.custo_suporte || 0), 0)
  const totalGanhoAcessorios = servicos.reduce(
    (sum, s) => sum + (s.ganho_acessorios_instalador || 0) + (s.ganho_acessorios_empresa || 0),
    0
  )
  const totalInst = servicos.reduce((sum, s) => {
    const reembInst = s.valor_reembolso_despesas || 0
    const ganhoInst = s.ganho_acessorios_instalador || 0
    const maoObra = s.valor_mao_obra_instalador || 0
    return sum + (maoObra + reembInst + ganhoInst)
  }, 0)
  const totalRecebidoPeloInstalador = servicos.reduce(
    (sum, s) => sum + (s.recebimento_cliente === 'instalador' ? (s.valor_recebido_cliente || 0) : 0),
    0
  )
  const totalGeral = totalMaoObra + totalReembolso + totalGanhoAcessorios
  const saldoLiquido = totalInst - totalRecebidoPeloInstalador
  // Só a fatia que é DELE (reembolso próprio + ganho em acessórios dele) — exclui
  // custo_suporte e ganho_acessorios_empresa, que são reembolso da EMPRESA (ele deve
  // devolver, não soma no que ele recebe). totalReembolso/totalGanhoAcessorios acima
  // misturam os dois lados e servem só pro "Total Bruto" exibido na tela, não pra
  // persistir no recibo — ver totalInst logo acima, que já isola certo.
  const totalReembolsoInstalador = totalInst - totalMaoObra

  async function gerarImagem(): Promise<Blob | null> {
    const hiddenContainer = hiddenContainerRef.current
    if (!hiddenContainer) return null

    try {
      // Capturar o conteúdo do container oculto
      const canvas = await html2canvas(hiddenContainer, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 800,
        windowWidth: 800,
        logging: false
      })

      // Converter canvas para blob PNG
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob)
        }, 'image/png', 1.0)
      })
    } catch (error) {
      console.error('Erro ao gerar imagem:', error)
      return null
    }
  }

  async function salvarRecibo() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()

      if (!usuario) throw new Error('Usuário não encontrado')

      const dataFormatada = format(dataReferencia, 'yyyy-MM-dd')

      // Verificar se já existe recibo para esta data
      const { data: reciboExistente } = await supabase
        .from('recibos_diarios')
        .select('id')
        .eq('instalador_id', user.id)
        .eq('data_referencia', dataFormatada)
        .maybeSingle()

      if (reciboExistente) {
        // Atualizar recibo existente
        const { error } = await supabase
          .from('recibos_diarios')
          .update({
            valor_mao_obra: totalMaoObra,
            valor_reembolso: totalReembolsoInstalador,
            valor_total: totalInst,
            quantidade_servicos: servicos.length,
            servicos_ids: servicos.map(s => s.id),
            valor_recebido_cliente: totalRecebidoPeloInstalador
          })
          .eq('id', reciboExistente.id)

        if (error) throw error
      } else {
        // Criar novo recibo
        const { error } = await supabase
          .from('recibos_diarios')
          .insert({
            empresa_id: usuario.empresa_id,
            instalador_id: user.id,
            data_referencia: dataFormatada,
            valor_mao_obra: totalMaoObra,
            valor_reembolso: totalReembolsoInstalador,
            valor_total: totalInst,
            quantidade_servicos: servicos.length,
            servicos_ids: servicos.map(s => s.id),
            valor_recebido_cliente: totalRecebidoPeloInstalador
          })

        if (error) throw error
      }
    } catch (error) {
      console.error('Erro ao salvar recibo:', error)
      // Não bloquear o download se falhar o salvamento
    }
  }

  async function handleDownload() {
    setGerando(true)
    try {
      const imageBlob = await gerarImagem()
      if (!imageBlob) {
        toast.error('Erro ao gerar a imagem')
        return
      }

      // Salvar registro no banco
      await salvarRecibo()

      // Download do arquivo
      const url = URL.createObjectURL(imageBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `recibo_${format(dataReferencia, 'dd-MM-yyyy')}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('Recibo gerado com sucesso!')
      onReciboGerado?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao gerar o recibo')
    } finally {
      setGerando(false)
    }
  }

  async function handleShare() {
    setGerando(true)
    try {
      const imageBlob = await gerarImagem()
      if (!imageBlob) {
        toast.error('Erro ao gerar a imagem')
        return
      }

      // Salvar registro no banco
      await salvarRecibo()

      const file = new File([imageBlob], `recibo_${format(dataReferencia, 'dd-MM-yyyy')}.png`, {
        type: 'image/png'
      })

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Recibo de Serviços',
          text: `Recibo dos serviços do dia ${format(dataReferencia, 'dd/MM/yyyy')} - Total: R$ ${totalGeral.toFixed(2)}`
        })
        toast.success('Recibo compartilhado!')
        onReciboGerado?.()
        onOpenChange(false)
      } else {
        // Fallback: download
        await handleDownload()
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Erro ao compartilhar:', error)
        toast.error('Erro ao compartilhar o recibo')
      }
    } finally {
      setGerando(false)
    }
  }

  if (servicos.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Recibo</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Nenhum serviço finalizado encontrado para gerar recibo.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recibo do Dia - {format(dataReferencia, 'dd/MM/yyyy')}
          </DialogTitle>
        </DialogHeader>

        {/* Resumo Rápido */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Serviços</p>
            <p className="text-2xl font-bold">{servicos.length}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total Bruto</p>
            <p className="text-xl font-semibold">R$ {totalGeral.toFixed(2)}</p>
          </div>
          {totalRecebidoPeloInstalador > 0 && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Recebido do Cliente</p>
              <p className="text-xl font-semibold text-orange-600">R$ {totalRecebidoPeloInstalador.toFixed(2)}</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {saldoLiquido >= 0 ? 'Empresa Deve Pagar' : 'Devolver à Empresa'}
            </p>
            <p className={`text-2xl font-bold ${saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              R$ {Math.abs(saldoLiquido).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Preview visível do Recibo — escala para caber na tela, mantendo 800px para captura */}
        <div
          ref={previewWrapperRef}
          className="border rounded-lg bg-white overflow-hidden"
          style={{ height: previewHeight }}
        >
          <div
            ref={previewInnerRef}
            style={{ width: '800px', transformOrigin: 'top left', transform: `scale(${previewScale})` }}
          >
            <ReciboPreview
              instaladorNome={instaladorNome}
              dataReferencia={dataReferencia}
              servicos={servicos}
            />
          </div>
        </div>

        {/* Container oculto para captura - posição fixa fora da tela */}
        <div
          ref={hiddenContainerRef}
          style={{
            position: 'fixed',
            left: '-9999px',
            top: '0',
            width: '800px',
            backgroundColor: '#ffffff'
          }}
        >
          <ReciboPreview
            instaladorNome={instaladorNome}
            dataReferencia={dataReferencia}
            servicos={servicos}
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleShare}
            disabled={gerando}
            className="gap-2"
          >
            {gerando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            Compartilhar
          </Button>
          <Button 
            onClick={handleDownload}
            disabled={gerando}
            className="gap-2"
          >
            {gerando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Baixar Imagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
