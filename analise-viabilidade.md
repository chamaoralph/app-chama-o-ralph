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

## Bloco 4 — A opção econômica ("garantia parcial")

### Onde a "opção econômica" mora no banco

Investiguei o schema antes de rodar qualquer número. **A opção econômica é o campo `cotacoes.tv_cobertura`**, que só existe para cotações de TV e tem 2 valores: `parcial` (a econômica — no catálogo interno, `catalogo_servicos`, ela se chama "Parcial", descrição *"Cliente ajuda a encaixar; cobertura parcial"*) e `total` (a cheia — "Proteção Total", *"Equipe faz tudo, cobertura total"*). Esse campo **não existe em `servicos`**, mas todo `servicos.cotacao_id` aponta pra uma linha de `cotacoes`, então cruzei as duas tabelas por esse ID para saber a opção de cada serviço concluído.

Também existe `servicos.usou_suporte_garantia_total` (boolean), que é uma coisa **diferente**: registra se o serviço *de fato* usou a garantia total no momento da execução — bate com `tv_cobertura='total'` em 28 dos 29 casos em que é `true`, mas para a maioria dos serviços com `tv_cobertura='total'` (204 de 232) o campo fica `false`. Não é a mesma informação e não usei esse campo para separar as opções — usei só `tv_cobertura`.

**Quando a opção econômica passou a existir:** a primeira cotação com `tv_cobertura='parcial'` foi criada em **24/04/2026**. Antes disso, o campo `tv_cobertura` só tinha um único registro isolado (`total`, em 17/03/2026, provavelmente teste) — a virada real de dois níveis de cobertura começa em maio/2026.

### Nº e % de cotações por opção (jun–set/26, só cotações de TV — `tv_cobertura` não nulo)

| Mês | Parcial (econômica) | Total (cheia) | % Parcial das cotações de TV |
|---|---|---|---|
| Jun/26 | 25 | 66 | 27,5% |
| Jul/26 | 33 | 59 | 35,9% |
| Ago/26 | 57 | 56 | **50,4%** |
| Set/26 (parcial, dados até o momento da consulta) | 6 | 9 | 40,0% |

A fatia da opção econômica **quase dobrou de junho a agosto** (27,5% → 50,4% das cotações de TV) — em agosto ela já é praticamente metade do volume.

### Ticket médio por opção, por mês

| Mês | Ticket estimado na cotação — Parcial (R$) | Ticket estimado — Total (R$) | Ticket real do serviço — Parcial (R$) | Ticket real do serviço — Total (R$) |
|---|---|---|---|---|
| Jun/26 | 163,92 | 347,86 | 183,14 | 385,61 |
| Jul/26 | 217,61 | 332,42 | 218,32 | 311,93 |
| Ago/26 | 233,70 | 340,21 | 231,30 | 311,12 |
| Set/26 (parcial) | 273,67 | 268,22 | 201,20 | 233,09 |

A opção parcial tem ticket real ~30–50% mais baixo que a opção total em todos os meses (exceto set, com amostra pequena — 5 e 10 serviços).

### Taxa de aprovação por opção, por mês (cotações de TV)

| Mês | Aprovação Parcial | Aprovação Total |
|---|---|---|
| Jun/26 | 96,0% | 92,4% |
| Jul/26 | 84,8% | 96,6% |
| Ago/26 | 91,2% | 87,5% |
| Set/26 (parcial) | 100,0% | 88,9% |

Não há um padrão consistente de qual opção aprova mais — varia mês a mês, sem vencedor claro entre as duas.

### Nº e % de serviços concluídos por opção, por mês

| Mês | Concluídos Parcial | Concluídos Total | % Parcial dos concluídos de TV |
|---|---|---|---|
| Jun/26 | 22 | 59 | 27,2% |
| Jul/26 | 30 | 57 | 34,5% |
| Ago/26 | 53 | 50 | **51,5%** |
| Set/26 (parcial) | 5 | 10 | 33,3% |

### A pergunta central: cliente novo ou canibalização?

Comparando a **taxa de aprovação TOTAL** (todas as cotações, TV ou não) antes e depois da criação da opção parcial (24/04/26):

- **Antes (jan–mar/26):** 230 cotações, 185 aprovadas → **80,4% de aprovação**.
- **Depois (abr–set/26):** 755 cotações, 517 aprovadas → **68,5% de aprovação**.

**A taxa de aprovação total caiu 11,9 pontos percentuais depois que a opção econômica passou a existir, enquanto a fatia dela dentro das cotações de TV cresceu de 0% para mais de 50%. Pelo critério que você pediu, isso é canibalização, não é dizer isso.** A opção parcial não está claramente trazendo cliente que não fecharia de outro jeito — ela está, na melhor leitura dos números, substituindo uma parte do que fecharia na opção cheia (ou pior).

