
## Objetivo

Quando a cotação tem mais de uma TV, o termo atualmente mostra apenas o valor total somado ("Completa R$ 409,00"). Vamos passar a mostrar o **valor de cada TV individualmente** e uma **soma total** abaixo, tanto no termo digital (tela do cliente) quanto no PDF gerado.

## Comportamento proposto

Com 1 TV: segue idêntico ao atual (um único valor).

Com 2+ TVs, cada card de modalidade exibe um breakdown:

```text
Completa
  TV 1 · 39" LED       R$ 189,00
  TV 2 · 65" LED       R$ 220,00
  ─────────────────────────────
  Total                R$ 409,00
```

O mesmo breakdown aparece no PDF na seção "3. Modalidade Contratada".

## Mudanças técnicas

### 1. `EnviarTermoModal.tsx` — guardar valores por TV

No pré-preenchimento (loop que já busca preços por item), além de somar o total, armazenar o valor por item. Ao montar `tvsParaSalvar`, incluir dois novos campos em cada item:

- `valor_completa_item: number | null`
- `valor_colaborativa_item: number | null`

Assim a estrutura `tvs_itens` persistida no `termos_aceite` passa a conter os valores individuais (`valor_completa` e `valor_colaborativa` no registro principal continuam sendo o total — compatível com tudo que já existe).

Se o admin editar manualmente o "Valor Completa (total)" após o pré-preenchimento, e os valores por item não baterem com o novo total, aplicamos um ajuste proporcional (rateio) ao salvar, para que a soma dos itens seja igual ao total informado. Isso mantém coerência visual sem exigir campo por item na UI.

### 2. `AceiteTermo.tsx` — exibir breakdown

Nos botões das modalidades Completa e Colaborativa, quando `tvsLista.length > 1` e houver `valor_*_item` nos itens, renderizar uma pequena tabela:

- Linha por TV: "TV N · {polegadas}" {tipo}" à esquerda, valor formatado à direita.
- Divisor.
- Linha "Total" em negrito com `formatarMoeda(termo.valor_*)`.

Fallback: se os itens não tiverem `valor_*_item` (termos antigos), mostra apenas o total como hoje.

### 3. `gerarTermoPDF.ts` — breakdown no PDF

Na seção "3. MODALIDADE CONTRATADA", após o título grande da modalidade e antes das "Coberturas":

- Se `tvs_itens.length > 1` e houver `valor_*_item`: listar uma linha por TV (rótulo + valor alinhado à direita), depois linha "Total: R$ X".
- Caso contrário: manter layout atual.

Atualizar `TermoPDFData.tvs_itens` para incluir os campos opcionais `valor_completa_item` e `valor_colaborativa_item`.

### 4. Edge Function `aprovar-cotacao-via-termo`

Nenhuma alteração necessária — ela já recalcula valor por item a partir da tabela `precos_instalacao_tv` usando a modalidade escolhida.

## Arquivos afetados

- `src/components/admin/EnviarTermoModal.tsx`
- `src/pages/AceiteTermo.tsx`
- `src/lib/gerarTermoPDF.ts`

Sem migrações de banco (os valores por item vivem dentro do JSON `tvs_itens` que já existe).
