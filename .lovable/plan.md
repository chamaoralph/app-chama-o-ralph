
## Solução: Gestão de Suportes de TV

### Entendimento do Problema

O fluxo atual para instalações de TV precisa ser adaptado para:

1. **Empresa fornece suporte fixo** → O custo do suporte deve ser descontado do valor total ANTES de dividir a mão de obra
2. **Controle de estoque** → Rastrear quantos suportes foram entregues a cada instalador (ex: "6 suportes para João hoje")
3. **Instalador compra na rua** → Reembolso normal (já funciona com `valor_reembolso_despesas`)

---

### Solução Proposta

#### 1. Nova Tabela: `movimentacoes_suportes`
Para controle de estoque de suportes fornecidos aos instaladores:

```text
+-----------------------------+
| movimentacoes_suportes      |
+-----------------------------+
| id (uuid)                   |
| empresa_id (uuid)           |
| instalador_id (uuid)        |
| quantidade (int)            |
| tipo_movimento (text)       | → 'entrega' | 'devolucao' | 'uso'
| servico_id (uuid, nullable) | → Vincula uso a um serviço específico
| data_movimento (date)       |
| observacoes (text)          |
| created_at (timestamp)      |
+-----------------------------+
```

#### 2. Novo Campo na Cotação/Serviço: `origem_suporte`
Indica de onde vem o suporte para cada serviço:

- `'empresa'` → Suporte do estoque da empresa (custo descontado do total)
- `'instalador'` → Instalador compra e pede reembolso
- `'cliente'` → Cliente já tem suporte (sem custo adicional)
- `null` → Serviço não envolve suporte

#### 3. Novo Campo: `custo_suporte`
Valor unitário do suporte (padrão configurável, ex: R$ 35,00)

---

### Como Funcionará o Cálculo

**Cenário Atual:**
```
valor_total = valor_mao_obra + valor_material
instalador_recebe = (valor_mao_obra × %) + valor_material
```

**Novo Cenário (com suporte da empresa):**
```
valor_total = valor_mao_obra + valor_material + custo_suporte
valor_liquido_mao_obra = valor_mao_obra (suporte já está no total)
instalador_recebe = (valor_mao_obra × %)
empresa_fica_com = (valor_mao_obra × (100-%) ) + custo_suporte
```

**Cenário (instalador compra suporte):**
```
valor_total = valor_mao_obra + valor_material + custo_suporte_reembolso
instalador_recebe = (valor_mao_obra × %) + custo_suporte_reembolso
```

---

### Interface do Usuário

#### Na Cotação/Serviço:
1. Novo dropdown: **"Origem do Suporte"**
   - Empresa fornece (descontar do lucro)
   - Instalador compra (reembolsar)
   - Cliente já tem
   - Não aplicável

2. Campo condicional: **"Custo do Suporte"** (R$)

#### Nova Página: **Controle de Suportes** (no admin)
1. **Entregar suportes** → Registrar entrega para instalador
2. **Histórico** → Ver todas movimentações
3. **Saldo por instalador** → Quantos suportes cada um tem em mãos

---

### Fluxo Resumido

```text
┌─────────────────────────────────────────────────────────────────┐
│                        INSTALAÇÃO TV                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐ │
│  │ Empresa fornece │   │ Instalador compra│   │ Cliente tem  │ │
│  │    suporte      │   │    suporte       │   │   suporte    │ │
│  └────────┬────────┘   └────────┬─────────┘   └──────┬───────┘ │
│           │                     │                    │         │
│           ▼                     ▼                    ▼         │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐ │
│  │ - Registra uso  │   │ - Adiciona no    │   │ - Sem custo  │ │
│  │   do estoque    │   │   reembolso      │   │   de suporte │ │
│  │ - Custo fica    │   │ - Instalador     │   │              │ │
│  │   com empresa   │   │   recebe valor   │   │              │ │
│  └─────────────────┘   └──────────────────┘   └──────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Implementação em Etapas

**Etapa 1 - Banco de Dados:**
- Criar tabela `movimentacoes_suportes`
- Adicionar campos `origem_suporte` e `custo_suporte` em `cotacoes` e `servicos`
- Atualizar triggers de cálculo

**Etapa 2 - Interface Admin:**
- Adicionar campos no formulário de cotação
- Criar página "Controle de Suportes" em `/admin/suportes`
- Adicionar link no menu lateral

**Etapa 3 - Ajustar Cálculos:**
- Modificar trigger `criar_servico_ao_confirmar` para considerar origem do suporte
- Modificar trigger `atualizar_valor_ao_aceitar_servico` se necessário

---

### Benefícios

- ✅ Controle de quantos suportes cada instalador tem
- ✅ Registro de quando suporte foi usado em qual serviço
- ✅ Cálculo correto de comissões (suporte não entra na divisão)
- ✅ Flexibilidade para os 3 cenários de suporte
- ✅ Auditoria completa de movimentações