**Ressalva importante:** esse mesmo período (abr–set) é o mesmo em que o volume de leads do Google mais que dobrou (seção 4/5) e a qualidade média dos leads pode ter caído por outros motivos (mais volume, menos triagem). O banco não permite isolar "efeito da opção econômica" de "efeito do aumento de volume/Ads" — os dois aconteceram juntos. O que dá pra afirmar com segurança é a correlação (queda de aprovação total simultânea ao crescimento da fatia econômica); a causalidade exclusiva não é confirmável só com estes dados.

### Cruzamento com origem do lead

| Opção | Google | Outras origens | Total | % vindo do Google |
|---|---|---|---|---|
| Parcial | 113 | 8 | 121 | 93,4% |
| Total | 179 | 11 | 190 | 94,2% |

**A opção econômica não é mais usada em lead de Google do que a opção cheia** — as duas vêm de Google em praticamente a mesma proporção (93,4% vs 94,2%). Não há evidência de que a econômica seja um recurso específico para "salvar" lead de Ads que não converteria — ela é escolhida na mesma proporção em qualquer origem.

---

## Bloco 5 — Cherry-picking já existe?

Base: serviços concluídos jun–ago/26 (últimos 3 meses completos), cruzando `servicos` com `cotacoes` (via `cotacao_id`) para pegar `tv_parede` (alvenaria/drywall/painel_madeira/teto) e `tv_tamanho`. Exclui a conta de teste. Mediana geral de `valor_total` no período: **R$ 250,00** (311 serviços).

### Ticket médio e % de serviços acima da mediana geral, por instalador

| Instalador | Nº serviços | Ticket médio (R$) | % acima da mediana (R$250) |
|---|---|---|---|
| Rayana Araujo* | 19 | 475,18 | **89,5%** |
| João Victor | 130 | 295,83 | 53,1% |
| Pedro Henrique | 72 | 276,36 | 44,4% |
| Daniel Levy | 59 | 246,32 | 37,3% |
| Bryan Rodrigues | 31 | 243,47 | 35,5% |

*Rayana é sócia (ver ressalva 5) — ela pega muito menos volume, mas o que pega tem ticket bem mais alto que a média dos outros 4. Sem ser paga por %, o padrão dela sozinho já sugere que ela escolhe o que atende — mas com só 19 serviços em 3 meses, a amostra é pequena.

### Quem pega drywall/painel/TV grande e quem não pega (dos 4 instaladores contratados)

