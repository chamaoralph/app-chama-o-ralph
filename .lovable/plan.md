

# Integracao Google Ads via Scripts

## Resumo

Ao inves de usar a API REST do Google Ads (que exige Developer Token com aprovacao do Google), vamos usar **Google Ads Scripts** -- um recurso nativo do painel do Google Ads que permite rodar JavaScript agendado e enviar dados via HTTP para a sua aplicacao.

## Como Funciona

```text
┌───────────────────────┐         ┌────────────────────────┐         ┌──────────────────┐
│  Google Ads Scripts   │  POST   │  Edge Function         │  INSERT │  Tabela          │
│  (roda no Google Ads) │────────>│  google-ads-webhook    │────────>│  google_ads_metrics│
│  agendado 1x/dia      │         │  (valida + salva)      │         │  (cache diario)  │
└───────────────────────┘         └────────────────────────┘         └──────────────────┘
                                                                            │
                                                                            v
                                                                    ┌──────────────────┐
                                                                    │  FunilConversao  │
                                                                    │  (le os dados)   │
                                                                    └──────────────────┘
```

## Etapas

### 1. Criar tabela `google_ads_metrics`

Tabela para armazenar as metricas diarias recebidas do Google Ads:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador |
| empresa_id | uuid (FK) | Referencia a empresa |
| data | date | Data da metrica |
| cost_micros | bigint | Custo em micros (dividir por 1.000.000) |
| clicks | integer | Cliques |
| impressions | integer | Impressoes |
| conversions | numeric | Conversoes do Google |
| synced_at | timestamptz | Quando foi sincronizado |

Constraint UNIQUE em (empresa_id, data) para permitir upsert.

### 2. Criar Edge Function `google-ads-webhook`

Endpoint que recebe os dados do Google Ads Scripts via POST. A funcao:

- Recebe um array de metricas diarias no body
- Valida com um token secreto simples (header `x-webhook-token`)
- Faz upsert na tabela `google_ads_metrics`
- Retorna status de sucesso

Sem necessidade de OAuth, Developer Token ou projeto no Google Cloud.

### 3. Atualizar `FunilConversaoContent`

Modificar o componente para:

- Buscar investimento da tabela `google_ads_metrics` ao inves de filtrar `lancamentos_caixa`
- Incluir cliques e impressoes nos KPIs (novos cards)
- Mostrar data da ultima sincronizacao
- Manter fallback: se nao houver dados na tabela, usa o metodo antigo

### 4. Atualizar `MetricasLineChart`

Adicionar novas metricas ao grafico:
- Cliques por dia
- Impressoes por dia
- CTR (Click-Through Rate)

### 5. Script para colar no Google Ads

Forneceremos o codigo JavaScript pronto para voce colar no Google Ads Scripts. O script:

- Busca metricas dos ultimos 30 dias
- Envia via POST para a edge function
- Pode ser agendado para rodar diariamente

## Configuracao no Google Ads (por voce)

1. Abrir Google Ads > Ferramentas > Scripts
2. Criar novo script
3. Colar o codigo que forneceremos
4. Autorizar acesso
5. Agendar execucao diaria (ex: 6h da manha)

Tempo estimado: 5 minutos.

## Credenciais Necessarias

Apenas 1 secret:

| Secret | Descricao |
|--------|-----------|
| GOOGLE_ADS_WEBHOOK_TOKEN | Token simples para autenticar o webhook (voce escolhe qualquer valor) |

## Vantagens vs API Direta

| Google Ads Scripts | API REST |
|---|---|
| Sem Developer Token | Precisa de Developer Token (aprovacao) |
| Sem projeto Google Cloud | Precisa criar projeto + OAuth |
| Setup em 5 min | Setup em dias/semanas |
| 1 secret | 4 secrets |
| Roda no proprio Google Ads | Roda na sua infra |

## Secao Tecnica

### Tabela SQL
```sql
CREATE TABLE google_ads_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES empresas(id) NOT NULL,
  data date NOT NULL,
  cost_micros bigint DEFAULT 0,
  clicks integer DEFAULT 0,
  impressions integer DEFAULT 0,
  conversions numeric DEFAULT 0,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(empresa_id, data)
);

ALTER TABLE google_ads_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver metricas da empresa"
  ON google_ads_metrics FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid()
  ));
```

### Edge Function (resumo)
```typescript
// supabase/functions/google-ads-webhook/index.ts
// - Valida x-webhook-token
// - Recebe array de { data, cost_micros, clicks, impressions, conversions }
// - Upsert na tabela google_ads_metrics
```

### Google Ads Script (exemplo que sera fornecido)
```javascript
function main() {
  var WEBHOOK_URL = 'https://xenevneonaqbrqiuvuch.supabase.co/functions/v1/google-ads-webhook';
  var TOKEN = 'SEU_TOKEN_AQUI';
  
  var report = AdsApp.report(
    'SELECT segments.date, metrics.cost_micros, metrics.clicks, ' +
    'metrics.impressions, metrics.conversions ' +
    'FROM customer ' +
    'WHERE segments.date DURING LAST_30_DAYS'
  );
  // ... formata e envia via UrlFetchApp.fetch(WEBHOOK_URL, ...)
}
```

### Mudancas no Frontend
- `FunilConversaoContent.tsx`: trocar fonte de investimento de `lancamentos_caixa` para `google_ads_metrics`
- `MetricasLineChart.tsx`: adicionar opcoes de cliques/impressoes/CTR
- Novos KPI cards: Cliques, Impressoes, CTR

