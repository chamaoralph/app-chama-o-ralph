## Diagnóstico

O recibo está mostrando "EMPRESA DEVE PAGAR R$ 938,99" como se a empresa tivesse que pagar tudo, mas na verdade o instalador **já recebeu R$ 1.613,00 dos clientes** em 7 dos 8 serviços do dia (dados confirmados no banco).

O cálculo correto deveria aparecer assim:
```
TOTAL BRUTO:                 R$ 938,99
Recebido pelo Instalador:  - R$ 1.613,00
INSTALADOR DEVE DEVOLVER:    R$ 674,01
```

**Causa do bug:** em `src/pages/instalador/MeuExtrato.tsx`, o mapeamento dos serviços vindos do banco (linhas 164-176) **não inclui** o campo `valor_recebido_cliente`. Quando o `GerarReciboModal` é aberto (linha 427), o valor recebido sempre vira `0`, e o `ReciboPreview` mostra apenas o total bruto. A lógica de cálculo do saldo líquido em `ReciboPreview.tsx` já está correta — só falta o dado chegar até lá.

## Correções

### 1. `src/pages/instalador/MeuExtrato.tsx`
- Adicionar `valor_recebido_cliente: number` e `recebimento_cliente: string | null` na interface `Servico`.
- Incluir esses dois campos no objeto retornado por `servicosFormatados` (linha 164).
- Remover o cast `(s as any)` na linha 427 — passar o valor já tipado.

### 2. Melhorar a tabela de "Serviços do Dia" no extrato
A tabela atual mostra apenas Mão de Obra / Reembolso / Total, sem revelar quem recebeu cada serviço. Vou adicionar:
- **Coluna "Recebido"** com valor que o instalador recebeu de cada cliente (em laranja quando > 0, traço quando empresa recebeu).
- **Linha de rodapé** com o total recebido do dia e o **saldo líquido** (verde = empresa paga / vermelho = instalador devolve), espelhando o cálculo do recibo.

Isso faz com que o instalador veja o saldo correto **antes** mesmo de gerar o recibo.

### 3. Melhorar o `ReciboPreview.tsx` (PDF/imagem)
- Adicionar **coluna "Recebido"** na tabela de serviços (mesma da tela), para que o admin/empresa enxergue por linha quanto o instalador coletou.
- Manter o "Resumo Financeiro" como já está (já calcula `INSTALADOR DEVE DEVOLVER` corretamente).

## Arquivos afetados
- `src/pages/instalador/MeuExtrato.tsx` — buscar e exibir `valor_recebido_cliente` + `recebimento_cliente`, repassar ao recibo, adicionar coluna e totais.
- `src/components/instalador/ReciboPreview.tsx` — adicionar coluna "Recebido" na tabela de serviços.

Sem alterações no banco. Sem alterações no fluxo de finalização do serviço (já está salvando corretamente).