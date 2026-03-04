

# Correção: Investimento diário sobrescrito pelo Google Ads

## Problema

Na linha 162 do `FunilConversaoContent.tsx`, dentro do loop de dados diários, o `dayInvestimento` calculado a partir do caixa é **sobrescrito** pelo `cost_micros` do Google Ads:

```typescript
// linha 156-157: calcula investimento do caixa ✓
dayInvestimento = dayDespesas.reduce(...);

// linha 162: SOBRESCREVE com valor do Google Ads ✗
dayInvestimento = dayAds.reduce((sum, m) => sum + (m.cost_micros || 0) / 1_000_000, 0);
```

O KPI total está correto (usa caixa), mas o gráfico diário continua usando o custo do Google Ads.

## Correção

**Arquivo**: `src/components/admin/FunilConversaoContent.tsx`, linha 162

Remover a linha que sobrescreve `dayInvestimento` dentro do bloco `if (adsMetrics...)`. Manter apenas as linhas de `dayClicks` e `dayImpressions`.

