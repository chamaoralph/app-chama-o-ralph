

## Correcao: Recibo Nao Gera para Servicos Sem Data de Conclusao

### Problema Identificado

O instalador Joao nao consegue gerar recibo porque:

1. A coluna `data_conclusao` foi adicionada recentemente
2. Todos os servicos existentes (finalizados antes da migracao) tem `data_conclusao = NULL`
3. O filtro atual exige que `data_conclusao` exista para incluir no recibo

**Dados do banco:**
```
SRV-2026-080 | data_conclusao: NULL | updated_at: 2026-02-06 02:47 | status: concluido
```

O servico foi finalizado hoje mas nao aparece no recibo porque `data_conclusao` esta vazio.

---

### Solucao

Usar `updated_at` como fallback quando `data_conclusao` nao existir. Isso garante compatibilidade com servicos antigos.

---

### Mudancas Tecnicas

**Arquivo: `src/pages/instalador/MeuExtrato.tsx`**

**1. Atualizar o filtro `servicosHoje` para usar fallback**

```tsx
// ANTES (linha 34-38)
const servicosHoje = servicos.filter(s => {
  if (!s.data_conclusao) return false
  const dataConclusao = new Date(s.data_conclusao)
  return isToday(dataConclusao) && s.status === 'concluido'
})

// DEPOIS
const servicosHoje = servicos.filter(s => {
  // Usa data_conclusao se existir, senao usa updated_at como fallback
  const dataReferencia = s.data_conclusao || s.updated_at
  if (!dataReferencia) return false
  const dataConclusao = new Date(dataReferencia)
  return isToday(dataConclusao) && s.status === 'concluido'
})
```

**2. Adicionar `updated_at` a interface e ao select**

Na interface `Servico`:
```tsx
interface Servico {
  id: string
  codigo: string
  data_servico_agendada: string
  data_conclusao: string | null
  updated_at: string  // ADICIONAR
  status: string
  // ...resto
}
```

No mapeamento dos servicos (linha 131-142):
```tsx
const servicosFormatados = data?.map((s: any) => ({
  // ...campos existentes
  data_conclusao: s.data_conclusao,
  updated_at: s.updated_at,  // ADICIONAR
  // ...resto
})) || []
```

---

### Alternativa: Preencher dados historicos

Apos a correcao, podemos executar uma query SQL para preencher `data_conclusao` nos servicos antigos usando o `updated_at`:

```sql
UPDATE servicos 
SET data_conclusao = updated_at 
WHERE data_conclusao IS NULL 
  AND status IN ('concluido', 'aguardando_aprovacao');
```

Isso garante consistencia dos dados a longo prazo.

---

### Resultado

- Servicos finalizados hoje aparecerao no recibo mesmo sem `data_conclusao`
- Compatibilidade com servicos historicos mantida
- Comportamento correto para novos servicos que terao `data_conclusao` preenchida

