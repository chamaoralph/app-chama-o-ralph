

# Melhorar a Base de Conhecimento — Leitura em página dedicada

## Problema
Atualmente, ao clicar em "Ler Artigo", o conteúdo abre em um Dialog (modal pequeno) que é difícil de ler, sem diagramação adequada. O mesmo acontece com treinamentos.

## Solução
Criar uma **página dedicada de leitura** (`/instalador/conhecimento/:id`) que exibe o artigo em formato de página web completa, com boa tipografia e diagramação — como um blog post profissional.

## Mudanças

### 1. Nova página: `src/pages/instalador/ArtigoDetalhe.tsx`
- Página full-width dentro do `InstaladorLayout`
- Header com título grande, badge de categoria, tags e data
- Conteúdo com tipografia limpa: largura máxima de ~750px centralizada, espaçamento entre parágrafos, tamanho de fonte confortável (16-18px)
- Seções numeradas (1., 1.1, 1.2...) formatadas com headings visuais
- Botão "Voltar" no topo para retornar à base de conhecimento
- Se o conteúdo tiver quebras de linha, renderizar como parágrafos separados

### 2. Nova rota em `src/App.tsx`
- Adicionar rota: `conhecimento/artigo/:id` → `ArtigoDetalhe`
- Adicionar rota: `conhecimento/treinamento/:id` → `TreinamentoDetalhe` (ou mesma página com lógica condicional)

### 3. Nova página: `src/pages/instalador/TreinamentoDetalhe.tsx`
- Layout similar ao artigo: título, descrição, categoria
- Player de vídeo embed grande (aspect-ratio 16:9) centralizado
- Informações de duração abaixo

### 4. Alterar `BaseConhecimento.tsx`
- Remover os dois Dialogs (artigo e treinamento)
- Botão "Ler Artigo" → `navigate(/instalador/conhecimento/artigo/${artigo.id})`
- Botão "Assistir" → `navigate(/instalador/conhecimento/treinamento/${treinamento.id})`

## Visual do artigo (layout tipo blog)

```text
┌─────────────────────────────────────────┐
│  ← Voltar para Base de Conhecimento    │
│                                         │
│  [Instalação]                          │
│                                         │
│  Fundamentos da INSTALAÇÃO             │
│  DE TELEVISORES                        │
│  ─────────────────────────             │
│                                         │
│  1. INTRODUÇÃO E SEGURANÇA             │
│                                         │
│  1.1 Apresentação do Manual            │
│  Este manual foi desenvolvido para...  │
│                                         │
│  1.2 Objetivo e Escopo                 │
│  Este manual tem como objetivo...      │
│                                         │
│  [tag1] [tag2] [tag3]                  │
└─────────────────────────────────────────┘
```

- Fundo branco/card limpo, texto escuro
- Headings detectados automaticamente por padrões como "1.", "1.1", "2." no conteúdo
- Máximo 720px de largura para leitura confortável

## Arquivos envolvidos
- **Criar**: `src/pages/instalador/ArtigoDetalhe.tsx`
- **Criar**: `src/pages/instalador/TreinamentoDetalhe.tsx`
- **Editar**: `src/App.tsx` (2 novas rotas)
- **Editar**: `src/pages/instalador/BaseConhecimento.tsx` (remover modais, usar navigate)

Nenhuma migration necessária.

