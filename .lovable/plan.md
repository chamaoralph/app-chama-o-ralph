

# Botão "Ver Detalhes" no Follow-Up

## O que será feito

Adicionar um botão "Ver Detalhes" (ícone de olho) na coluna de ações de cada cotação na tabela de follow-up. Ao clicar, abre um modal/dialog mostrando:

- **Dados da cotação**: cliente, telefone, tipo de serviço, valor estimado, data de criação, descrição
- **Histórico completo de contatos**: lista cronológica com data/hora exata, tipo de contato, quem fez o contato, e observações de cada tentativa

## Alterações

### `src/pages/admin/FollowUp.tsx`
- Adicionar estado `detalhesOpen` e `cotacaoDetalhes` para controlar o modal de detalhes
- Adicionar ícone `Eye` do lucide-react
- Na coluna "Ações", inserir um novo botão com ícone de olho antes dos botões existentes
- Adicionar um segundo `Dialog` para exibir os detalhes completos:
  - Cabeçalho com nome do cliente, telefone, serviço e valor estimado
  - Data de criação da cotação (formatada)
  - Descrição do serviço (se houver)
  - Histórico de contatos com data/hora exata (formato `dd/MM/yyyy HH:mm`), tipo de contato (badge), quem registrou, e observações

### Buscar nome do usuário que registrou o contato
- Ajustar a query de `followup_contatos` para incluir um join com `usuarios` trazendo o nome de quem fez cada contato, para exibir no histórico

Nenhuma alteração de banco de dados necessária.

## Arquivos envolvidos
- `src/pages/admin/FollowUp.tsx`

