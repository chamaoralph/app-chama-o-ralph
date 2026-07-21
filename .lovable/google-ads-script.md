
# Integração Google Ads → Webhook

## Como configurar

### 1. Acesse o Google Ads Scripts

1. No painel do Google Ads, vá em **Ferramentas e Configurações** → **Scripts**
2. Clique em **+ Novo script**
3. Cole o código abaixo
4. Substitua `SEU_EMPRESA_ID` pelo ID da sua empresa no sistema
5. Substitua `SEU_TOKEN_AQUI` pelo token que você cadastrou
6. Salve e autorize o script
7. Configure a frequência: **Diariamente**

### 2. Código do Script

```javascript
function main() {
  var WEBHOOK_URL = 'https://dgkpxgwpjgnrobxduamz.supabase.co/functions/v1/google-ads-webhook';
  var WEBHOOK_TOKEN = 'SEU_TOKEN_AQUI'; // Cole seu GOOGLE_ADS_WEBHOOK_TOKEN aqui
  var EMPRESA_ID = 'SEU_EMPRESA_ID';    // Cole o UUID da sua empresa aqui
  var DAYS_BACK = 7; // Quantos dias para trás sincronizar

  var today = new Date();
  var startDate = new Date(today.getTime() - (DAYS_BACK * 24 * 60 * 60 * 1000));

  var dateRange = formatDate(startDate) + ',' + formatDate(today);

  var report = AdsApp.report(
    'SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions ' +
    'FROM campaign ' +
    'WHERE segments.date BETWEEN ' + formatDateGAQL(startDate) + ' AND ' + formatDateGAQL(today)
  );

  var rows = report.rows();
  var dailyData = {};

  while (rows.hasNext()) {
    var row = rows.next();
    var date = row['segments.date'];

    if (!dailyData[date]) {
      dailyData[date] = { data: date, cost_micros: 0, clicks: 0, impressions: 0, conversions: 0 };
    }

    dailyData[date].cost_micros += parseInt(row['metrics.cost_micros'] || '0');
    dailyData[date].clicks += parseInt(row['metrics.clicks'] || '0');
    dailyData[date].impressions += parseInt(row['metrics.impressions'] || '0');
    dailyData[date].conversions += parseFloat(row['metrics.conversions'] || '0');
  }

  var metrics = [];
  for (var date in dailyData) {
    metrics.push(dailyData[date]);
  }

  if (metrics.length === 0) {
    Logger.log('Nenhuma métrica encontrada para o período.');
    return;
  }

  var payload = JSON.stringify({
    empresa_id: EMPRESA_ID,
    metrics: metrics
  });

  var options = {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'x-webhook-token': WEBHOOK_TOKEN
    },
    payload: payload,
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
  Logger.log('Status: ' + response.getResponseCode());
  Logger.log('Response: ' + response.getContentText());
}

function formatDate(date) {
  return Utilities.formatDate(date, AdsApp.currentAccount().getTimeZone(), 'yyyyMMdd');
}

function formatDateGAQL(date) {
  return "'" + Utilities.formatDate(date, AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd') + "'";
}
```

### 3. Testando

1. Após colar e salvar o script, clique em **Executar**
2. Verifique o log para confirmar `Status: 200`
3. Volte ao dashboard de Marketing no sistema para ver os dados

### 4. Agendamento

Configure o script para rodar **diariamente** às 6h da manhã para manter os dados sempre atualizados.
