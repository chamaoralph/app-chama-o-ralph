

# Melhorar Deduplicação de Cotações (24h → 48h + qualquer status)

## Problema

A deduplicação atual verifica apenas cotações com status `pendente` nas últimas 24 horas. Clientes como a Ciça, que já têm cotações aprovadas/concluídas, geram novas cotações toda vez que mandam mensagem porque a verificação ignora cotações com outros status.

## Solução

Expandir a lógica de deduplicação na Edge Function `criar-cotacao-whatsapp`:

1. **Aumentar janela de 24h para 48h**
2. **Verificar cotações de qualquer status** (não apenas `pendente`) — se o cliente teve qualquer cotação nos últimos 2 dias (pendente, aprovada, concluída, etc.), não criar nova
3. Manter a resposta informativa indicando qual cotação já existe

### Alteração na Edge Function

No trecho de deduplicação (linhas ~201-229), remover o filtro `.eq('status', 'pendente')` e mudar a janela temporal de 24h para 48h:

```typescript
// Deduplicação 48h: verificar qualquer cotação recente para o mesmo cliente
const { data: cotacaoRecente } = await supabase
  .from('cotacoes')
  .select('id, created_at, status')
  .eq('empresa_id', EMPRESA_ID)
  .eq('cliente_id', clienteId)
  .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
```

Nenhuma migration de banco necessária. Apenas alteração na Edge Function.

