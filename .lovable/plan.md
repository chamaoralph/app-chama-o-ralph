

## Bloquear Recibo Apos Geracao

### Problema

O instalador pode gerar o mesmo recibo varias vezes, o que pode causar confusao e pagamentos duplicados.

### Solucao

Uma vez que o recibo e gerado/salvo no banco, bloquear a geracao de novos recibos para aquela data. Simples e direto.

---

### Mudancas Tecnicas

**Arquivo: `src/pages/instalador/MeuExtrato.tsx`**

1. **Adicionar estado para controlar recibos ja gerados**

```tsx
const [recibosGerados, setRecibosGerados] = useState<string[]>([]) // datas no formato 'yyyy-MM-dd'
```

2. **Carregar recibos ja gerados ao montar componente**

```tsx
async function carregarRecibosGerados() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data } = await supabase
    .from('recibos_diarios')
    .select('data_referencia')
    .eq('instalador_id', user.id)

  if (data) {
    setRecibosGerados(data.map(r => r.data_referencia))
  }
}
```

3. **Adicionar seletor de data com validacao**

```tsx
const [dataRecibo, setDataRecibo] = useState<Date>(new Date())

// Verificar se recibo ja foi gerado para data selecionada
const hojeStr = format(dataRecibo, 'yyyy-MM-dd')
const reciboJaGerado = recibosGerados.includes(hojeStr)
```

4. **Atualizar botao com bloqueio e feedback visual**

```tsx
<div className="flex items-center gap-2">
  <Input
    type="date"
    value={format(dataRecibo, 'yyyy-MM-dd')}
    onChange={(e) => setDataRecibo(new Date(e.target.value + 'T12:00:00'))}
    max={format(new Date(), 'yyyy-MM-dd')}
    min={format(subDays(new Date(), 7), 'yyyy-MM-dd')}
    className="w-[150px]"
  />
  <Button 
    onClick={() => setModalReciboOpen(true)}
    disabled={servicosDataSelecionada.length === 0 || reciboJaGerado}
  >
    <FileText className="h-4 w-4" />
    Gerar Recibo ({servicosDataSelecionada.length})
  </Button>
  {reciboJaGerado && (
    <span className="text-sm text-orange-600 font-medium">
      Recibo ja enviado
    </span>
  )}
</div>
```

5. **Atualizar lista apos gerar recibo no modal**

No `GerarReciboModal`, adicionar callback `onReciboGerado` que atualiza a lista de recibos gerados.

---

### Fluxo do Usuario

1. Instalador acessa "Meu Extrato"
2. Sistema carrega lista de datas que ja tem recibo
3. Por padrao, data vem com "hoje"
4. Se hoje ja tem recibo: botao desabilitado + "Recibo ja enviado"
5. Instalador pode mudar data para outro dia (ate 7 dias atras)
6. Se data selecionada ja tem recibo: bloqueado
7. Se data selecionada NAO tem recibo: pode gerar
8. Apos gerar, data entra na lista e fica bloqueada

### Beneficios

- Joao pode gerar recibo do dia 5 no dia 6 (se ainda nao gerou)
- Uma vez gerado, nao pode mais regerar
- Voce nao recebe recibos duplicados
- Simples de entender para o instalador

