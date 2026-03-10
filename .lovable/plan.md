

# Correção: Filtro de recibo usando data errada

## Problema
O filtro que seleciona serviços para o recibo usa `data_conclusao` (timestamp UTC). Serviços finalizados após 21h no Brasil ficam com data UTC do dia seguinte, excluindo-os do recibo.

## Solução
Trocar a referência de `data_conclusao` para `data_servico_agendada` no filtro `servicosDataSelecionada` em `src/pages/instalador/MeuExtrato.tsx`. Também incluir status `aguardando_aprovacao`.

### Alteração (linhas 42-48):

**De:**
```typescript
const servicosDataSelecionada = servicos.filter(s => {
  const dataReferencia = s.data_conclusao || s.updated_at
  if (!dataReferencia) return false
  const dataConclusaoStr = dataReferencia.split('T')[0]
  return dataConclusaoStr === dataSelecionadaStr && s.status === 'concluido'
})
```

**Para:**
```typescript
const servicosDataSelecionada = servicos.filter(s => {
  if (!s.data_servico_agendada) return false
  const dataAgendadaStr = s.data_servico_agendada.split('T')[0]
  return dataAgendadaStr === dataSelecionadaStr && 
    (s.status === 'concluido' || s.status === 'aguardando_aprovacao')
})
```

Isso é consistente com o padrão timezone-agnostic já usado no dashboard admin e na agenda do instalador. Nenhuma outra alteração necessária.

