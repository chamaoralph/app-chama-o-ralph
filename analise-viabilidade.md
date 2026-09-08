# Análise de Viabilidade — Operação com Instaladores

> Dados extraídos diretamente do Supabase (projeto `dgkpxgwpjgnrobxduamz`), tabelas `servicos`, `cotacoes`, `google_ads_metrics` e `usuarios`, em 08/09/2026.
> **Nenhum número deste documento é estimado** — tudo vem de consulta direta ao banco. Onde o dado não existe, isso é dito explicitamente em vez de aproximado.

## Ressalvas de escopo (leia antes dos números)

1. **`ga4_metrics` não existe** no banco do projeto. Só há `google_ads_metrics`. Toda a seção de Ads usa exclusivamente essa tabela.
2. **O histórico real tem ~8 meses, não 12.** A tabela `servicos` só tem registros a partir de **06/01/2026**. "Últimos 12 meses" foi substituído por "todo o histórico disponível" (jan/2026 a set/2026, com set/2026 parcial — só até o dia 07).
3. **Não existe nenhum serviço sem instalador atribuído** (`instalador_id` nunca é nulo, nem em janeiro/2026). Portanto **não há, nos dados, um período em que você operava sozinho** — o item "melhor mês sozinho" foi removido da análise, por decisão sua.
4. **O banco tem 5 instaladores reais com histórico de serviço**, não 4: João Victor, Rayana Araujo, Pedro Henrique, Daniel Levy e Bryan Rodrigues (excluída a conta "Claude Teste (instalador)", que tem 0 serviços). Por decisão sua, os 5 foram mantidos na análise.
5. **Anomalia de cadastro encontrada:** Rayana Araujo está com `percentual_mao_obra = 0%` no cadastro (todos os outros 4 estão em 50%). Isso faz o valor "pago ao instalador" dela aparecer como **R$ 0,00 em 100% dos serviços concluídos**, mesmo tendo faturado R$ 57.934,11 em serviços no total. Isso é o que está registrado no banco — se na prática ela recebe comissão, o cadastro está desatualizado. Reportado como está, sem corrigir ou estimar o valor real pago a ela.

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
| Rayana Araujo | 12 / 6.058,50 | 5 / 1.920,00 | 2 / 1.050,00 | 19 / 9.028,50 | **0,00 ⚠️** |

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
5. **Rayana Araujo** — menor produção absoluta (19 concluídos em 3 meses), **77% dos dias úteis sem nenhum serviço agendado** — é quem mais "só ocupa agenda" no grupo. Some ainda a anomalia de comissão zerada (ressalva 5).

---

*Bloco 1 de 3 — Faturamento e Produtividade. Próximo bloco: Margem real e Dependência de Ads.*
