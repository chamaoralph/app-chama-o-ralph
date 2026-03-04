

# Correção: Data do lançamento de receita deve usar a data agendada do serviço

## Problema

Quando um serviço é finalizado, o trigger `registrar_no_caixa_ao_aprovar()` insere a receita no caixa usando `CURRENT_DATE` (data atual). Isso faz com que serviços antigos (agendados para fevereiro, por exemplo) apareçam como receita de março quando finalizados em março.

## Causa

Na função `registrar_no_caixa_ao_aprovar()` (migration `20260107005210`), linha 17:

```sql
-- Usa a data de HOJE, não a data do serviço
..., NEW.valor_total, CURRENT_DATE, 'Pix'
```

## Correção

**Migration SQL**: Alterar `CURRENT_DATE` para a data agendada do serviço:

```sql
CURRENT_DATE  →  (NEW.data_servico_agendada)::date
```

Assim, a receita será registrada na data em que o serviço estava agendado, independentemente de quando foi finalizado no sistema.

**Correção de dados existentes**: Atualizar os lançamentos já registrados incorretamente, usando a data agendada dos serviços vinculados:

```sql
UPDATE lancamentos_caixa lc
SET data_lancamento = (s.data_servico_agendada)::date
FROM servicos s
WHERE lc.servico_id = s.id
  AND lc.categoria = 'Receita de Serviço'
  AND lc.data_lancamento != (s.data_servico_agendada)::date;
```

## Resultado

- Receitas passam a constar no mês em que o serviço foi agendado
- Serviços de fevereiro finalizados em março aparecerão corretamente em fevereiro no Caixa

