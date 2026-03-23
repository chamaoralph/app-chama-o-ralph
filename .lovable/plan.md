

# Ajustar deduplicação do webhook WhatsApp

## Problema
Hoje a função `criar_cotacao_whatsapp_atomic` só verifica se existe cotação criada nas últimas 48h. Faltam duas verificações:

1. Se o cliente já tem uma **cotação ativa** (status `pendente` ou `aprovada`) — independente de quando foi criada — não criar nova
2. Se o cliente já tem um **serviço concluído nos últimos 3 dias** (status `concluido` ou `aguardando_aprovacao`) — não criar nova

## Alteração

Uma única migration que faz `CREATE OR REPLACE FUNCTION` na `criar_cotacao_whatsapp_atomic`, substituindo o bloco de verificação atual (linhas 96-117) por três verificações em sequência:

```text
1. Cotação ativa (pendente ou aprovada) → retorna "cotação ativa já existe"
2. Serviço recente (concluído/aguardando_aprovação nos últimos 3 dias) → retorna "serviço recente já existe"
3. Cotação criada nas últimas 48h (qualquer status) → mantém comportamento atual
```

Cada verificação retorna um JSON com `cotacao_existente: true` ou novo campo `servico_recente: true`, com mensagem explicativa, para o n8n saber o motivo.

## Resposta para o n8n
- Cotação ativa: `{ sucesso: true, cotacao_existente: true, mensagem: "Cliente já tem cotação ativa (pendente/aprovada)..." }`
- Serviço recente: `{ sucesso: true, servico_recente: true, mensagem: "Cliente tem serviço concluído nos últimos 3 dias..." }`
- Cotação 48h: mantém igual

## Arquivo envolvido
- Nova migration SQL (apenas `CREATE OR REPLACE FUNCTION`)
- Nenhuma alteração no edge function TypeScript (a resposta já é tratada genericamente)

