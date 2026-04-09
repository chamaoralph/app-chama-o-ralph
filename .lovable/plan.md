

# Corrigir erro "function pg_catalog.extract(unknown, integer) does not exist" no RFM

## Problema
A função `calculate_rfm` usa `EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))`, mas em PostgreSQL, `date - date` retorna um **integer** (dias), não um `interval`. O `EXTRACT()` não aceita integer como entrada, gerando o erro.

## Solução
Remover o `EXTRACT(DAY FROM ...)` e usar diretamente `(CURRENT_DATE - MAX(s.data_servico_agendada::date))`, que já retorna o número de dias como integer.

## Mudança
- **Migration SQL**: Recriar a função `calculate_rfm` substituindo todas as ocorrências de:
  ```sql
  EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER
  ```
  por:
  ```sql
  (CURRENT_DATE - MAX(s.data_servico_agendada::date))
  ```
  Há ~6 ocorrências dessa expressão na função que precisam ser corrigidas.

## Nenhuma mudança no frontend
O código TypeScript permanece igual, apenas a função do banco é corrigida.

