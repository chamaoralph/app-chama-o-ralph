

# Botão Excluir nas Visualizações Semanal e Mensal de Cotações

## Objetivo
Permitir excluir uma cotação direto pelo painel de detalhes (Sheet) que abre ao clicar num card no calendário Semanal ou Mensal — sem ter que voltar para a Lista.

## Como funciona

1. Ao clicar numa cotação no calendário, o Sheet de detalhes abre normalmente (já existe).
2. Adicionar um botão vermelho **"Excluir"** ao lado dos botões "Editar" e "Aprovar".
3. Ao clicar, abre um `AlertDialog` de confirmação ("Tem certeza? Esta ação não pode ser desfeita").
4. Confirmando, executa `supabase.from('cotacoes').delete().eq('id', cotacaoId)` — o trigger `before_delete_cotacao_cleanup` já cuida da limpeza em cascata (serviços, lançamentos de caixa, suportes) e bloqueia automaticamente se houver serviço em andamento/concluído.
5. Toast de sucesso/erro e recarrega a lista de cotações.

## Mudanças

### `src/components/admin/CalendarioCotacoesSemanal.tsx`
- Adicionar prop `onExcluir: (id: string) => Promise<void>`
- Adicionar `AlertDialog` com botão vermelho "Excluir" no rodapé do Sheet (ao lado de Editar/Aprovar)

### `src/components/admin/CalendarioCotacoesMensal.tsx`
- Mesma mudança (mesma estrutura de Sheet)

### `src/pages/admin/cotacoes/Lista.tsx`
- Passar prop `onExcluir` para os dois componentes de calendário, executando o `delete` no Supabase, mostrando toast e recarregando cotações
- Reaproveitar a lógica de exclusão já existente na visualização Lista

## Detalhes técnicos
- Sem migrations — o trigger `handle_delete_cotacao_cleanup` já existe e faz toda a limpeza/validação
- Mensagens de erro do trigger (ex: "serviço em andamento") são exibidas no toast
- Nenhum arquivo novo

