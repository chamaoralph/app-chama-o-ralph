

# Correção: Investimento no Marketing usando dados do Caixa

## Problema

O painel de Marketing mostra **R$ 464,91** como investimento em Google Ads (vindo da tabela `google_ads_metrics`, que registra o custo consumido pela API do Google). Porém, no Caixa existem **4 lançamentos de R$ 200 = R$ 800** referentes a pagamentos reais ao Google no mesmo período.

A tabela `google_ads_metrics` só tem dados de 02/02 a 09/02 (R$ 464,91 consumidos), enquanto o dinheiro efetivamente pago foi R$ 800.

## Causa

No `FunilConversaoContent.tsx`, a lógica atual é **excludente**: se existem dados em `google_ads_metrics`, usa apenas esses para investimento. Se não existem, faz fallback para `lancamentos_caixa`. Nunca usa ambos simultaneamente.

## Solução

Separar as fontes de dados por propósito:

| Métrica | Fonte |
|---------|-------|
| **Investimento** | Sempre `lancamentos_caixa` (dinheiro real saído do caixa) |
| **Cliques, Impressões, CTR** | `google_ads_metrics` (métricas de engajamento do Google) |

Isso garante que o investimento mostrado no funil reflita o valor real gasto, enquanto métricas de performance continuam vindo do Google.

## Alteração

**Arquivo**: `src/components/admin/FunilConversaoContent.tsx`

Na função `carregarDados()`:
1. Sempre buscar investimento de `lancamentos_caixa` filtrando por categoria "Marketing" ou descrição contendo "google"
2. Buscar cliques/impressões de `google_ads_metrics` independentemente
3. Remover a lógica de fallback (`hasAdsData`) que tornava as duas fontes mutuamente exclusivas

