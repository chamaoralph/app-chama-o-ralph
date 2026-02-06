
## Correção: Reembolso de Material com Suporte Fornecido pela Empresa

### Problema Identificado

Quando o suporte é fornecido pela empresa, o instalador João está recebendo reembolso de material no valor do suporte (R$ 10,00), mesmo que esse custo seja da empresa e não dele.

**Exemplo concreto:**
- SRV-2026-079: origem_suporte = empresa, custo_suporte = R$ 10, valor_material = R$ 10
- O instalador recebe R$ 10 de reembolso quando não deveria

### Causa Raiz

O campo `valor_material` na cotação está sendo preenchido com o mesmo valor do suporte quando a empresa fornece. Como o trigger calcula reembolso = valor_material (quando empresa fornece), o instalador acaba recebendo esse valor indevidamente.

**Comportamento esperado:**
- Empresa fornece suporte → custo fica com empresa → instalador não recebe reembolso do suporte
- Instalador compra suporte → valor vai para reembolso de despesas

### Solucao Proposta

**1. Corrigir dados atuais:**

```sql
-- Zerar o valor_reembolso_despesas nos servicos onde empresa forneceu o suporte
-- e o valor_material igual ao custo_suporte (indicando que nao havia outro material)
UPDATE servicos
SET valor_reembolso_despesas = 0
WHERE origem_suporte = 'empresa'
  AND custo_suporte > 0
  AND valor_reembolso_despesas = custo_suporte;

-- Tambem corrigir as cotacoes para evitar inconsistencia futura
UPDATE cotacoes
SET valor_material = 0
WHERE origem_suporte = 'empresa'
  AND custo_suporte > 0
  AND valor_material = custo_suporte;
```

**2. Melhorar a interface (Nova Cotacao):**

Quando o usuario selecionar "Empresa fornece" e preencher o custo do suporte, limpar automaticamente o campo valor_material se ele contiver o mesmo valor, evitando confusao.

### Arquivos a Modificar

- Nenhum arquivo de codigo precisa ser alterado para a correcao dos dados atuais
- Opcional: `src/pages/admin/cotacoes/Nova.tsx` - adicionar validacao/aviso na UI

### Resultado Esperado

- Os servicos SRV-2026-079 e SRV-2026-072 terao valor_reembolso_despesas = 0
- O instalador Joao nao recebera reembolso indevido do suporte fornecido pela empresa
- Os relatorios financeiros refletirao o lucro correto para a empresa
