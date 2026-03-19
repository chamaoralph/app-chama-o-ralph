

# Deduplicação e Constraint Unique na `conversoes_offline`

## Passo 1: Limpar duplicatas existentes
Usar o insert tool para deletar registros duplicados, mantendo apenas o mais antigo por GCLID:
```sql
DELETE FROM public.conversoes_offline
WHERE id NOT IN (
  SELECT DISTINCT ON (gclid, conversion_name) id
  FROM public.conversoes_offline
  ORDER BY gclid, conversion_name, created_at ASC
);
```
Nota: o `DISTINCT ON` precisa incluir `conversion_name` também, já que a constraint será sobre ambos.

## Passo 2: Adicionar unique constraint
Migration SQL para evitar duplicatas futuras:
```sql
ALTER TABLE public.conversoes_offline 
ADD CONSTRAINT unique_gclid_conversion 
UNIQUE (gclid, conversion_name);
```

## Passo 3: Atualizar edge function `inserir-conversao-offline`
Alterar o INSERT para usar `ON CONFLICT` (upsert), evitando erro 500 quando o n8n enviar o mesmo GCLID repetido:
```typescript
const { data, error } = await supabase
  .from("conversoes_offline")
  .upsert({
    empresa_id, conversion_name, gclid, ...
  }, { onConflict: 'gclid,conversion_name' })
  .select()
  .single();
```

### Ordem de execução
1. Deletar duplicatas (insert tool) — necessário antes da constraint
2. Criar migration com a constraint
3. Atualizar edge function para upsert

