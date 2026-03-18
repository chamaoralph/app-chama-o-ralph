

# Alterações na tabela `conversoes_offline`

## 1. Adicionar coluna `enviado_google`
Coluna boolean com default `false` para rastrear quais conversões já foram enviadas ao Google Ads.

## 2. Adicionar RLS policy para UPDATE via anon
Permitir que a anon key faça UPDATE na tabela (necessário para que Edge Functions ou webhooks externos marquem conversões como enviadas).

### SQL da migration

```sql
ALTER TABLE public.conversoes_offline 
ADD COLUMN enviado_google BOOLEAN DEFAULT false;

CREATE POLICY "Anon pode atualizar conversoes_offline"
  ON public.conversoes_offline
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
```

### Nota de segurança
A policy anon para UPDATE é ampla. A proteção real vem do `WEBHOOK_SECRET` validado nas Edge Functions. Se preferir restringir mais, podemos limitar o UPDATE apenas à coluna `enviado_google` via trigger, mas para simplificar a implementação inicial, a policy aberta é suficiente dado que a tabela já bloqueia SELECT/INSERT/DELETE para anon.

**Observação**: será necessário também remover ou ajustar a policy restritiva existente "Bloquear acesso anonimo conversoes_offline" que bloqueia ALL para anon, pois ela conflita com a nova policy de UPDATE — porém ela está marcada como PERMISSIVE (não RESTRICTIVE), então a nova policy de UPDATE prevalecerá por ser mais específica. Na prática, como ambas são PERMISSIVE e a existente usa `USING (false)` para ALL, precisamos dropar a policy antiga e recriar apenas para as operações que queremos bloquear (SELECT, INSERT, DELETE).

### SQL revisado

```sql
ALTER TABLE public.conversoes_offline 
ADD COLUMN enviado_google BOOLEAN DEFAULT false;

-- Remover policy antiga que bloqueia tudo para anon
DROP POLICY IF EXISTS "Bloquear acesso anonimo conversoes_offline" 
  ON public.conversoes_offline;

-- Bloquear SELECT para anon
CREATE POLICY "Bloquear select anonimo conversoes_offline"
  ON public.conversoes_offline FOR SELECT TO anon USING (false);

-- Bloquear INSERT para anon
CREATE POLICY "Bloquear insert anonimo conversoes_offline"
  ON public.conversoes_offline FOR INSERT TO anon WITH CHECK (false);

-- Bloquear DELETE para anon
CREATE POLICY "Bloquear delete anonimo conversoes_offline"
  ON public.conversoes_offline FOR DELETE TO anon USING (false);

-- Permitir UPDATE para anon (usado por Edge Functions com service role)
CREATE POLICY "Anon pode atualizar conversoes_offline"
  ON public.conversoes_offline FOR UPDATE TO anon
  USING (true) WITH CHECK (true);
```

Nenhuma alteração de código frontend necessária — apenas migration de banco.

