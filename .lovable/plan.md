

# Plano: Atualizar Edge Function + Gerar JSON do n8n

## O que será feito

### 1. Atualizar `criar-cotacao-whatsapp` para autenticação por token simples
A função hoje usa HMAC SHA-256, mas o fluxo n8n já usa token simples (`x-webhook-token`). Vou alinhar para o mesmo padrão do `inserir-conversao-offline`.

**Arquivo**: `supabase/functions/criar-cotacao-whatsapp/index.ts`
- Remover `createHmac` e `verifySignature`
- Validar com `x-webhook-token === WEBHOOK_SECRET`

### 2. Gerar arquivo JSON completo do fluxo n8n atualizado
Vou gerar um arquivo JSON pronto para importar no n8n com o fluxo completo baseado no que você me enviou, adicionando os nós de criação de cotação.

**Saída**: `/mnt/documents/fluxo_whatsapp_cotacao_n8n.json`

O fluxo terá:

```text
Webhook MegaAPI
      │
  Extrair GCLID
      │
  Tem GCLID? ─── SIM → Salvar Conversão Offline
  │                          │
  │                   Preparar Cotação → Criar Cotação
  │
  └── NÃO → Preparar Cotação → Criar Cotação
```

Os nós novos:
- **Preparar Cotação** (Code): extrai `pushName`, `senderPn`, `conversation` do payload MegaAPI e monta o body
- **Criar Cotação Supabase** (HTTP Request): POST para a Edge Function com header `x-webhook-token`

O JSON será importável diretamente no n8n via "Import from File".

