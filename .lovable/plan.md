

# Adicionar camada "Conversões Google" no topo do Funil

## O que será feito
Adicionar uma nova camada no topo do funil visual mostrando as **conversões que o Google Ads reporta** (`conversions` da tabela `google_ads_metrics`), acima da camada de "Leads (Cotações)" que já existe. Isso permite comparar:

- **Conversões Google**: o que o Google diz que converteu
- **Leads (Cotações Google)**: o que você de fato registrou no sistema como vindo do Google

## Mudanças no funil visual (de cima para baixo)

```text
┌─────────────────────────────────┐
│   Conversões Google Ads: 15     │  ← NOVA (dados do Google)
└─────────────────────────────────┘
              ↓
┌───────────────────────────────┐
│   Leads (Cotações): 12        │  ← já existe
└───────────────────────────────┘
              ↓
        Taxa de conversão
              ↓
┌─────────────────────────────┐
│   Serviços Agendados: 8    │  ← já existe
└─────────────────────────────┘
              ↓
┌───────────────────────────┐
│   Receita Gerada: R$X     │  ← já existe
└───────────────────────────┘
```

Entre "Conversões Google" e "Leads" será exibida a **taxa de confirmação** (ex: "80% confirmados no sistema"), para você ver quanto do que o Google reporta de fato virou cotação registrada.

## Arquivo alterado
- `src/components/admin/FunilConversaoContent.tsx`
  - Somar `conversions` do `google_ads_metrics` no período e guardar em novo estado `conversoesGoogle`
  - Adicionar bloco visual roxo/violeta no topo do funil com o total de conversões do Google
  - Mostrar taxa de confirmação (leads / conversoesGoogle) entre as duas primeiras camadas
  - Adicionar card de KPI "Conversões Google" na linha de cards superior

## Detalhes técnicos
- Campo `conversions` já existe na tabela `google_ads_metrics` e já é populado pelo webhook
- Nenhuma migration necessária
- A nova camada só aparece quando há dados de conversões do Google (> 0)

