
# Correção: Reembolso indevido quando empresa fornece suporte

## Problema identificado

Quando a cotação é criada com "Empresa fornece" o suporte, o valor do material (que deveria ser zero nesse caso) está sendo passado como reembolso para o instalador. Isso acontece em 3 pontos do sistema.

## Dados confirmados no banco

Serviços com reembolso indevido:
- SRV-2026-099: empresa forneceu suporte (R$ 308), mas apareceu R$ 308 como reembolso
- SRV-2026-100: empresa forneceu suporte (R$ 41), mas apareceu R$ 41 como reembolso
- SRV-2026-093: empresa forneceu suporte (R$ 75), reembolso de R$ 105

## Correções necessarias

### 1. Trigger `criar_servico_ao_confirmar` (migracao SQL)

Atualmente, quando `origem_suporte = 'empresa'`:
```
valor_reembolso_calc := COALESCE(NEW.valor_material, 0);
```
Deveria ser:
```
valor_reembolso_calc := 0;
```
Quando a empresa fornece o suporte, nao existe reembolso de material para o instalador. Se o instalador tiver despesas extras, ele informa na hora de finalizar o servico.

### 2. Trigger `sincronizar_servico_ao_editar_cotacao` (mesma migracao)

Mesmo problema. Atualmente:
```
ELSE
    novo_valor_reembolso := COALESCE(NEW.valor_material, 0);
```
Corrigir para: quando `origem_suporte = 'empresa'`, reembolso = 0.

### 3. Corrigir servicos existentes (insert tool - UPDATE de dados)

Atualizar os servicos que foram criados com reembolso incorreto:
- Zerar `valor_reembolso_despesas` em servicos onde `origem_suporte = 'empresa'` e o reembolso veio do valor_material da cotacao
- Apenas servicos que ainda NAO foram pagos (status != 'concluido' ou recibo pendente)

### 4. Formulario de cotacao (UI)

Em `src/pages/admin/cotacoes/Nova.tsx`: quando `origem_suporte = 'empresa'`, limpar automaticamente o campo `valor_material` e desabilita-lo, pois nao deve haver reembolso de material quando a empresa fornece.

Mesma correção em `src/pages/admin/cotacoes/Lista.tsx` (modal de edição).

## Arquivos a alterar

| Arquivo | Alteracao |
|---------|-----------|
| Migracao SQL | Corrigir triggers `criar_servico_ao_confirmar` e `sincronizar_servico_ao_editar_cotacao` |
| Dados existentes | UPDATE para zerar reembolso indevido nos servicos afetados |
| `src/pages/admin/cotacoes/Nova.tsx` | Desabilitar/zerar valor_material quando empresa fornece |
| `src/pages/admin/cotacoes/Lista.tsx` | Mesma logica no modal de edicao |

## O que NAO sera alterado

- Nenhuma logica de aprovacao
- Nenhuma logica de recibos
- Quando `origem_suporte = 'instalador'`, o reembolso continua incluindo material + custo_suporte normalmente
