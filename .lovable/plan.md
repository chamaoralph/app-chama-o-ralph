
## Adicionar Botao Editar Pagamento

### Contexto do Problema

Voce lancou o pagamento do recibo de 30/01/2026 com a data errada (05/02 ao inves da data correta). Atualmente nao existe forma de corrigir isso apos confirmar o pagamento.

### Solucao

Adicionar um botao "Editar" para pagamentos ja confirmados, permitindo alterar:
- Data do pagamento
- Comprovante PIX (opcional - substituir ou adicionar)

---

### Mudancas Tecnicas

**Arquivo: `src/components/admin/PagamentosInstaladores.tsx`**

**1. Adicionar novo estado para modal de edicao**

```tsx
// Modal de edição de pagamento
const [modalEdicao, setModalEdicao] = useState(false)
const [editandoPagamento, setEditandoPagamento] = useState(false)
```

**2. Adicionar funcao para abrir modal de edicao**

```tsx
function abrirModalEdicao(recibo: ReciboComInstalador) {
  setReciboSelecionado(recibo)
  // Preencher com a data atual do pagamento
  setDataPagamento(recibo.data_pagamento || '')
  setComprovante(null)
  setModalEdicao(true)
}
```

**3. Adicionar funcao para salvar edicao**

```tsx
async function salvarEdicaoPagamento() {
  if (!reciboSelecionado || !dataPagamento) {
    toast({ title: 'Atencao', description: 'Informe a data', variant: 'destructive' })
    return
  }

  try {
    setEditandoPagamento(true)

    let comprovanteUrl = reciboSelecionado.comprovante_pix_url

    // Upload do novo comprovante se houver
    if (comprovante) {
      const fileName = `${reciboSelecionado.instalador_id}/${Date.now()}_${comprovante.name}`
      const { error: uploadError } = await supabase.storage
        .from('comprovantes')
        .upload(fileName, comprovante)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('comprovantes')
        .getPublicUrl(fileName)
      
      comprovanteUrl = urlData.publicUrl
    }

    const { error } = await supabase
      .from('recibos_diarios')
      .update({
        data_pagamento: dataPagamento,
        comprovante_pix_url: comprovanteUrl
      })
      .eq('id', reciboSelecionado.id)

    if (error) throw error

    toast({ title: 'Sucesso', description: 'Pagamento atualizado!' })
    setModalEdicao(false)
    carregarRecibos()
  } catch (error) {
    console.error('Erro ao editar pagamento:', error)
    toast({ title: 'Erro', description: 'Nao foi possivel atualizar', variant: 'destructive' })
  } finally {
    setEditandoPagamento(false)
  }
}
```

**4. Adicionar botao Editar na coluna de Acoes (para pagamentos ja confirmados)**

Na linha ~417-434, onde mostra os botoes para status "pago":

```tsx
{recibo.status_pagamento === 'pago' && (
  <>
    <Button
      size="sm"
      variant="outline"
      onClick={() => abrirModalEdicao(recibo)}
    >
      <Pencil className="h-4 w-4 mr-1" />
      Editar
    </Button>
    {recibo.comprovante_pix_url && (
      <Button size="sm" variant="outline" onClick={() => verComprovante(recibo.comprovante_pix_url!)}>
        <Eye className="h-4 w-4 mr-1" />
        Comprovante
      </Button>
    )}
    {recibo.data_pagamento && (
      <span className="text-xs text-muted-foreground self-center">
        Pago em {format(new Date(recibo.data_pagamento), 'dd/MM')}
      </span>
    )}
  </>
)}
```

**5. Adicionar import do icone Pencil**

```tsx
import { Check, Upload, Eye, Clock, DollarSign, FileText, Pencil } from 'lucide-react'
```

**6. Adicionar novo modal de edicao**

```tsx
{/* Modal de Edição de Pagamento */}
<Dialog open={modalEdicao} onOpenChange={setModalEdicao}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Editar Pagamento</DialogTitle>
    </DialogHeader>
    
    {reciboSelecionado && (
      <div className="space-y-4">
        <div className="bg-muted p-4 rounded-lg space-y-2">
          <p><strong>Instalador:</strong> {reciboSelecionado.instalador_nome}</p>
          <p><strong>Data do Recibo:</strong> {formatarDataBR(reciboSelecionado.data_referencia)}</p>
          <p className="text-lg font-bold text-primary">
            Total: R$ {reciboSelecionado.valor_total.toFixed(2)}
          </p>
        </div>

        <div>
          <Label htmlFor="dataPagamentoEdit">Data do Pagamento *</Label>
          <Input
            id="dataPagamentoEdit"
            type="date"
            value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="comprovanteEdit">Novo Comprovante (opcional)</Label>
          <Input
            id="comprovanteEdit"
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setComprovante(e.target.files?.[0] || null)}
            className="mt-1"
          />
          {reciboSelecionado.comprovante_pix_url && !comprovante && (
            <p className="text-xs text-muted-foreground mt-1">
              Ja possui comprovante anexado. Selecione outro arquivo para substituir.
            </p>
          )}
        </div>
      </div>
    )}

    <DialogFooter>
      <Button variant="outline" onClick={() => setModalEdicao(false)}>
        Cancelar
      </Button>
      <Button onClick={salvarEdicaoPagamento} disabled={editandoPagamento}>
        {editandoPagamento ? 'Salvando...' : 'Salvar Alteracoes'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### Resultado

- Botao "Editar" aparecera ao lado de "Detalhes" e "Comprovante" para pagamentos ja confirmados
- Ao clicar, abre modal com a data atual preenchida para correcao
- Possibilidade de substituir o comprovante se necessario
- A atualizacao reflete imediatamente na listagem
