

# Lançamento Manual de Recibo pelo Admin

## Objetivo

Adicionar um botão "Lançar Recibo Manual" na tela de Pagamentos (aba dentro de `/admin/instaladores`) que permite ao admin criar um recibo (`recibos_diarios`) manualmente, para casos onde o instalador não conseguiu gerar pelo sistema.

## Alterações

### 1. Frontend: `src/components/admin/PagamentosInstaladores.tsx`

- Adicionar botão "Lançar Recibo Manual" ao lado dos filtros (Mês/Status)
- Criar modal com os campos:
  - **Data de referência** (date input)
  - **Instalador** (select com lista de instaladores ativos da empresa)
  - **Quantidade de serviços** (número, pode ser 0)
  - **Valor Mão de Obra** (numérico)
  - **Valor Reembolso** (numérico, default 0)
  - **Valor Total** (calculado automaticamente = mão de obra + reembolso, editável)
- Ao salvar, inserir diretamente na tabela `recibos_diarios` com `servicos_ids` vazio (`{}`) e status `pendente`

### 2. Backend: Migration SQL

- Adicionar RLS policy para permitir que admins insiram recibos na tabela `recibos_diarios` (atualmente só instaladores podem criar via `instalador_id = auth.uid()`)
- Nova policy: admins da mesma empresa podem INSERT em `recibos_diarios`

### Fluxo

1. Admin clica "Lançar Recibo Manual"
2. Preenche data, seleciona instalador, informa valores
3. Confirma -- recibo aparece na listagem como "Pendente"
4. Admin pode então pagar normalmente usando o fluxo existente

