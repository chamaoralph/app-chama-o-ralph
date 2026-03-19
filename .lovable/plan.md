

# Filtro de Origem de Lead no Funil de Conversão

## Problema
Atualmente o funil filtra apenas cotações com `origem_lead` contendo "Google". O admin quer ver o funil para qualquer origem (Google, Indicação, etc.) ou para todas as origens combinadas.

## Solução
Adicionar um dropdown "Origem" ao lado do filtro de mês, com as opções dinâmicas baseadas nos valores reais do campo `origem_lead` da tabela `cotacoes`, mais a opção "Todos".

## Alterações

### `src/components/admin/FunilConversaoContent.tsx`

1. **Novo state**: `origemFiltro` (default: `"todos"`)
2. **Dropdown na área de filtros**: Select com opções fixas: `Todos`, `Google`, `Indicação`, `Instagram`, `Já era cliente`, `Importação`, `WhatsApp Auto`
3. **Lógica de query ajustada**:
   - Quando `origemFiltro === "todos"`: remover o `.ilike("origem_lead", "%google%")` da query de cotações (buscar todas)
   - Quando uma origem específica é selecionada: aplicar `.ilike("origem_lead", "%valor%")`
4. **KPIs de investimento**: Manter sempre vinculados ao Google Ads (despesas de marketing), pois investimento é específico do Google. Quando o filtro for "Indicação" ou outra origem orgânica, os KPIs de investimento/ROAS/CPL ficam zerados ou com label indicando "N/A" — ou melhor, mostrar investimento normalmente mas deixar claro que os leads são de outra fonte
5. **Título do funil visual**: Mudar de "Funil de Conversão - Google Ads" para refletir a origem selecionada (ex: "Funil de Conversão - Todos", "Funil de Conversão - Indicação")

### Comportamento
- **"Todos"**: puxa todas as cotações do período, independente de origem. Investimento continua sendo o de marketing/Google. KPIs como CPL e ROAS refletem o total
- **"Google"**: comportamento atual (apenas cotações com origem Google)
- **"Indicação"**, etc.: filtra pela origem específica. Investimento se mantém do Google Ads para comparação cruzada

### Nenhuma migration necessária
Apenas alteração de frontend no componente `FunilConversaoContent.tsx`.

