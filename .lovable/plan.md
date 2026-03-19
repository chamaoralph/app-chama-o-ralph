

# Corrigir exibição de data das cotações com timestamp meia-noite

## Problema
O n8n está enviando apenas a data (ex: `2026-03-18`), que o banco salva como `2026-03-18T00:00:00+00:00`. Ao converter para São Paulo (UTC-3), vira `17/03/2026 às 21:00` — dia errado.

## Solução
Alterar a função `formatarTimestampBR` em `src/pages/admin/cotacoes/Lista.tsx` para detectar timestamps "meia-noite UTC" (hora, minuto e segundo = 0). Nesses casos, tratar como data pura e exibir apenas `DD/MM/YYYY` sem conversão de timezone. Para timestamps com horário real, continuar exibindo `DD/MM/YYYY às HH:MM` com conversão para São Paulo.

### Lógica
```text
Se hora UTC === 0 && minuto UTC === 0 && segundo UTC === 0:
  → Exibir apenas "DD/MM/YYYY" (extraindo direto da string, sem converter timezone)
Senão:
  → Exibir "DD/MM/YYYY às HH:MM" (convertendo para São Paulo)
```

### Arquivo alterado
- `src/pages/admin/cotacoes/Lista.tsx` — função `formatarTimestampBR` (linhas 108-123)

