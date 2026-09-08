# Análise de Viabilidade — Operação com Instaladores

> Dados extraídos diretamente do Supabase (projeto `dgkpxgwpjgnrobxduamz`), tabelas `servicos`, `cotacoes`, `google_ads_metrics` e `usuarios`, em 08/09/2026.
> **Nenhum número deste documento é estimado** — tudo vem de consulta direta ao banco. Onde o dado não existe, isso é dito explicitamente em vez de aproximado.

## Ressalvas de escopo (leia antes dos números)

1. **`ga4_metrics` não existe** no banco do projeto. Só há `google_ads_metrics`. Toda a seção de Ads usa exclusivamente essa tabela.
2. **O histórico real tem ~8 meses, não 12.** A tabela `servicos` só tem registros a partir de **06/01/2026**. "Últimos 12 meses" foi substituído por "todo o histórico disponível" (jan/2026 a set/2026, com set/2026 parcial — só até o dia 07).
3. **Não existe nenhum serviço sem instalador atribuído** (`instalador_id` nunca é nulo, nem em janeiro/2026). Portanto **não há, nos dados, um período em que você operava sozinho** — o item "melhor mês sozinho" foi removido da análise, por decisão sua.
4. **O banco tem 5 instaladores reais com histórico de serviço**, não 4: João Victor, Rayana Araujo, Pedro Henrique, Daniel Levy e Bryan Rodrigues (excluída a conta "Claude Teste (instalador)", que tem 0 serviços). Por decisão sua, os 5 foram mantidos na análise.
5. **Rayana Araujo está com `percentual_mao_obra = 0%` no cadastro** (os outros 4 estão em 50%) — por decisão sua, isso é porque ela é sócia e fica com 100% do que fatura, sem passar pela divisão de comissão dos 4 instaladores contratados. Por isso, na tabela de "pago ao instalador" ela aparece com **R$ 0,00 em 100% dos serviços concluídos**, mesmo tendo faturado R$ 57.934,11 em serviços no total — é esperado, não é erro de cadastro. Ela segue nas seções abaixo ao lado dos outros 4 (por decisão sua), mas o critério de comissão dela é diferente e não é comparável ponto a ponto.

---

## 1. Faturamento (histórico completo: jan/2026 – set/2026)

Base: serviços com `status = 'concluido'`, mês definido por `data_conclusao` (ou `data_servico_agendada` quando a data de conclusão está em branco — 12 dos 674 registros).

| Mês | Serviços concluídos | Faturamento (R$) | Ticket médio (R$) |
|---|---|---|---|
| Jan/26 | 72 | 21.943,36 | 304,77 |
| Fev/26 | 35 | 12.679,55 | 362,27 |
| Mar/26 | 69 | 21.406,96 | 310,25 |
| Abr/26 | 62 | 22.780,08 | 367,42 |
| Mai/26 | 107 | **32.225,82** | 301,18 |
| Jun/26 | 90 | 30.849,20 | 342,77 |
| Jul/26 | 106 | 28.088,50 | 264,99 |
| Ago/26 | 115 | 30.527,87 | 265,46 |
| Set/26 (parcial, dias 1–7) | 18 | 3.706,90 | 205,94 |

**Total concluídos no período: 674 serviços | R$ 204.207,24 faturados.**

Achados:
- **O melhor mês do histórico foi Maio/26** (R$ 32.225,82), não junho ou agosto — mesmo com menos instaladores ativos que em jul/ago.
- **O ticket médio caiu ~22% entre junho e agosto** (R$ 342,77 → R$ 265,46), no mesmo período em que o número de instaladores ativos subiu de 3 para 5. Mais gente na rua não vem elevando o ticket — pelo contrário.
- Sobre o item "melhor mês sozinho": não é respondível com os dados do banco (ver ressalva 3 acima).

---

## 2. Produtividade por instalador (últimos 3 meses completos: jun–ago/26)

Base: serviços com `status = 'concluido'`, agrupados por mês de `data_conclusao`/`data_servico_agendada` e por `instalador_id`.

| Instalador | Jun/26 (serv. / R$) | Jul/26 (serv. / R$) | Ago/26 (serv. / R$) | Total jun–ago (serv. / R$) | Pago ao instalador (jun–ago) |
|---|---|---|---|---|---|
| João Victor Marinho Monteiro | 38 / 14.231,70 | 50 / 12.476,80 | 42 / 11.749,98 | **130 / 38.458,48** | 18.718,26 |
| Pedro Henrique dos Santos Silva | 40 / 10.559,00 | 16 / 5.618,50 | 16 / 3.720,46 | 72 / 19.897,96 | 9.667,97 |
| Daniel Levy Souza dos Santos* | — | 24 / 5.874,10 | 35 / 8.658,89 | 59 / 14.532,99 | 7.286,48 |
| Bryan Rodrigues do Rosario* | — | 11 / 2.199,10 | 20 / 5.348,54 | 31 / 7.547,64 | 3.773,81 |
| Rayana Araujo* | 12 / 6.058,50 | 5 / 1.920,00 | 2 / 1.050,00 | 19 / 9.028,50 | **0,00 (sócia, fica com 100%)** |

