

# Registrar e Exibir Horário Real das Cotações

## Contexto
A edge function `criar-cotacao-whatsapp` já usa o default `now()` do banco para `created_at`, que registra data E hora. O problema anterior (dia errado) ocorria quando o n8n enviava apenas a data. Agora que está salvando novamente, o `created_at` deve conter o horário real.

Porém, a lista de cotações usa `formatarTimestampBR` que exibe apenas DD/MM/YYYY — sem mostrar o horário. Além disso, não existe nenhuma visualização de distribuição por horário para fins de marketing.

## Alterações

### 1. Exibir horário na lista de cotações (`src/pages/admin/cotacoes/Lista.tsx`)
- Alterar a coluna "Data Cotação" para mostrar também o horário: `DD/MM/YYYY às HH:MM`
- Usar `toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })` para converter corretamente

### 2. Gráfico de distribuição por horário no Funil (`src/components/admin/FunilConversaoContent.tsx`)
- Adicionar um card "Horários de Pico" abaixo do funil
- Gráfico de barras (BarChart do Recharts) mostrando quantidade de cotações por faixa horária (6h-8h, 8h-10h, 10h-12h, 12h-14h, 14h-16h, 16h-18h, 18h-20h, 20h-22h)
- Usar os dados de `created_at` das cotações já carregadas, convertendo para hora local (São Paulo)
- Destacar visualmente a faixa com mais cotações
- Respeitar o filtro de origem já implementado (Google, Indicação, Todos, etc.)

### Nenhuma migration necessária
Os dados de horário já existem no `created_at`. Apenas precisamos exibi-los e analisá-los no frontend.

