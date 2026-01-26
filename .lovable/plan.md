

## Melhoria: Valor Unitário no Controle de Suportes

### Entendimento da Solicitação

Atualmente o custo do suporte é informado manualmente na cotação. O usuário deseja:

1. **Ao entregar suportes** na página /admin/suportes, informar o valor unitário daquela entrega
2. **Ao criar cotação** com "Empresa fornece", o sistema **busca automaticamente** o valor do suporte disponível
3. O valor pode variar entre entregas (ex: lote comprado mais caro ou mais barato)

---

### Solução Proposta

#### 1. Adicionar Coluna `valor_unitario` na Tabela `movimentacoes_suportes`

```text
┌─────────────────────────────────────────────────────────────┐
│ movimentacoes_suportes                                      │
├─────────────────────────────────────────────────────────────┤
│ ... campos existentes ...                                   │
│ valor_unitario (NUMERIC) → Preço do suporte nessa entrega   │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Método FIFO para Consumo de Estoque

Quando um serviço usar um suporte da empresa, o sistema:
- Busca a entrega **mais antiga ainda disponível** para aquele instalador
- Usa o `valor_unitario` daquela entrega
- Registra a movimentação de "uso" vinculada ao serviço

```text
Exemplo:
┌──────────────────────────────────────────────────────────────┐
│ Entrega 15/01: 5 suportes x R$ 30,00 cada                    │
│ Entrega 20/01: 3 suportes x R$ 35,00 cada                    │
├──────────────────────────────────────────────────────────────┤
│ Serviço 25/01: Usa 1 suporte → Pega R$ 30,00 (FIFO)          │
│ Estoque restante: 4 x R$30 + 3 x R$35                        │
└──────────────────────────────────────────────────────────────┘
```

#### 3. Interface Atualizada

**Página de Suportes (/admin/suportes):**
- Adicionar campo "Valor Unitário (R$)" no formulário de entrega
- Mostrar valor unitário no histórico de movimentações
- Na aba de saldos, mostrar valor médio do estoque

**Página de Cotação (/admin/cotacoes/nova):**
- Quando "Empresa fornece" for selecionado:
  - Buscar último valor de entrega do sistema
  - Preencher automaticamente o campo "Custo do Suporte"
  - Permitir edição manual se necessário

---

### Fluxo de Funcionamento

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO COMPLETO                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. ADMIN ENTREGA SUPORTES                                      │
│     ├── Seleciona instalador                                    │
│     ├── Quantidade: 10                                          │
│     ├── Valor unitário: R$ 35,00  ← NOVO CAMPO                  │
│     └── Registra movimentação com valor_unitario = 35.00        │
│                                                                 │
│  2. ADMIN CRIA COTAÇÃO                                          │
│     ├── Seleciona "Empresa fornece"                             │
│     ├── Sistema busca último valor: R$ 35,00                    │
│     ├── Campo "Custo do Suporte" preenche automaticamente       │
│     └── Admin pode ajustar se precisar                          │
│                                                                 │
│  3. SERVIÇO É APROVADO                                          │
│     ├── Trigger cria serviço com custo_suporte = R$ 35,00       │
│     ├── Valor fica com a empresa (não vai pro reembolso)        │
│     └── Comissão calculada só sobre mão de obra                 │
│                                                                 │
│  4. SERVIÇO É CONCLUÍDO (FUTURO - opcional)                     │
│     └── Sistema registra "uso" do suporte no estoque            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Implementação Técnica

**Etapa 1 - Banco de Dados:**
- Adicionar coluna `valor_unitario NUMERIC DEFAULT 0` em `movimentacoes_suportes`

**Etapa 2 - Página de Suportes:**
- Adicionar campo "Valor Unitário (R$)" no formulário de entrega
- Atualizar insert para incluir `valor_unitario`
- Mostrar coluna de valor no histórico

**Etapa 3 - Formulário de Cotação:**
- Quando origem_suporte = 'empresa', buscar último valor de entrega
- Auto-preencher campo custo_suporte
- Mostrar indicação visual de onde veio o valor

---

### Benefícios

- Rastreabilidade completa do custo real de cada suporte
- Flexibilidade para variações de preço entre lotes
- Preenchimento automático reduz erros de digitação
- Base para futuros relatórios de custo de estoque

