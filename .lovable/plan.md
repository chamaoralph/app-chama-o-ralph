

# Filtro por Instalador na página de Serviços

## O que será feito

Adicionar um dropdown de filtro por instalador na página `/admin/servicos`. A lista `instaladores` já é carregada no componente, então basta adicionar o estado do filtro e aplicá-lo antes da ordenação.

## Alterações em `src/pages/admin/servicos/Lista.tsx`

1. **Novo estado**: `filtroInstalador` (string, default `"todos"`)
2. **Filtro visual**: Um `Select` com as opções "Todos", "Sem instalador" e cada instalador ativo, posicionado ao lado do título/header
3. **Lógica de filtragem**: Filtrar `servicos` antes da ordenação:
   - `"todos"` → sem filtro
   - `"sem_instalador"` → `instalador_id === null`
   - UUID específico → `instalador_id === filtroInstalador`
4. **Mobile**: Incluir o filtro também na versão mobile, acima dos cards de ordenação

