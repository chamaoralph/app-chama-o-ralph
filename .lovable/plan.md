

# Detecção de Recibos Faltantes na Aba de Pagamentos

## Resumo

Adicionar ao componente `PagamentosInstaladores.tsx` uma lógica que cruza serviços concluídos (`status = 'concluido'`) com recibos já existentes (`recibos_diarios`) no mês selecionado. O resultado aparece numa seção de alerta mostrando três situações numa visão unificada:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️ RECIBOS NÃO GERADOS (X dias sem recibo)                       │
│                                                                     │
│  Instalador      │ Data       │ Serviços │ Valor Est. │ Ação        │
│  ──────────────────────────────────────────────────────────────────  │
│  Renato Covelli  │ 10/04/2026 │ 3        │ R$ 450     │ [Gerar]     │
│  Renato Covelli  │ 08/04/2026 │ 1        │ R$ 180     │ [Gerar]     │
│                                         [Gerar Todos]               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Recibos do Mês (tabela já existente, sem mudança visual)           │
│                                                                     │
│  Instalador │ Data │ Serviços │ Valor │ Status    │ Ações           │
│  Renato     │ 12/04│ 2        │ R$300 │ 🟢 Pago   │ Comprov/Det     │
│  Renato     │ 11/04│ 4        │ R$600 │ 🟡 Pend.  │ Pagar/Det       │
└─────────────────────────────────────────────────────────────────────┘
```

## Como funciona a detecção

1. Ao carregar recibos do mês, também buscar todos os serviços com `status = 'concluido'` e `data_conclusao` no mesmo mês
2. Agrupar serviços por `instalador_id` + data da `data_conclusao` (convertida para fuso `America/Sao_Paulo`)
3. Para cada grupo (instalador + dia), verificar se existe um `recibos_diarios` com mesma `data_referencia` e `instalador_id`
4. Os grupos sem recibo correspondente aparecem na seção de alerta com valores pré-calculados

## Mudanças

### `src/components/admin/PagamentosInstaladores.tsx`

1. **Nova função `detectarRecibosFaltantes()`** -- executada dentro de `carregarRecibos()` logo após carregar os recibos existentes:
   - Query: `servicos` com `status = 'concluido'`, `data_conclusao` no mês filtrado
   - Agrupa por `instalador_id` + dia (usando `data_conclusao` ajustada -3h para Brasilia)
   - Cruza com recibos já carregados
   - Calcula totais: `valor_mao_obra_instalador`, `valor_reembolso_despesas`, `valor_recebido_cliente`

2. **Novo state** `recibosFaltantes` -- array com: `instalador_id`, `instalador_nome`, `data`, `servicos[]`, `totalMaoObra`, `totalReembolso`, `totalRecebidoCliente`

3. **Seção de alerta** acima da tabela existente (só aparece se houver itens faltantes):
   - Card com fundo amarelo/amber
   - Tabela compacta com cada dia faltante
   - Botao "Gerar" por linha: cria `recibos_diarios` com `servicos_ids` preenchido
   - Botao "Gerar Todos": loop criando todos de uma vez
   - Após gerar, recarrega tudo

4. **Sem migrations** -- usa tabelas e colunas existentes (`servicos`, `recibos_diarios`)

## Detalhes Tecnicoss

- A data de referencia do recibo usa a mesma logica do extrato do instalador: `data_conclusao` convertida para America/Sao_Paulo
- Conversao de fuso no frontend: `new Date(data_conclusao)` subtraindo 3h e pegando `toISOString().slice(0,10)` (mesmo padrao ja usado no app)
- O valor_recebido_cliente vem do campo `valor_recebido_cliente` do servico
- Ao clicar "Gerar", faz insert em `recibos_diarios` com todos os campos calculados

