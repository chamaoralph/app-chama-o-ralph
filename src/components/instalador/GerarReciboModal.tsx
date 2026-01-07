import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ReciboPreview } from './ReciboPreview'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { Download, Share2, Loader2, FileText } from 'lucide-react'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface ServicoRecibo {
  id: string
  codigo: string
  cliente_nome: string
  tipo_servico: string[]
  valor_mao_obra_instalador: number
  valor_reembolso_despesas: number
}

interface GerarReciboModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  servicos: ServicoRecibo[]
  dataReferencia: Date
  instaladorNome: string
}

export function GerarReciboModal({
  open,
  onOpenChange,
  servicos,
  dataReferencia,
  instaladorNome
}: GerarReciboModalProps) {
  const [gerando, setGerando] = useState(false)

  const totalMaoObra = servicos.reduce((sum, s) => sum + s.valor_mao_obra_instalador, 0)
  const totalReembolso = servicos.reduce((sum, s) => sum + s.valor_reembolso_despesas, 0)
  const totalGeral = totalMaoObra + totalReembolso

  async function gerarPDF(): Promise<Blob | null> {
    const reciboElement = document.getElementById('recibo-content')
    if (!reciboElement) return null

    try {
      const canvas = await html2canvas(reciboElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)

      return pdf.output('blob')
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      return null
    }
  }

  async function salvarRecibo(pdfBlob: Blob) {
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
            valor_reembolso: totalReembolso,
            valor_total: totalGeral,
            quantidade_servicos: servicos.length,
            servicos_ids: servicos.map(s => s.id)
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
            valor_reembolso: totalReembolso,
            valor_total: totalGeral,
            quantidade_servicos: servicos.length,
            servicos_ids: servicos.map(s => s.id)
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
      const pdfBlob = await gerarPDF()
      if (!pdfBlob) {
        toast.error('Erro ao gerar o PDF')
        return
      }

      // Salvar registro no banco
      await salvarRecibo(pdfBlob)

      // Download do arquivo
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `recibo_${format(dataReferencia, 'dd-MM-yyyy')}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('Recibo gerado com sucesso!')
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
      const pdfBlob = await gerarPDF()
      if (!pdfBlob) {
        toast.error('Erro ao gerar o PDF')
        return
      }

      // Salvar registro no banco
      await salvarRecibo(pdfBlob)

      const file = new File([pdfBlob], `recibo_${format(dataReferencia, 'dd-MM-yyyy')}.pdf`, {
        type: 'application/pdf'
      })

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Recibo de Serviços',
          text: `Recibo dos serviços do dia ${format(dataReferencia, 'dd/MM/yyyy')} - Total: R$ ${totalGeral.toFixed(2)}`
        })
        toast.success('Recibo compartilhado!')
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
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Serviços</p>
            <p className="text-2xl font-bold">{servicos.length}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Mão de Obra</p>
            <p className="text-xl font-semibold">R$ {totalMaoObra.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-green-600">R$ {totalGeral.toFixed(2)}</p>
          </div>
        </div>

        {/* Preview do Recibo */}
        <div className="border rounded-lg overflow-hidden bg-white">
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
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
