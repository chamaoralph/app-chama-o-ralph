
# Correção: Deduzir custo do suporte antes de calcular comissão

## Problema

No SRV-2026-108:
- Valor mão de obra: R$ 465
- Custo suporte (empresa fornece): R$ 10
- Cálculo atual: 465 / 2 = R$ 232,50 (errado)
- Cálculo correto: (465 - 10) / 2 = R$ 227,50

Quando a empresa fornece o suporte, o custo do suporte deve ser **subtraído do valor da mão de obra antes** de aplicar o percentual de comissão. Isso porque a empresa investiu no hardware e precisa recuperar esse valor antes da divisão.

## Onde corrigir (3 funções SQL)

### 1. `criar_servico_ao_confirmar`
Linha atual:
```
valor_mao_obra_calc := COALESCE(NEW.valor_estimado, 0) * 0.50;
```
Corrigir para: quando `origem_suporte = 'empresa'`, subtrair `custo_suporte` antes de multiplicar pelo percentual.

### 2. `sincronizar_servico_ao_editar_cotacao`
Linha atual:
```
novo_valor_mao_obra := COALESCE(NEW.valor_estimado, 0) * (percentual_instalador / 100.0);
```
Mesma correção.

### 3. `atualizar_valor_ao_aceitar_servico`
Linha atual:
```
NEW.valor_mao_obra_instalador := valor_mao_obra_original * (percentual / 100.0);
```
Precisa buscar `origem_suporte` e `custo_suporte` da cotação e aplicar a mesma lógica.

## Correção de dados existentes

Atualizar os serviços afetados onde `origem_suporte = 'empresa'` e a comissão foi calculada sem deduzir o custo do suporte.

## Lógica corrigida (resumo)

```text
SE origem_suporte = 'empresa':
    base_calculo = valor_estimado - custo_suporte
    comissao = base_calculo * percentual
    reembolso = 0  (já corrigido na migração anterior)
SENÃO:
    base_calculo = valor_estimado
    comissao = base_calculo * percentual
    reembolso = (material + custo_suporte se instalador comprou)
```

## Arquivos alterados

| Alteração | Detalhes |
|-----------|----------|
| Migração SQL | Atualizar as 3 funções com a lógica de dedução do custo_suporte |
| Dados existentes | UPDATE nos serviços com `origem_suporte = 'empresa'` para recalcular a comissão |
