

# Rastreamento de Cliques no WhatsApp

## O que será feito

1. **Tabela `cliques_whatsapp`**: id (uuid PK), gclid (text), telefone (text), servico (text), created_at (timestamptz default now()). RLS habilitado com política restritiva — apenas admins autenticados podem SELECT; inserts acontecem via service role na Edge Function.

2. **Edge Function `registrar-clique`**: Recebe POST com `{gclid, telefone, servico}`, valida `x-webhook-token` contra `WEBHOOK_SECRET`, insere na tabela usando service role key. Configurada com `verify_jwt = false` no config.toml.

3. **URL final**: `https://xenevneonaqbrqiuvuch.supabase.co/functions/v1/registrar-clique`

## Detalhes técnicos

### Migration SQL
```sql
CREATE TABLE public.cliques_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gclid text,
  telefone text,
  servico text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cliques_whatsapp ENABLE ROW LEVEL SECURITY;

-- Bloquear acesso anônimo
CREATE POLICY "Bloquear acesso anonimo cliques_whatsapp"
  ON public.cliques_whatsapp AS RESTRICTIVE FOR ALL TO anon USING (false);

-- Admins podem ver cliques da empresa (sem empresa_id, liberar para admins autenticados)
CREATE POLICY "Admins podem ver cliques"
  ON public.cliques_whatsapp FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
```

### Edge Function `supabase/functions/registrar-clique/index.ts`
- CORS headers
- Token validation via `x-webhook-token` / `WEBHOOK_SECRET`
- Insert via Supabase service role client
- Retorna 201 com o registro inserido

### config.toml
Adicionar:
```toml
[functions.registrar-clique]
verify_jwt = false
```

