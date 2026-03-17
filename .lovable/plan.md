

# Melhorias na função `criar-cotacao-whatsapp`

## Alterações no arquivo `supabase/functions/criar-cotacao-whatsapp/index.ts`

### 1. Flexibilizar `tipo_servico`
- Remover validação obrigatória de `tipo_servico` no payload
- Se não enviado ou array vazio, usar `["A definir"]` como padrão

### 2. Preencher data automaticamente
- Se `data_servico_desejada` não for informada, usar a data atual (`new Date().toISOString().split('T')[0]`)
- Se `horario_inicio` não for informado, usar o horário atual formatado como `HH:MM`

### 3. Deduplicação 24h
- Antes de criar a cotação, consultar se já existe uma cotação com status `pendente` para o mesmo `cliente_id` criada nas últimas 24 horas
- Se existir, retornar a cotação existente com flag `cotacao_existente: true` (status 200) em vez de criar duplicata

### 4. Tornar `cotacao` opcional no payload
- Se o objeto `cotacao` não for enviado, criar um objeto padrão vazio (apenas com defaults)
- Isso simplifica o payload mínimo do n8n para apenas `{ cliente: { nome, telefone } }`

## Payload mínimo após mudanças
```json
{
  "cliente": { "nome": "João", "telefone": "11999998888" },
  "cotacao": { "descricao": "Mensagem do WhatsApp", "origem_lead": "WhatsApp Auto" }
}
```

Ou ainda mais simples:
```json
{
  "cliente": { "nome": "João", "telefone": "11999998888" }
}
```

## Arquivo alterado
- `supabase/functions/criar-cotacao-whatsapp/index.ts`

## Nenhuma migration SQL necessária
A tabela `cotacoes` já suporta valores nulos em `tipo_servico`, `data_servico_desejada`, etc.

