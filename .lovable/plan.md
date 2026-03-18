

# Liberar SELECT anon na tabela `cliques_whatsapp`

## Alteração

Uma migration SQL que:

1. Remove a policy restritiva `Bloquear acesso anonimo cliques_whatsapp` (bloqueia ALL para anon, impede qualquer nova policy permissiva)
2. Recria bloqueios restritivos apenas para INSERT, UPDATE e DELETE (anon continua sem poder escrever)
3. Cria policy permissiva de SELECT para anon (permite n8n buscar por token)

### SQL

```sql
DROP POLICY "Bloquear acesso anonimo cliques_whatsapp" ON public.cliques_whatsapp;

CREATE POLICY "Bloquear escrita anonima cliques_whatsapp"
  ON public.cliques_whatsapp AS RESTRICTIVE FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "Bloquear update anonimo cliques_whatsapp"
  ON public.cliques_whatsapp AS RESTRICTIVE FOR UPDATE TO anon USING (false);

CREATE POLICY "Bloquear delete anonimo cliques_whatsapp"
  ON public.cliques_whatsapp AS RESTRICTIVE FOR DELETE TO anon USING (false);

CREATE POLICY "Service pode ler cliques"
  ON public.cliques_whatsapp FOR SELECT TO anon USING (true);
```

Nenhuma alteração de código frontend necessária.

