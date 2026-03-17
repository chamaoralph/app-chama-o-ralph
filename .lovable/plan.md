

# Implementação: Tabela `conversoes_offline` + Edge Function

## 1. Migration SQL
Criar tabela `conversoes_offline` com RLS:
- Admins podem SELECT (mesma empresa)
- Anon bloqueado
- Sem INSERT/UPDATE/DELETE para clientes — só via Edge Function (service role)

## 2. Edge Function `inserir-conversao-offline`
- Autenticação via `x-webhook-token` usando `WEBHOOK_SECRET` já existente
- Valida campos obrigatórios (`empresa_id`, `conversion_name`)
- Insere via `SUPABASE_SERVICE_ROLE_KEY`
- `verify_jwt = false` no config.toml

## 3. Config.toml
- Adicionar `[functions.inserir-conversao-offline]` com `verify_jwt = false`

## Credenciais para o n8n
- **URL**: `https://xenevneonaqbrqiuvuch.supabase.co/functions/v1/inserir-conversao-offline`
- **Header**: `x-webhook-token: <valor do WEBHOOK_SECRET>`
- **Method**: POST
- **Body**: JSON com `empresa_id`, `conversion_name`, `gclid`, `conversion_time`, `conversion_value`, `conversion_currency`, `external_attribution_data`

## Arquivos
- Migration SQL (nova tabela + RLS)
- `supabase/functions/inserir-conversao-offline/index.ts`
- `supabase/config.toml` (adicionar entry)

