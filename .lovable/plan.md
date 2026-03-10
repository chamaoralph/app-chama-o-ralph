

# Editar Valores e Apagar Recibos

## O que muda

Na tabela de Pagamentos, cada recibo ganha dois novos botoes na coluna de Acoes:

1. **Editar Valores** (icone de lapis) -- abre modal para corrigir Mao de Obra, Reembolso e Qtd Servicos. Total recalcula automaticamente. Se o recibo ja estiver pago, atualiza tambem os lancamentos correspondentes no caixa.

2. **Apagar** (icone de lixeira vermelha) -- abre dialogo de confirmacao. Se pago, avisa que os lancamentos no caixa serao removidos junto. Ao confirmar, deleta o recibo e os lancamentos associados.

## Alteracoes

### 1. Migration SQL
- Criar policy RLS de **DELETE** na tabela `recibos_diarios` para admins da mesma empresa (atualmente nao existe DELETE policy)

### 2. `src/components/admin/PagamentosInstaladores.tsx`

**Modal de Edicao de Valores** (novo):
- Campos: Mao de Obra, Reembolso, Qtd Servicos
- Total calculado automaticamente (mao de obra + reembolso)
- Ao salvar: update no `recibos_diarios` e, se status `pago`, atualiza valores nos `lancamentos_caixa` correspondentes (usando mesmo padrao de busca por nome do instalador + data referencia na descricao)

**Botao Apagar** (novo):
- `AlertDialog` de confirmacao com aviso especial se recibo esta pago
- Ao confirmar: deleta lancamentos no `lancamentos_caixa` correspondentes (se pago) e depois deleta o recibo

**Posicionamento dos botoes**:
- Editar Valores: ao lado do botao Detalhes, visivel para todos os status
- Apagar: botao vermelho no final, visivel para todos os status

