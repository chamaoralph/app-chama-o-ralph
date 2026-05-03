
## Problema

A edge function `backup-storage` está dando timeout porque tenta listar **853 arquivos** e gerar URLs assinadas para todos em uma única requisição. Isso excede o tempo limite da edge function.

## Sobre migração de workspace

**Você NÃO perde nada ao transferir para outro workspace.** Todo o código, banco de dados, arquivos e configurações continuam intactos. Apenas o billing muda para o workspace de destino.

## Plano de correção do Backup

### 1. Refatorar a edge function `backup-storage`

Adicionar suporte a paginação por bucket:
- Aceitar parâmetros `bucket` (opcional) e `page` (default 1)
- Processar no maximo 50 arquivos por requisição
- Retornar flag `has_more` para o frontend saber se tem mais páginas
- Quando chamado sem parâmetro, retornar apenas o **resumo** (contagem e tamanho total), sem URLs

### 2. Atualizar o `BackupStorageCard.tsx`

- O botão "Gerar Lista" busca apenas o resumo (rápido)
- Ao expandir um bucket, carregar os arquivos sob demanda, paginados
- O botão "Baixar Tudo (ZIP)" itera bucket a bucket, página a página, baixando em lotes
- Exibir progresso mais granular: "Bucket X: arquivo Y de Z"

### Detalhes técnicos

**Edge function** recebe query params:
- `?summary=true` — retorna apenas contagens (sem signed URLs)
- `?bucket=fotos-servicos&page=1&per_page=50` — retorna arquivos paginados com URLs

**ZIP download** no frontend faz loop:
```
for each bucket:
  page = 1
  while has_more:
    fetch bucket page
    download files in batch
    add to zip
    page++
```

Isso resolve o timeout pois cada requisição processa no maximo 50 arquivos.
