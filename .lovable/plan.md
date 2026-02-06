

## Correção: Data Final do Mês nos Pagamentos

### Problema Identificado

Na aba "Pagamentos" da página de Instaladores, ao filtrar por mês, o código usa dia 31 como data final fixa:

```typescript
const dataFim = `${ano}-${mes}-31`
```

Isso causa erro para meses que não têm 31 dias (fevereiro, abril, junho, setembro, novembro).

O erro no console confirma:
```
"date/time field value out of range: \"2026-02-31\""
```

Como a página inicia com o mês atual (fevereiro), a query falha imediatamente e nenhum dado é carregado - nem quando você muda para janeiro depois.

### Solução

Calcular corretamente o último dia do mês usando a função `endOfMonth` do date-fns:

```typescript
// Antes (linha 104-105)
const dataInicio = `${ano}-${mes}-01`
const dataFim = `${ano}-${mes}-31`

// Depois
const dataInicio = `${ano}-${mes}-01`
const ultimoDia = endOfMonth(new Date(parseInt(ano), parseInt(mes) - 1, 1))
const dataFim = format(ultimoDia, 'yyyy-MM-dd')
```

### Mudanca no Arquivo

**Arquivo:** `src/components/admin/PagamentosInstaladores.tsx`

1. Adicionar import do `endOfMonth`
2. Corrigir calculo da data final para usar o ultimo dia real do mes

### Resultado Esperado

- Fevereiro usara `2026-02-28` (ou 29 em ano bissexto)
- Todos os meses funcionarao corretamente
- Os recibos de janeiro do Joao (16 no total, somando R$ 3.843,75) aparecerao normalmente

