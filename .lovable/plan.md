

# Controle de Recebimento do Cliente pelo Instalador

## Problema
Hoje não há registro de quem recebeu o pagamento do cliente. O instalador às vezes cobra diretamente do cliente, às vezes a empresa cobra. O recibo precisa calcular o saldo líquido considerando o que o instalador já recebeu.

## Lógica do Recibo
```text
Exemplo 1: Instalador tem R$500 a receber, cobrou R$200 do cliente
  Total devido: R$500
  Já recebido pelo instalador: R$200
  Empresa deve pagar: R$300

Exemplo 2: Instalador tem R$500 a receber, cobrou R$600 do cliente
  Total devido: R$500
  Já recebido pelo instalador: R$600
  Instalador deve devolver: R$100
```

## Alterações

### 1. Migration: novos campos na tabela `servicos`
- `valor_recebido_cliente` (numeric, default 0) — quanto o instalador recebeu do cliente
- `recebimento_cliente` (text, nullable) — quem recebeu: `'instalador'` ou `'empresa'`

### 2. Tela de Finalização (`FinalizarServico.tsx`)
Adicionar seção após as fotos:
- Radio: "Quem recebeu do cliente?" → Instalador / Empresa
- Se "Instalador": campo numérico "Valor recebido do cliente (R$)"
- Se "Empresa": valor_recebido_cliente = 0
- Salvar esses campos no update do serviço

### 3. Interface do Recibo (`ServicoRecibo`)
Adicionar `valor_recebido_cliente` à interface usada no recibo.

### 4. Recibo (`ReciboPreview.tsx`)
No resumo financeiro, adicionar:
- "Total Recebido pelo Instalador (dos clientes): R$ X"
- "Saldo: Empresa deve pagar R$ Y" ou "Instalador deve devolver R$ Z"
- O cálculo: `saldo = totalGeral - totalRecebidoCliente`
  - Se positivo → empresa paga
  - Se negativo → instalador devolve

### 5. Modal do Recibo (`GerarReciboModal.tsx`)
- Passar `valor_recebido_cliente` nos dados dos serviços
- Atualizar o resumo rápido para mostrar o saldo líquido

### 6. Recibos Diários (`recibos_diarios`)
Adicionar coluna `valor_recebido_cliente` (numeric, default 0) para registrar o total recebido pelo instalador dos clientes naquele dia, permitindo o cálculo do saldo no histórico.

## Arquivos envolvidos
- Nova migration SQL (2 colunas em `servicos`, 1 em `recibos_diarios`)
- `src/pages/instalador/FinalizarServico.tsx`
- `src/components/instalador/ReciboPreview.tsx`
- `src/components/instalador/GerarReciboModal.tsx`

