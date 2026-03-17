

# Seletor de Mes na tela de Marketing

## O que muda

Adicionar um dropdown/select de mes no card "Periodo de Analise" do `FunilConversaoContent.tsx`. Ao selecionar um mes, o sistema preenche automaticamente Data Inicio (dia 1) e Data Fim (ultimo dia do mes) e dispara a busca.

## Alteracoes

### `src/components/admin/FunilConversaoContent.tsx`

1. Importar `endOfMonth`, `startOfMonth`, `subMonths` de `date-fns`
2. Gerar lista dos ultimos 12 meses (label: "Janeiro 2026", "Fevereiro 2026", etc. em pt-BR)
3. Adicionar um `Select` (shadcn) antes dos date pickers com placeholder "Selecionar mes"
4. Ao selecionar um mes:
   - `setDataInicio(startOfMonth(mesSelecionado))`
   - `setDataFim(endOfMonth(mesSelecionado))`
   - Chamar `carregarDados()` automaticamente
5. Os date pickers continuam funcionando normalmente para quem quiser ajuste manual

Layout: Select de mes aparece como primeiro elemento na linha de filtros, seguido dos dois date pickers e do botao Atualizar.

