

# Usar investimento real do Google Ads no Funil de Marketing

## Situação atual
- O funil já busca **cliques e impressões** da tabela `google_ads_metrics`
- Mas o **investimento** vem de `lancamentos_caixa` (lançamentos manuais com categoria "marketing/google")
- A tabela `google_ads_metrics` já recebe `cost_micros` do Google Ads via webhook — dado que hoje é ignorado no cálculo

## O que será feito
Alterar o `FunilConversaoContent.tsx` para usar `cost_micros` da `google_ads_metrics` como fonte primária de investimento, com fallback para os lançamentos manuais caso não haja dados do Google Ads.

Mudanças específicas:
1. **Investimento total**: somar `cost_micros` de todos os dias do período e converter para reais (dividir por 1.000.000)
2. **Investimento diário**: no gráfico diário, usar `cost_micros` do dia convertido em vez do valor manual
3. **Fallback**: se não houver dados em `google_ads_metrics` para o período, manter o comportamento atual (lancamentos_caixa)
4. **Indicador visual**: mostrar de onde vem o dado de investimento ("Google Ads" ou "Lançamentos manuais") para o usuário saber a fonte

## Arquivo alterado
- `src/components/admin/FunilConversaoContent.tsx` — trocar fonte de investimento para `cost_micros` com fallback

## Detalhes técnicos
- `cost_micros` do Google Ads = valor em micros (1.000.000 = R$ 1,00)
- Conversão: `investimento = cost_micros / 1_000_000`
- Todos os KPIs derivados (CPL, CPC, ROAS) serão automaticamente recalculados pois dependem da variável `investimento`
- Nenhuma migration necessária — dados já existem na tabela