*Daniel e Bryan só começaram a atender em julho/26 — não têm serviço concluído em junho.

### Média de serviços por dia útil (contado desde o 1º serviço agendado de cada até 07/09/26)

| Instalador | Dias úteis disponíveis | Dias com serviço agendado | Dias úteis **sem nenhum serviço** | Serviços agendados / dia útil disponível |
|---|---|---|---|---|
| João Victor | 71 | 57 | 14 (20%) | 1,94 |
| Daniel Levy | 48 | 32 | 16 (33%) | 1,40 |
| Bryan Rodrigues | 35 | 17 | 18 (51%) | 0,94 |
| Pedro Henrique | 71 | 35 | 36 (51%) | 1,10 |
| Rayana Araujo | 71 | 16 | **55 (77%)** | 0,34 |

(Contagem de "serviços agendados" inclui todos os status, não só concluídos — mede ocupação de agenda, não faturamento.)

### Ranking — quem produz vs. quem só ocupa agenda

1. **João Victor** — líder isolado: maior volume (130 concluídos), maior faturamento (R$ 38.458,48) e menor ociosidade (20% dos dias úteis sem serviço).
2. **Daniel Levy** — melhor eficiência entre os "novatos" (chegou em julho): 1,40 serviços/dia útil, só 33% de dias vazios.
3. **Pedro Henrique** — volume médio, mas **51% dos dias úteis sem nenhum serviço** — a agenda dele está ociosa a maior parte do tempo.
4. **Bryan Rodrigues** — entrada mais recente (jul/26), ainda em rampa, 51% de dias vazios.
5. **Rayana Araujo** — menor produção absoluta (19 concluídos em 3 meses), **77% dos dias úteis sem nenhum serviço agendado** — é quem mais "só ocupa agenda" no grupo. Ela é sócia (fica com 100% do que fatura, ver ressalva 5) — não é uma das 4 instaladoras com quem você divide comissão, então essa ociosidade não pesa no seu caixa da mesma forma que a dos outros 4, mas ainda representa capacidade de atendimento não usada.

---

## 3. Margem real (últimos 6 meses: abr–set/26)

Base: `valor_total` (faturamento), `valor_mao_obra_instalador` (pago a instaladores) e `google_ads_metrics.cost_micros` (gasto em Ads), todos em serviços/meses concluídos.

| Mês | Faturamento (R$) | Pago a instaladores (R$) | Gasto em Ads (R$) | Margem (R$) | Margem (%) |
|---|---|---|---|---|---|
| Abr/26 | 22.780,08 | 5.130,49 | 2.894,88 | 14.754,71 | **64,8%** |
| Mai/26 | 32.225,82 | 11.958,35 | 3.036,45 | 17.231,02 | 53,5% |
| Jun/26 | 30.849,20 | 11.670,35 | 3.721,43 | 15.457,42 | 50,1% |
| Jul/26 | 28.088,50 | 13.037,25 | 4.912,62 | 10.138,63 | 36,1% |
| Ago/26 | 30.527,87 | 14.738,92 | 5.033,39 | 10.755,56 | **35,2%** |
| Set/26 (parcial, dias 1–7) | 3.706,90 | 1.853,45 | 581,46 | 1.271,99 | 34,3% |

### Margem líquida por serviço (R$)

| Abr | Mai | Jun | Jul | Ago | Set (parcial) |
|---|---|---|---|---|---|
| 237,98 | 161,13 | 171,75 | 95,65 | 93,53 | 70,67 |

**A margem % caiu de 64,8% (abr) para 35,2% (ago) — quase pela metade em 4 meses.** Dois efeitos somados: o pagamento a instaladores subiu de 22,5% do faturamento (abr) para 48,3% (ago), e o gasto em Ads subiu de 12,7% para 16,5% do faturamento no mesmo intervalo (ver abaixo). Isso não é ilustrativo — é o que os números mostram mês a mês, na direção contrária à que você quer.

### Quanto do faturamento é consumido por Ads (custo por venda ÷ ticket médio)

