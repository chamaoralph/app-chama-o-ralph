

## Correcao: Modal de Edicao Nao Carrega ao Alterar Data

### Problema Identificado

Ao abrir o modal de edicao de cotacao, a pagina pode travar porque o campo `data_servico_desejada` nao esta sendo tratado corretamente.

**Causa raiz**: O codigo trata a data de forma inconsistente:

```tsx
// Linha 216 - NAO faz split (pode vir com timezone)
data_servico_desejada: cotacao.data_servico_desejada || '',

// Linha 219 - FAZ split corretamente
data_criacao: cotacao.created_at ? cotacao.created_at.split('T')[0] : '',
```

O campo `input type="date"` espera o formato `YYYY-MM-DD`, mas se a data vier com timezone (ex: `2026-01-06T00:00:00+00:00`), o input pode ter comportamento imprevisivel ou causar loops de re-renderizacao.

---

### Solucao

Normalizar o tratamento de datas no modal de edicao para garantir que sempre use o formato correto.

---

### Mudancas Tecnicas

**Arquivo: `src/pages/admin/cotacoes/Lista.tsx`**

**1. Criar funcao auxiliar para extrair data (antes da funcao abrirEdicao)**

```tsx
// Funcao para extrair apenas a parte da data (YYYY-MM-DD)
function extrairDataParaInput(dataStr: string | null): string {
  if (!dataStr) return ''
  // Se contem T, pegar so a parte antes
  const [dataPart] = dataStr.split('T')
  return dataPart
}
```

**2. Usar a funcao na abertura do modal**

Alterar a linha 216:

```tsx
// ANTES
data_servico_desejada: cotacao.data_servico_desejada || '',

// DEPOIS  
data_servico_desejada: extrairDataParaInput(cotacao.data_servico_desejada),
```

E simplificar a linha 219:

```tsx
// ANTES
data_criacao: cotacao.created_at ? cotacao.created_at.split('T')[0] : '',

// DEPOIS
data_criacao: extrairDataParaInput(cotacao.created_at),
```

---

### Codigo Completo da Correcao

Adicionar antes da funcao `abrirEdicao` (linha ~193):

```tsx
// Extrai apenas YYYY-MM-DD de uma string de data (com ou sem timezone)
function extrairDataParaInput(dataStr: string | null): string {
  if (!dataStr) return ''
  const [dataPart] = dataStr.split('T')
  return dataPart
}
```

Alterar a funcao `abrirEdicao`:

```tsx
setEditForm({
  // ... outros campos
  data_servico_desejada: extrairDataParaInput(cotacao.data_servico_desejada),
  // ... outros campos
  data_criacao: extrairDataParaInput(cotacao.created_at),
  // ... resto
})
```

---

### Resultado

Apos a correcao:
- O modal de edicao abrira normalmente mesmo com datas em diferentes formatos
- O campo de data funcionara corretamente no formato esperado pelo navegador
- Nao havera mais travamentos ao alterar a data