| Instalador | % parede difícil (drywall+painel) | % TV grande (70"+) |
|---|---|---|
| Daniel Levy | 45,5% (25 de 55) | 16,4% (9 de 55) |
| Pedro Henrique | 41,0% (25 de 61) | 18,0% (11 de 61) |
| João Victor | 39,8% (45 de 113) | 16,8% (19 de 113) |
| Bryan Rodrigues | 28,6% (8 de 28) | 10,7% (3 de 28) |

(Base: só serviços com `tv_parede`/`tv_tamanho` preenchido, ou seja, serviços de TV.)

**Há uma correlação real entre ticket médio, % acima da mediana e % de serviço difícil**, na mesma ordem em 3 das 4 métricas: João e Pedro pegam proporcionalmente mais drywall/painel/TV grande e têm ticket mais alto; Bryan pega proporcionalmente menos de tudo isso e tem o ticket mais baixo dos 4. A variação entre eles não é extrema (28,6% a 45,5% de serviço difícil) — não é uma segregação completa, mas o padrão está lá.

**Não é possível confirmar se isso é escolha do instalador (cherry-picking) ou só o jeito que os serviços são distribuídos hoje** — o banco não tem histórico de quem recusou o quê ou de mudança de `instalador_id` num mesmo serviço (ver abaixo). O que dá para afirmar com números reais é que a variação de dificuldade/ticket entre os 4 já existe — se é por escolha ativa ou por como a agenda é montada, os dados não respondem.

### Recusas ou reatribuições de instalador

**Esse dado não existe no banco.** Procurei por: tabela de histórico/auditoria (não há nenhuma com nome de histórico, log de mudança, ou auditoria além de `importacao_clientes_log`, que é sobre importação de clientes, não sobre serviços); status de recusa/rejeição em `servicos.status` (os únicos valores são `aguardando_aprovacao`, `atribuido`, `cancelado`, `concluido`, `em_andamento`, `solicitado` — nenhum é "recusado"); e campo de instalador anterior (não existe — só há `instalador_id` atual e `instalador_ajudante_id`, sem histórico de troca). Reportando isso como está: **sem estimar** quantas recusas ou reatribuições aconteceram.

---

## Bloco 6 — Tabela de comissão fixa por tipo de serviço

Base: mesma categorização por `tv_parede`/`tv_tamanho` do Bloco 5, agora em jun–ago/26 (todos os serviços da empresa, para ver os tipos mais frequentes) e calibrada especificamente sobre **agosto/26, só os 4 instaladores contratados** (João, Pedro, Daniel, Bryan — excluí Rayana porque ela não recebe os 50% atuais, então não faz sentido incluí-la numa tabela que redistribui esses 50%).

### Tipos de serviço mais frequentes (jun–ago/26, toda a empresa) e o que se paga hoje (50% do valor real)

| Categoria | Nº ocorrências | Ticket médio (R$) | Pago hoje ao instalador em média (50%, R$) |
|---|---|---|---|
| TV pequena/média em alvenaria (fácil) | 129 | 255,01 | 116,16 |
| TV em painel de madeira | 73 | 314,35 | 146,05 |
| Não-TV (fechadura/quadros/outros) | 40 | 263,52 | 99,99 |
| TV em drywall | 34 | 287,69 | 138,05 |
| TV grande em alvenaria (70"+) | 30 | 398,39 | 147,75 |
| TV em teto | 5 | 269,60 | 134,80 |

### Proposta de tabela de valor fixo por categoria

Calibrada sobre agosto/26 (só os 4 instaladores): custo total pago hoje = **R$ 14.738,92** (100 serviços de TV nas 4 categorias abaixo + 12 não-TV + 1 teto). "Não-TV" e "TV em teto" ficam **sem alteração** (não fazem parte do pedido de recalibragem e têm volume baixo — 12 e 1 ocorrência — para justificar um valor fixo confiável).

| Categoria | Pago hoje (média, 50%) | **Valor fixo proposto** | Variação |
|---|---|---|---|
| TV pequena/média em alvenaria (fácil) | R$ 124,20 | **R$ 104,00** | **-16,3%** |
| TV em drywall | R$ 131,43 | **R$ 160,00** | **+21,7%** |
| TV em painel de madeira | R$ 131,02 | **R$ 150,00** | **+14,5%** |
| TV grande em alvenaria (70"+) | R$ 166,21 | **R$ 190,00** | **+14,3%** |
| Não-TV (sem alteração) | R$ 113,04 | R$ 113,04 | 0% |
| TV em teto (sem alteração) | R$ 179,50 | R$ 179,50 | 0% |

Aplicando esses valores fixos ao mix real de agosto (100 serviços de TV nas 4 categorias + 12 não-TV + 1 teto), o custo total fica em **R$ 14.737,96** — R$ 0,96 abaixo do custo real de agosto (R$ 14.738,92). **Neutro no agregado, a menos de um arredondamento de R$ 1.**

### Impacto por instalador (mix real de cada um em agosto/26)

| Instalador | Pago hoje (ago, R$) | Pago com tabela fixa (R$) | Diferença/mês | Por quê |
|---|---|---|---|---|
| Daniel Levy | 4.329,43 | 4.629,50 | **+R$ 300,07** | Mix pesado em painel de madeira (10 de 35 serviços, 28,6%) |
| Pedro Henrique | 1.860,22 | 2.076,96 | **+R$ 216,74** | Proporção alta de TV grande (3 de 16, 18,8%) |
| Bryan Rodrigues | 2.674,26 | 2.608,00 | -R$ 66,26 | Mix quase neutro, leve maioria de alvenaria fácil |
| João Victor | 5.875,01 | 5.423,50 | **-R$ 451,51** | Metade do seu volume (21 de 42 serviços) é TV pequena/média em alvenaria — o mais fácil da tabela |

**Achado central: João Victor — o instalador que mais produz — é quem mais perderia com uma tabela calibrada por dificuldade, porque metade dos serviços dele em agosto foram o tipo mais fácil (TV pequena/média em alvenaria).** Isso não significa que ele "escolhe" o fácil (Bloco 5 não confirma isso) — mas significa que o modelo de 50% linear hoje paga ele bem mesmo com um mix fácil, e uma tabela por dificuldade tiraria parte dessa vantagem. Pedro e Daniel, que têm proporcionalmente mais serviço difícil, ganhariam.

**Ressalva:** os números de "n" por categoria e por instalador em um único mês são pequenos (de 1 a 21) — o mix de agosto pode não se repetir em setembro. Antes de aplicar essa tabela, valeria simular com pelo menos 2-3 meses de mix por instalador, não só agosto.

---

*Análise completa — Blocos 1 a 6.*
