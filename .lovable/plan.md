

# Corrigir duplicidade de cotação no webhook do WhatsApp

## Problema
A duplicação não vem da tela. O erro está no fluxo do webhook: duas requisições quase simultâneas conseguem passar pela checagem de “já existe cotação nas últimas 48h” antes da primeira gravação terminar.

Como você mesmo vai apagar a duplicata atual, a correção aqui foca em impedir novas duplicações.

## O que vou implementar

### 1. Tornar a deduplicação atômica no banco
Criar uma função no banco para centralizar o fluxo de:
- normalizar telefone
- buscar/criar cliente
- verificar bloqueio
- verificar cotação recente nas últimas 48h
- criar a cotação só se realmente não existir outra recente

Essa função vai usar um lock por telefone/empresa durante a operação, para duas requisições do mesmo lead não rodarem ao mesmo tempo.

### 2. Fazer a Edge Function usar essa função
Alterar `supabase/functions/criar-cotacao-whatsapp/index.ts` para:
- manter validações e autenticação atuais
- parar de fazer `select + insert` separado para cliente/cotação
- chamar a função do banco e devolver a mesma ideia de resposta:
  - cotação criada
  - cotação já existente
  - telefone bloqueado

### 3. Preservar a regra atual de negócio
Vou manter o comportamento existente:
- deduplicação por 48h
- telefone bloqueado não cria nada
- cliente continua sendo reaproveitado quando já existe
- defaults como `tipo_servico = ["A definir"]` e `origem_lead = "WhatsApp Auto"` continuam válidos

## Arquivos envolvidos
- `supabase/functions/criar-cotacao-whatsapp/index.ts`
- nova migration em `supabase/migrations/...sql`

## Resultado esperado
Depois da correção:
- duas chamadas quase simultâneas para o mesmo telefone não vão mais gerar duas cotações
- uma delas cria a cotação
- a outra recebe resposta informando que já existe cotação recente

## Detalhes técnicos
```text
Hoje:
requisição A -> checa -> não encontrou
requisição B -> checa -> não encontrou
requisição A -> insere
requisição B -> insere
=> duplicou

Depois:
requisição A -> adquire lock do telefone
requisição B -> espera
requisição A -> checa e insere
requisição A -> libera lock
requisição B -> checa e encontra a recém-criada
=> não duplica
```

### Estratégia técnica recomendada
- migration criando função `security definer` no schema `public`
- uso de `pg_advisory_xact_lock(...)` com chave derivada de `empresa_id + telefone`
- `INSERT ... ON CONFLICT` para reaproveitar com segurança o cliente, já que `clientes` já tem `UNIQUE (empresa_id, telefone)`
- retorno estruturado da função para a Edge Function responder sem quebrar o n8n

### Observação
Não vou incluir limpeza de dados antigos nessa mudança, já que você disse que apaga a duplicata manualmente.

