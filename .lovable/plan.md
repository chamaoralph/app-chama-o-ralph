

# Adicionar ação manual de marcar avaliação na página de Avaliações

## Problema
A página só exibe dados. O admin não consegue clicar em uma avaliação pendente e marcá-la como "respondida" com nota e comentário. Só o webhook automático faz isso hoje.

## Solução
Adicionar um botão de ação em cada linha pendente que abre um dialog para o admin registrar a avaliação manualmente (nota 1-5, comentário opcional, ou "não avaliou").

## Mudanças em `src/pages/admin/Avaliacoes.tsx`

1. **Adicionar coluna "Ações"** na tabela com um botão "Registrar" visível apenas para avaliações com status "pendente"
2. **Dialog de registro** com:
   - Seleção de status: "Respondida" ou "Não avaliou"
   - Se "Respondida": seletor de estrelas (1-5) clicável + campo de comentário opcional (max 1000 chars)
   - Botão "Salvar"
3. **Função `registrarAvaliacao`**: faz `update` na tabela `avaliacoes` com `status`, `nota`, `comentario` e `respondido_em`
4. Após salvar, atualiza a lista local e mostra toast de sucesso

## Detalhes
- Nenhuma migration necessária — a tabela `avaliacoes` já tem as colunas `nota`, `comentario`, `status`, `respondido_em`
- RLS já permite UPDATE para admins da empresa
- Nenhum arquivo novo — tudo dentro do `Avaliacoes.tsx` existente

