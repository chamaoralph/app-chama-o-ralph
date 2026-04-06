

# Adicionar card "Projeção" na página Caixa

## O que será feito
Adicionar um novo card **"PROJEÇÃO"** antes do card de Receitas, mostrando a soma do `valor_total` de todos os serviços agendados no mês selecionado (tabela `servicos`, status que indica agendamento ativo).

## Mudanças visuais

```text
┌──────────┬──────────┬──────────────┬──────────────┬────────┐
│ PROJEÇÃO │ RECEITAS │ DESP. GERAIS │ INSTALADORES │ SALDO  │
│ R$ X     │ R$ X     │ R$ X         │ R$ X         │ R$ X   │
└──────────┴──────────┴──────────────┴──────────────┴────────┘
```

O grid passa de 4 para 5 colunas. O card de Projeção terá fundo amarelo/âmbar para diferenciar.

## Arquivo alterado
- `src/pages/admin/Caixa.tsx`
  - Novo estado `totalProjecao`
  - Nova função `carregarProjecao()` que consulta `servicos` onde `data_servico_agendada` está no mês selecionado e status indica serviço ativo (ex: `disponivel`, `atribuido`, `solicitado`, `em_andamento`, `aguardando_aprovacao` — ou seja, não cancelado/concluído), somando `valor_total`
  - Chamar `carregarProjecao()` junto com os outros loads quando `filtroMes` muda
  - Inserir o card antes do card de Receitas no grid, mudando para `grid-cols-5`

## Detalhes técnicos
- Query: `supabase.from("servicos").select("valor_total").gte("data_servico_agendada", primeiroDia).lte("data_servico_agendada", ultimoDia).not("status", "in", "(cancelado)")`
- Isso inclui serviços já concluídos + os pendentes, dando a projeção total do mês
- Nenhuma migration necessária