| Mês | Gasto Ads ÷ nº serviços concluídos (R$/serviço) | Ticket médio (R$) | % do ticket consumido por Ads |
|---|---|---|---|
| Abr/26 | 46,69 | 367,42 | 12,7% |
| Mai/26 | 28,38 | 301,18 | 9,4% |
| Jun/26 | 41,35 | 342,77 | 12,1% |
| Jul/26 | 46,35 | 264,99 | 17,5% |
| Ago/26 | 43,77 | 265,46 | 16,5% |
| Set/26 (parcial) | 32,30 | 205,94 | 15,7% |

---

## 4. Dependência de Ads

Base: `cotacoes.origem_lead` (982 cotações no total, 0 com origem em branco).

### Origem das cotações (histórico completo)

| Origem | Nº cotações | % do total | Aprovadas | Taxa de aprovação |
|---|---|---|---|---|
| **Google** | 822 | **83,7%** | 561 | 68,2% |
| Não-Google (Indicação, Já era cliente, WhatsApp, Instagram, Orçamento na hora) | 160 | 16,3% | 141 | **88,1%** |
| **Total** | 982 | 100% | 702 | 71,5% |

**Achado importante: leads que não vêm do Google aprovam 88,1% das vezes, contra 68,2% dos leads de Google — mas o Google já é 83,7% de todo o volume de cotações.** A operação está estruturalmente dependente de Ads para ter volume, mesmo sendo a origem menos eficiente em conversão.

### Evolução do custo por venda de Google Ads (todo o período com dado de Ads: fev–set/26)

| Mês | Gasto Ads (R$) | Cotações aprovadas (Google) | Custo por venda (R$) |
|---|---|---|---|
| Fev/26 | 464,91 | 25 | 18,60 |
| Mar/26 | 1.746,33 | 50 | 34,93 |
| Abr/26 | 2.894,88 | 46 | 62,93 |
| Mai/26 | 3.036,45 | 93 | 32,65 |
| Jun/26 | 3.721,43 | 85 | 43,78 |
| Jul/26 | 4.912,62 | 89 | 55,20 |
| Ago/26 | 5.033,39 | 107 | 47,04 |
| Set/26 (parcial) | 581,46 | 16 | 36,34 |

O orçamento de Ads subiu ~10,8× entre fev e ago (R$ 464,91 → R$ 5.033,39). O custo por venda subiu só ~2,5× no mesmo período (R$ 18,60 → R$ 47,04) — o budget maior trouxe mais vendas absolutas (25 → 107/mês), mas cada venda ficou proporcionalmente mais cara, com pico em julho (R$ 55,20).

---

## 5. Gargalo de atendimento

### Cotações criadas por mês e taxa de aprovação

| Mês | Cotações criadas | Aprovadas | Taxa de aprovação |
|---|---|---|---|
| Jan/26 | 91 | 75 | 82,4% |
| Fev/26 | 45 | 41 | 91,1% |
| Mar/26 | 94 | 69 | 73,4% |
| Abr/26 | 100 | 69 | 69,0% |
| Mai/26 | 135 | 105 | 77,8% |
| Jun/26 | 141 | 96 | 68,1% |
| Jul/26 | 162 | 105 | 64,8% |
| Ago/26 | 184 | 122 | 66,3% |
| Set/26 (parcial) | 30 | 20 | 66,7% |

O volume de cotações mais que dobrou de jan (91) para ago (184), mas a **taxa de aprovação caiu de ~82% para ~66%** no mesmo período — mais gente pedindo orçamento, proporcionalmente menos gente fechando. Isso é consistente com o achado da seção 4 (mais volume vindo de Google, que converte pior que outras origens).

### Tempo médio entre criação da cotação e aprovação

- **Média: 63,6 horas**
- **Mediana: 23,9 horas**
- Base: 702 cotações aprovadas com `updated_at` posterior a `created_at`.

### Distribuição de cotações por hora do dia

⚠️ **Anomalia de dados encontrada:** 655 das 982 cotações (66,7%) têm `created_at` registrado exatamente à hora 0 (meia-noite). Isso não é um padrão real de atendimento — é muito provável que seja um processo de importação/sincronização em lote (ex.: sync com N8N/Google Ads) gravando `created_at` com timestamp fixo em vez do horário real de contato do cliente. Reportando como está no banco, sem inventar o horário real desses 655 registros.

Excluindo esse pico, os 327 registros restantes (33,3% do total) com horário real se distribuem assim:

| Período | Cotações | % das 327 com horário real |
|---|---|---|
| Madrugada (1h–5h) | 59 | 18,0% |
| Manhã (7h–11h) | 22 | 6,7% |
| Tarde (12h–17h) | 117 | 35,8% |
| Noite (18h–23h) | 129 | **39,4%** |

