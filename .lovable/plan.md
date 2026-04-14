

# Adicionar botão "Excluir" nos Recibos Não Gerados

## Problema
A seção "Recibos Não Gerados" lista dias sem recibo, mas o admin só pode "Gerar". Se aquele dia não precisa de recibo (ex: serviço cancelado depois, valor zerado, etc.), não há como removê-lo da lista.

## Solução
Adicionar um botão "Ignorar" (X) ao lado do botão "Gerar" em cada linha. Ao clicar, o item é removido da lista local (client-side). A remoção é temporária — ao recarregar a página, o item voltará se ainda houver serviços concluídos sem recibo naquele dia.

## Mudanças

### `src/components/admin/PagamentosInstaladores.tsx`

1. Adicionar uma função `ignorarReciboFaltante(chave: string)` que filtra o item do state `recibosFaltantes`
2. Na coluna "Ação" de cada linha, adicionar um segundo botão com ícone `X` (ou `Trash2`) ao lado do "Gerar", com variant `ghost` e cor vermelha
3. Ambos os botões ficam lado a lado num `flex gap-1`

Nenhuma migration, nenhum arquivo novo.

