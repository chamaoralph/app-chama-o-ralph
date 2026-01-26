
## Adicionar Edição de Movimentações de Suportes

### Situacao Atual
Voce tem 1 entrega registrada para o Joao:
- 6 suportes fixo universal
- Valor unitario: R$ 0,00 (vazio porque foi lancado antes do campo existir)

Atualmente a pagina de Suportes nao tem funcionalidade de edicao.

---

### Solucao

Adicionar um botao "Editar" na tabela de historico que abre um modal para alterar os dados da movimentacao.

---

### Mudancas Tecnicas

**Arquivo: `src/pages/admin/Suportes.tsx`**

1. **Adicionar estado para modal de edicao**
   - Estado para controlar abertura do modal
   - Estado para armazenar a movimentacao sendo editada
   - Estado para o formulario de edicao

2. **Criar funcao de atualizacao**
   - Funcao `atualizarMovimentacao` que faz UPDATE na tabela `movimentacoes_suportes`
   - Campos editaveis: quantidade, valor_unitario, observacoes

3. **Adicionar botao Editar na tabela**
   - Nova coluna "Acoes" no historico
   - Botao com icone de lapis para abrir o modal

4. **Criar componente Dialog de edicao**
   - Modal com os campos:
     - Quantidade (input number)
     - Valor Unitario (input number)
     - Observacoes (input text)
   - Botoes Salvar e Cancelar

---

### Interface do Modal

```
+------------------------------------------+
|  Editar Movimentacao                  X  |
+------------------------------------------+
|                                          |
|  Instalador: Joao Victor (somente leitura)
|  Tipo: Entrega (somente leitura)         |
|  Data: 26/01/2026 (somente leitura)      |
|                                          |
|  Quantidade *                            |
|  [    6    ]                             |
|                                          |
|  Valor Unitario (R$) *                   |
|  [   35.00  ]                            |
|                                          |
|  Observacoes                             |
|  [ 6 suportes fixo universal ]           |
|                                          |
|        [Cancelar]  [Salvar]              |
+------------------------------------------+
```

---

### Codigo Resumido

```tsx
// Estado do modal
const [editando, setEditando] = useState<Movimentacao | null>(null)
const [formEdit, setFormEdit] = useState({
  quantidade: '',
  valor_unitario: '',
  observacoes: ''
})

// Funcao de salvar
async function salvarEdicao() {
  await supabase
    .from('movimentacoes_suportes')
    .update({
      quantidade: parseInt(formEdit.quantidade),
      valor_unitario: parseFloat(formEdit.valor_unitario) || 0,
      observacoes: formEdit.observacoes || null
    })
    .eq('id', editando.id)
  
  fetchData()
  setEditando(null)
}
```

---

### Resultado

Apos a implementacao, voce podera:
1. Ir na aba "Historico"
2. Clicar no botao "Editar" na linha do Joao
3. Alterar o valor unitario para o valor correto (ex: R$ 35,00)
4. Salvar

O valor sera atualizado e estara disponivel para uso automatico nas cotacoes.
