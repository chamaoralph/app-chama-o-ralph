
## Correção Completa: Reembolso Indevido no Caixa

### Problema Restante

A correção anterior atualizou os campos nas tabelas `servicos` e `cotacoes`, mas os registros derivados ainda estão incorretos:

1. **Lançamento no Caixa** (lancamentos_caixa)
   - ID: `fafc2053-4995-44e7-ae24-48fc954eda70`
   - Valor: R$ 10,00 de "Reembolso Materiais" para João em 03/02/2026
   - **Ação**: Deletar este lançamento

2. **Recibo Diário** (recibos_diarios)
   - ID: `c1008c3e-0e36-4173-a8e1-054287d594af`
   - Valores atuais: valor_reembolso = 10, valor_total = 224.50
   - Valores corretos: valor_reembolso = 0, valor_total = 214.50
   - **Ação**: Atualizar os totais

### Serviços Envolvidos (já corrigidos)

| Código | Origem Suporte | Mão de Obra | Reembolso |
|--------|----------------|-------------|-----------|
| SRV-2026-078 | cliente | R$ 129,50 | R$ 0,00 |
| SRV-2026-079 | empresa | R$ 85,00 | R$ 0,00 |
| **Total** | | **R$ 214,50** | **R$ 0,00** |

### SQL para Correção

```sql
-- 1. Deletar lançamento indevido do caixa
DELETE FROM lancamentos_caixa 
WHERE id = 'fafc2053-4995-44e7-ae24-48fc954eda70';

-- 2. Corrigir totais do recibo
UPDATE recibos_diarios
SET valor_reembolso = 0,
    valor_total = 214.50
WHERE id = 'c1008c3e-0e36-4173-a8e1-054287d594af';
```

### Resultado Esperado

- O lançamento de R$ 10,00 de reembolso desaparecerá da página Caixa
- O recibo do João de 03/02 mostrará o valor correto de R$ 214,50
- Os relatórios financeiros refletirão o lucro correto para a empresa
