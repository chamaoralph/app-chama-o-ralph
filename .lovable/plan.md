
# Proximos Passos da Integracao Google Ads

## 1. Cadastrar Secret

Solicitar o cadastro do secret `GOOGLE_ADS_WEBHOOK_TOKEN` com o valor sugerido:
```
gads_wh_Xk9mP2vL7nR4qJ8sT1wY6bF3dH5
```

## 2. Criar Edge Function `google-ads-webhook`

Arquivo: `supabase/functions/google-ads-webhook/index.ts`

- Validar CORS (OPTIONS)
- Validar header `x-webhook-token` contra o secret
- Receber body com `empresa_id` e array `metrics` contendo objetos com: `data`, `cost_micros`, `clicks`, `impressions`, `conversions`
- Usar `supabaseClient` com service_role para fazer upsert na tabela `google_ads_metrics`
- Retornar status de sucesso/erro

Configurar `verify_jwt = false` no `supabase/config.toml` (webhook externo, sem auth JWT).

## 3. Atualizar Frontend

### FunilConversaoContent.tsx
- Buscar dados de investimento, cliques e impressoes da tabela `google_ads_metrics` em vez de `lancamentos_caixa`
- Adicionar novos cards de KPI: Cliques, Impressoes, CTR
- Mostrar data da ultima sincronizacao
- Manter fallback para metodo antigo caso nao haja dados na nova tabela

### MetricasLineChart.tsx
- Adicionar novas opcoes de metrica: Cliques, Impressoes, CTR
- Expandir a interface `DailyData` com campos `clicks`, `impressions`

## 4. Fornecer Script Google Ads

Entregar o codigo JavaScript completo para colar no painel Google Ads Scripts, ja com a URL do webhook e instrucoes de onde colocar o token.

## Secao Tecnica

### Edge Function (estrutura)
```typescript
// POST /google-ads-webhook
// Headers: x-webhook-token: <GOOGLE_ADS_WEBHOOK_TOKEN>
// Body: { empresa_id: string, metrics: [{ data, cost_micros, clicks, impressions, conversions }] }
// Upsert em google_ads_metrics usando ON CONFLICT (empresa_id, data)
```

### Novas metricas no frontend
- CTR = clicks / impressions * 100
- Cliques e Impressoes como valores absolutos no grafico
- Cards novos no grid de KPIs
