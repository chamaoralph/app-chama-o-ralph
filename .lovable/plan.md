

# Corrigir valor_total: não somar custo_suporte quando empresa fornece

## Problema
Quando a empresa fornece o suporte de TV, o sistema está somando o custo do suporte (R$10) ao valor total do serviço. No caso da Clarissa: R$509 + R$10 = R$519. Mas o correto é R$509, porque o custo do suporte é uma despesa interna da empresa, descontada da base de cálculo da comissão do instalador.

**Lógica correta:**
- Valor total = valor_estimado + valor_material (sem somar custo_suporte quando empresa fornece)
- Base comissão = valor_estimado - custo_suporte = 509 - 10 = 499
- Comissão instalador = 499 × 50% = R$249,50 (já está correto)

## Alteração: Migration SQL

Atualizar as 3 funções de trigger para **não somar** `custo_suporte` ao `valor_total` quando `origem_suporte = 'empresa'`:

### 1. `criar_servico_ao_confirmar()`
Linha do cálculo do valor_total muda de:
```sql
-- ANTES (errado)
valor_total_calc := valor_estimado + valor_material + custo_suporte;

-- DEPOIS (correto) - quando empresa fornece
valor_total_calc := valor_estimado + valor_material;
-- custo_suporte só soma ao total quando INSTALADOR fornece
```

### 2. `sincronizar_servico_ao_editar_cotacao()`
Mesma correção no cálculo do `novo_valor_total`.

### 3. `atualizar_valor_ao_aceitar_servico()`
Esta função já está correta (só recalcula comissão, não mexe no valor_total).

**Resumo da nova lógica para valor_total:**
- `origem_suporte = 'empresa'` → `valor_total = valor_estimado + valor_material` (custo do suporte é interno)
- `origem_suporte = 'instalador'` → `valor_total = valor_estimado + valor_material + custo_suporte` (instalador precisa ser reembolsado)
- Sem suporte → `valor_total = valor_estimado + valor_material`

### Correção do serviço existente
Após aplicar a migration, será necessário corrigir o serviço da Clarissa (SRV-2026-157) atualizando o `valor_total` de R$519 para R$509, ou re-salvar a cotação para que o trigger de sincronização recalcule.