Entre os horários confiáveis, **75% do atendimento real acontece entre 12h e meia-noite** — o pico é à noite (18h–23h), fora do horário comercial. Isso ajuda a explicar por que responder cliente consome o dia inteiro: a demanda não para no fim do expediente.

---

## Cenários de projeção de margem líquida mensal

Tudo até aqui foi número real do banco. A partir daqui são **projeções com premissas explícitas** — como você pediu na seção final do pedido. Baseline: agosto/26 (mês mais recente completo): 115 serviços concluídos, faturamento R$ 30.527,87, ticket médio R$ 265,46, pago a instaladores R$ 14.738,92, gasto em Ads R$ 5.033,39, custo por venda de Ads R$ 47,04.

| Cenário | Faturamento/mês | Mão de obra | Ads | Atendimento | **Margem líquida/mês** | **Margem %** |
|---|---|---|---|---|---|---|
| **A** — Você sozinho, sem instaladores | R$ 13.273,00 | R$ 0,00 | R$ 2.352,00 | R$ 0,00 | **R$ 10.921,00** | 82,3% |
| **B** — 4/5 instaladores, ticket +15%, atendente R$2.000/mês | R$ 35.107,05 | R$ 16.949,76 | R$ 5.033,39 | R$ 2.000,00 | **R$ 11.123,90** | 31,7% |
| **C** — 2 melhores instaladores, ticket +15%, Ads reduzido proporcionalmente | R$ 23.470,20 | R$ 11.735,11 | R$ 3.370,18 | R$ 0,00 | **R$ 8.364,91** | 35,6% |

### Premissas de cada cenário (explícitas, não é dado real)

- **A:** capacidade = 50 serviços/mês, o **melhor mês individual já registrado no banco** (João Victor, julho/26) — usado como teto realista de uma pessoa. Ticket mantido no valor atual (R$ 265,46, sem +15%, pois o cenário não pede aumento). Ads calculado pelo custo-por-venda real de agosto (R$ 47,04) × 50. Não existe no banco nenhum período em que você operou sozinho — este número assume que reproduzir a capacidade do seu melhor instalador é possível, o que não está confirmado, especialmente considerando que você também acumularia o atendimento.
- **B:** mantém o volume atual (115 serviços/mês) e a estrutura de comissão atual, com ticket médio +15% (R$ 265,46 → R$ 305,28) e mão de obra/Ads escalados na mesma proporção do faturamento. Soma um atendente fixo em R$ 2.000/mês. **Premissa não testada:** que subir o ticket 15% não reduz o volume de vendas.
- **C:** usa João Victor + Daniel Levy — os 2 melhores do ranking da seção 2 (maior produção e menor ociosidade) — como base (77 serviços/R$ 20.408,87 em agosto), com ticket +15% e Ads reduzido na mesma proporção da queda de volume (77/115 = 67% do budget atual). Sem atendente — o cenário original não previa esse custo aqui, então o problema de tempo de atendimento **não é resolvido** neste cenário.

### Qual paga mais, qual escala melhor

- **Quem paga mais em R$: B (R$ 11.123,90/mês)**, mas por uma margem mínima sobre A (R$ 10.921,00) — uma diferença de ~R$ 203/mês (1,9%), praticamente empate em reais.
- **O que separa A de B não é quanto sobra no fim do mês — é o que cada um custa do seu tempo.** Em A, você volta a instalar o dia inteiro, sozinho, com um teto físico rígido (~50 serviços/mês, o melhor mês individual já visto no banco) e ainda acumula o atendimento que hoje consome seu dia. Em B, você contrata alguém por R$ 2.000/mês exatamente para a tarefa que está sobrecarregando você — e mantém capacidade de crescer (mais leads, mais agenda), coisa que A não permite.
- **C paga menos que A e B em R$ absoluto (R$ 8.364,91)**, apesar de ter a margem percentual mais alta das três (35,6%) — cortar para 2 instaladores corta ~33% do faturamento, e o cenário nem resolve o problema de atendimento (não inclui atendente).
- **Quem escala melhor: B.** É o único cenário que mantém volume de operação e tira você do atendimento ao mesmo tempo — A tem teto físico de uma pessoa, C reduz a capacidade de atendimento da própria operação.

**Mas atenção:** o +15% de ticket é a premissa central de B e C, e **nenhum mês do histórico real (seção 1) chegou a esse ticket médio** — o mês com ticket mais alto foi abril/26, com R$ 367,42. Se o aumento de 15% não for sustentável, a margem de B cai proporcionalmente e A passa a pagar mais que B. Antes de decidir com base neste cenário, valeria testar o aumento de ticket em um grupo pequeno de clientes e confirmar que a conversão (seção 4/5) não cai.

---

*Análise completa — Blocos 1, 2 e 3.*
