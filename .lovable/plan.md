

# Aba "Desempenho Mensal" na página Instaladores

## O que será feito

Adicionar uma nova aba **"Desempenho"** na página de Gestão de Instaladores (`/admin/instaladores`), ao lado das abas Lista, Pagamentos e Convites.

Essa aba mostrará, para o mês selecionado:
- Uma tabela com cada instalador, quantidade de serviços concluidos, e receita total gerada (valor_total dos servicos)
- Seletor de mês/ano para navegar entre meses
- Totais gerais no rodape da tabela
- Cards de resumo no topo (total de servicos do mes, receita total, media por instalador)

## Dados utilizados

Consulta na tabela `servicos` filtrando por:
- `status = 'concluido'`
- `data_servico_agendada` dentro do mes selecionado
- `empresa_id` do usuario logado
- Agrupado por `instalador_id`, com JOIN na tabela `usuarios` para pegar o nome

Colunas exibidas:
| Instalador | Servicos Concluidos | Receita Gerada (valor_total) | Mao de Obra (valor_mao_obra_instalador) |
|---|---|---|---|

## Arquivo alterado

- `src/pages/admin/Instaladores.tsx` — adicionar a aba "Desempenho" com o componente inline ou extraido

## Detalhes tecnicos

- Reutilizar o layout de Tabs existente (grid-cols-3 vira grid-cols-4)
- Seletor de mes usando inputs nativos ou botoes prev/next
- Query unica com `.eq('status', 'concluido')` e filtro por range de datas do mes
- Nenhuma migration necessaria — dados ja existem

