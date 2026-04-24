# Múltiplas TVs na Cotação — Botão "+1 TV"

## Objetivo
Permitir que uma cotação tenha várias TVs. O admin clica "+ Adicionar outra TV" na calculadora, configura cada uma (tamanho, parede, cobertura) e os totais (mão de obra, material, suporte) são somados automaticamente. O fluxo do termo, aceite pelo cliente, PDF e aprovação automática passam a considerar todas as TVs.

## Mudanças

### 1. Banco (migration)
- `ALTER TABLE cotacoes ADD COLUMN tvs_itens jsonb` (nullable)
- `ALTER TABLE termos_aceite ADD COLUMN tvs_itens jsonb` (nullable)

Formato de cada item:
```json
{
  "tamanho": "40_55",
  "parede": "alvenaria",
  "cobertura": "total",
  "valor_mao_obra": 250,
  "valor_material": 20,
  "origem_suporte": "empresa",
  "custo_suporte": 80,
  "marca_modelo": "Samsung Q60",
  "polegadas": "55",
  "tipo": "QLED"
}
```

Colunas legadas (`tv_tamanho`, `tv_parede`, `tv_cobertura`, `tv_marca_modelo`, `tv_polegadas`, `tv_tipo`) continuam sendo preenchidas com o item **#1** para compatibilidade.

### 2. `src/components/admin/SelectorPrecoTV.tsx` (refatoração)
- Nova prop `items: TVItem[]` + `onItemsChange(items)`
- Nova prop `onTotaisChange({ totalMaoObra, totalMaterial, totalCustoSuporte, origemSuporte })` — para preencher os campos agregados do formulário
- Renderiza uma lista numerada de cards "TV 1", "TV 2"… cada um com os 3 selects + "Remover" (oculto no primeiro)
- Botão **"+ Adicionar outra TV"** no rodapé
- Cada item busca seu próprio preço via `buscarPrecoTV`
- Mostra rodapé com totais: "Mão de obra: R$X · Material: R$Y · Suporte: R$Z"
- Se qualquer item for ND, marca `indisponivel` globalmente

### 3. `src/pages/admin/cotacoes/Nova.tsx` e `Lista.tsx`
- Substituir `tvSelectores` / `tvSelectoresEdit` (objeto único) por `tvItens: TVItem[]`
- `handlePrecoCalculado` vira `handleTotaisCalculados(totais)` — preenche `valor_mao_obra/estimado`, `valor_material`, `origem_suporte`, `custo_suporte` com os totais
- No `insert`/`update` de `cotacoes`: gravar `tvs_itens: tvItens`, e manter `tv_tamanho/tv_parede/tv_cobertura` com o item[0]
- Ao abrir edição: se `cotacao.tvs_itens` existir, carregar; senão, construir array de 1 item a partir das colunas legadas

### 4. `src/components/admin/EnviarTermoModal.tsx`
- Receber `cotacao.tvs_itens` como prop
- Renderizar um bloco por TV com: Polegadas, Tipo (LED/QLED/OLED/The Frame/Outro), Marca/Modelo
- Um único par de valores Completa/Colaborativa agregados (calculados a partir da tabela para cada item e somados)
- Colaborativa só habilita se TODAS as TVs forem compatíveis (≤55", não OLED, não The Frame)
- Gravar em `termos_aceite.tvs_itens` o array completo com os dados preenchidos; manter colunas legadas (`tv_marca_modelo`, `tv_polegadas`, `tv_tipo`) com item[0]

### 5. `src/pages/AceiteTermo.tsx`
- Ler `termo.tvs_itens` (fallback: construir array de 1 com colunas legadas)
- Card "Equipamento" vira lista: "TV 1: Samsung 55 QLED · TV 2: LG 65 OLED"
- `colaborativaIndisponivel` agora valida o array inteiro (se qualquer TV for incompatível → indisponível e mostra motivo específico)

### 6. `src/lib/gerarTermoPDF.ts`
- Seção "2. EQUIPAMENTO" lista todas as TVs com numeração e detalhes por item
- Adicionar tipo `tvs_itens?: TVItem[]` em `TermoPDFData`

### 7. `supabase/functions/aprovar-cotacao-via-termo/index.ts`
- Se `cotacao.tvs_itens` existir: iterar, buscar preço de cada (com `novaCobertura`), somar totais e atualizar cotação
- Atualizar `tvs_itens` da cotação com a nova cobertura e valores recalculados
- Fallback atual (single TV) mantido para cotações antigas

## Detalhes técnicos
- Colaborativa: regra "todas precisam ser compatíveis" — se 1 for OLED/The Frame/>55", bloqueia
- Totais: `Σ valor_mao_obra`, `Σ valor_material`, `Σ custo_suporte`. `origem_suporte` usa o do item[0] (na prática todas terão a mesma origem por virem da mesma tabela)
- Compatibilidade: cotações antigas sem `tvs_itens` continuam funcionando — código faz fallback para colunas legadas
- Validação ao salvar: se qualquer item estiver ND, mostra erro e bloqueia

## Arquivos afetados
- **Novo**: migration SQL
- **Editados**: `SelectorPrecoTV.tsx`, `Nova.tsx`, `Lista.tsx`, `EnviarTermoModal.tsx`, `AceiteTermo.tsx`, `gerarTermoPDF.ts`, `termoTexto.ts` (helper para array), `aprovar-cotacao-via-termo/index.ts`
