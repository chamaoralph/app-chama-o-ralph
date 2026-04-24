## Objetivo

Permitir que o admin aplique um desconto ao enviar o termo, com exibição clara de **Subtotal → Desconto → Total** tanto na tela de aceite do cliente quanto no PDF gerado.

Hoje o admin até consegue editar o valor total manualmente, mas:
- Não fica registrado que houve desconto (cliente não vê a diferença).
- O rateio proporcional "esconde" o desconto nos valores individuais por TV.

## Como vai funcionar

No modal **"Enviar Termo de Aceite"**:

1. Abaixo dos campos "Valor Completa" e "Valor Colaborativa" (que passam a ser rotulados como **Subtotal**, calculados automaticamente a partir da tabela de preços — somatório dos itens), adicionar dois novos campos opcionais:
   - **Desconto Completa (R$)**
   - **Desconto Colaborativa (R$)**
2. Mostrar em tempo real o **Total Final** de cada modalidade (Subtotal − Desconto), em destaque.
3. Validações:
   - Desconto não pode ser maior que o subtotal.
   - Desconto não pode ser negativo.
   - Se o admin preferir continuar editando o total direto (como hoje), o desconto fica 0 e o comportamento atual se mantém.

Os valores individuais por TV **permanecem os do catálogo** (subtotais originais, sem rateio), e o desconto aparece como uma **linha separada** no detalhamento.

## Exibição para o cliente (AceiteTermo)

Quando houver desconto, o card da modalidade passa a mostrar:

```text
TV 1 · 55" LED Samsung ............. R$ 250,00
TV 2 · 65" OLED LG ................. R$ 320,00
─────────────────────────────────────────────
Subtotal ........................... R$ 570,00
Desconto ........................  − R$  70,00
Total a pagar ...................... R$ 500,00
```

Se não houver desconto, mantém o layout atual (só Total).

## Exibição no PDF (gerarTermoPDF)

A seção "3. MODALIDADE CONTRATADA" passa a incluir, quando aplicável:
- Detalhamento por equipamento (subtotais já existentes).
- Linha **Subtotal**.
- Linha **Desconto aplicado**.
- Linha **Total final** (em negrito).

## Mudanças técnicas

### Banco (migration)
Adicionar duas colunas em `termos_aceite`:
- `desconto_completa numeric default 0`
- `desconto_colaborativa numeric default 0`

(Os campos existentes `valor_completa` / `valor_colaborativa` passam a representar o **total final** cobrado — o subtotal é derivado da soma dos `valor_*_item` em `tvs_itens`. Isso mantém compatibilidade com termos já enviados.)

### Código
- `src/components/admin/EnviarTermoModal.tsx`
  - Novos estados `descontoCompleta` / `descontoColaborativa`.
  - Remover rateio pro-rata nos itens — manter os valores originais do catálogo em `valor_completa_item` / `valor_colaborativa_item`.
  - Salvar `valor_completa = subtotal − desconto` e `desconto_completa` (idem para colaborativa).
  - UI com resumo "Subtotal / Desconto / Total".
- `src/pages/AceiteTermo.tsx`
  - Ler `desconto_completa` / `desconto_colaborativa`.
  - Renderizar linhas Subtotal, Desconto e Total no card de cada modalidade quando houver desconto.
- `src/lib/gerarTermoPDF.ts`
  - Incluir linhas de Subtotal, Desconto e Total final na seção de modalidade contratada quando houver desconto.

## Fora do escopo
- Desconto percentual (só valor em R$ nesta versão).
- Desconto por item individual (só por modalidade, no total).
