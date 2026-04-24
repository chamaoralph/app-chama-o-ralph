

# Tabela de Preços de Instalação de TV — Cotações Inteligentes

## Objetivo
Transformar a criação de cotações de "Instalação de TV" num fluxo guiado por seleções (Tamanho da TV → Tipo de parede → Cobertura). O sistema calcula automaticamente Mão de Obra + Material (parafusos) + Suporte. A tabela de preços fica editável em **Configurações**, então qualquer ajuste futuro reflete em todas as próximas cotações.

## Como funciona

### 1. Nova aba em Configurações: "Tabela de Preços TV"
Uma tabela editável (igual à imagem que você enviou) com:

- **Linhas** = Tamanho da TV (até 39", 40-55", 58-65", 70-75", 85")
- **Colunas** = Tipo de parede (Painel de madeira, Alvenaria, Drywall, Teto)
- **Para cada combinação**, 4 valores editáveis:
  - Mão de obra — Cobertura Parcial (ou ND)
  - Mão de obra — Cobertura Total (ou ND)
  - Parafusos (R$ ou em branco)
  - Suporte (R$, "Incluso" ou "Não fornecemos")

Cada célula é um input. Clica, muda o valor, salva. Pronto — vale para as próximas cotações.

### 2. Nova Cotação (e Editar Cotação) — Modo "Instalação de TV"
Quando o tipo de serviço selecionado for **"Instalação de TV"**, aparecem 3 selects extras:

1. **Tamanho da TV** → até 39" / 40-55" / 58-65" / 70-75" / 85"
2. **Tipo de parede** → Painel de madeira / Alvenaria / Drywall / Teto
3. **Cobertura** → Parcial / Total

Conforme você seleciona, o sistema:
- Busca a célula correspondente na tabela de preços
- Auto-preenche **Valor Mão de Obra**
- Auto-preenche **Valor Material** (parafusos, se houver)
- Define **origem do suporte** + **custo do suporte** automaticamente:
  - "Incluso" → empresa fornece, custo = R$ 0
  - Valor numérico (ex: R$ 79) → empresa fornece, custo = R$ 79
  - "Não fornecemos" → instalador fornece (você digita o valor depois)
- Mostra um aviso se a combinação for **ND** (não disponível) e bloqueia o salvamento

Os campos de valor continuam editáveis caso queira ajustar manualmente.

Otimizado para **mobile** (selects grandes, fluxo vertical) — você consegue criar uma cotação completa na rua em poucos toques.

### 3. Onde os valores ficam guardados
Tabela nova `precos_instalacao_tv` no banco, com uma linha por combinação (tamanho × parede × cobertura), contendo: valor de mão de obra, valor de parafusos, valor do suporte e indicador de suporte ("incluso" / "valor" / "nao_fornecemos" / "nd"). Cada empresa tem sua própria tabela (RLS por `empresa_id`). Migration inicial popula com os valores exatos da imagem que você enviou.

## Mudanças

### Banco de dados (1 migration)
- Criar tabela `precos_instalacao_tv` (empresa_id, tamanho_tv, tipo_parede, cobertura, valor_mao_obra, valor_parafusos, valor_suporte, tipo_suporte)
- RLS: admins gerenciam tudo da empresa; usuários da empresa podem ler
- Seed automático com a tabela da imagem para a empresa atual

### `src/pages/admin/Configuracoes.tsx`
- Adicionar Tabs no topo (Geral / Tabela de Preços TV)
- Novo componente `TabelaPrecosTVCard` com a grade editável (inputs por célula, salva on blur)

### `src/pages/admin/cotacoes/Nova.tsx`
- Detectar quando tipo de serviço = "Instalação de TV"
- Mostrar 3 selects (Tamanho / Parede / Cobertura)
- Buscar preço da tabela e auto-preencher Mão de Obra, Material, origem_suporte e custo_suporte
- Aviso visual quando combinação for ND

### `src/pages/admin/cotacoes/Lista.tsx` (modal de edição)
- Mesma lógica: ao editar uma cotação de "Instalação de TV", mostrar os 3 selects e permitir recalcular

## Detalhes técnicos
- Os 3 selects só aparecem se o tipo de serviço cadastrado tiver nome contendo "Instalação de TV" (case-insensitive)
- Os valores auto-preenchidos sobrescrevem o que estiver nos campos, mas você pode editar depois
- "ND" → mostra alerta vermelho e desabilita o botão Salvar
- Suporte "Incluso" salva `origem_suporte='empresa'` e `custo_suporte=0`
- Suporte com valor (R$ 79, R$ 450) salva `origem_suporte='empresa'` e `custo_suporte=valor`
- "Não fornecemos" salva `origem_suporte='instalador'` (você define o valor)
- Sem mudança no fluxo de cotações que **não** sejam de TV — continua exatamente igual

