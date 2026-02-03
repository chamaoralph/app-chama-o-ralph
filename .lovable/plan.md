

## Correção: Recibo Baseado na Data de Conclusão

### Problema Identificado

O instalador finaliza um serviço agendado para **03/02** no dia **05/02**, mas o recibo:
- Agrupa por `data_servico_agendada` (03/02)
- O serviço **não aparece** no recibo do dia 05/02

Isso está errado porque o instalador precisa enviar o recibo do dia em que **finalizou** o trabalho no sistema, não do dia em que estava agendado.

---

### Solução

Adicionar um campo `data_conclusao` na tabela `servicos` que registra **quando o instalador finalizou o serviço no sistema**. O recibo passa a usar essa data.

---

### Mudancas Tecnicas

#### 1. Banco de Dados

Adicionar coluna na tabela `servicos`:

```sql
ALTER TABLE public.servicos
ADD COLUMN data_conclusao TIMESTAMPTZ;

COMMENT ON COLUMN public.servicos.data_conclusao 
IS 'Data/hora em que o instalador finalizou o servico no sistema';
```

#### 2. Finalizacao do Servico (`FinalizarServico.tsx`)

Ao atualizar o servico para `aguardando_aprovacao`, registrar a data atual:

```tsx
.update({
  status: "aguardando_aprovacao",
  fotos_conclusao: fotosPaths,
  data_conclusao: new Date().toISOString(),  // NOVO
  ...
})
```

#### 3. Extrato do Instalador (`MeuExtrato.tsx`)

Alterar a logica de filtragem dos servicos do dia:

**Antes:**
```tsx
const servicosHoje = servicos.filter(s => {
  const dataServico = new Date(s.data_servico_agendada)
  return isToday(dataServico) && s.status === 'concluido'
})
```

**Depois:**
```tsx
const servicosHoje = servicos.filter(s => {
  if (!s.data_conclusao) return false
  const dataConclusao = new Date(s.data_conclusao)
  return isToday(dataConclusao) && s.status === 'concluido'
})
```

#### 4. Consulta de Servicos

Adicionar `data_conclusao` na interface e na query:

```tsx
interface Servico {
  // ... campos existentes
  data_conclusao: string | null  // NOVO
}
```

---

### Fluxo Corrigido

```
Dia 03/02 - Servico agendado
            Instalador vai ao local
            Faz o trabalho

Dia 05/02 - Instalador abre o app
            Sobe as fotos
            Clica "Finalizar"
            → Sistema registra data_conclusao = 05/02 19:30:00

Dia 05/02 - Instalador abre "Meu Extrato"
            Clica "Gerar Recibo do Dia"
            → Servico aparece no recibo do dia 05/02 ✓
```

---

### Campos de Data na Tabela Servicos

Apos a mudanca, a tabela tera:

| Campo | Significado |
|-------|-------------|
| `created_at` | Quando o servico foi criado no sistema |
| `data_servico_agendada` | Dia/hora combinado com cliente (03/02) |
| `data_conclusao` | Quando o instalador finalizou no app (05/02) |
| `updated_at` | Ultima alteracao (qualquer campo) |

---

### Vantagens

- Recibo reflete a data real de trabalho concluido no sistema
- Historico preciso para controle financeiro
- Instalador pode finalizar servicos atrasados sem problemas
- Admin ve quando realmente foi concluido vs quando estava agendado

