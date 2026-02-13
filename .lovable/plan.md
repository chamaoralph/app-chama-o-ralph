

# Fase 1 -- Estrutura de Avaliacoes + Disparo Automatico

Nesta fase vamos criar toda a infraestrutura de avaliacoes sem mexer na logica de aprovacao existente. Assim os servicos atuais continuam funcionando normalmente.

## O que sera feito agora

1. Criar a tabela `avaliacoes` no banco
2. Criar um trigger que gera a avaliacao automaticamente quando o instalador finaliza
3. Criar a Edge Function `disparar-avaliacao` (envia webhook pro n8n)
4. Criar a Edge Function `registrar-avaliacao` (recebe feedback do n8n)
5. Criar a pagina `/admin/avaliacoes` para o admin visualizar e gerenciar avaliacoes
6. Adicionar link "Avaliacoes" no menu do admin

## O que NAO sera alterado agora

- A pagina de Aprovacoes continua funcionando exatamente como esta
- O botao de aprovar continua liberado independente da avaliacao
- Nenhum fluxo existente e impactado

## Etapas

### 1. Migracao SQL

Criar tabela `avaliacoes`:
- `id`, `servico_id` (unique), `empresa_id`, `cliente_id`
- `nota` (1-5, nullable), `comentario`, `status` (pendente / respondida / nao_avaliou)
- `publicada` (boolean), `enviado_em`, `respondido_em`, `created_at`

RLS: somente admins da empresa podem ler. Sem permissao de escrita para usuarios normais (escrita via service role).

Trigger: quando `servicos.status` mudar para `aguardando_aprovacao`, inserir registro em `avaliacoes` com status `pendente`.

### 2. Edge Function `disparar-avaliacao`

- Recebe dados do servico (via pg_net ou chamada direta)
- Busca dados do cliente (nome, telefone) e instalador
- Envia POST pro webhook do n8n com todas as informacoes
- Protegida com HMAC usando `WEBHOOK_SECRET`
- Registrada no `config.toml` com `verify_jwt = false`

### 3. Edge Function `registrar-avaliacao`

- Endpoint para o n8n chamar quando o cliente responde ou quando expira o prazo de 12h
- Recebe: `avaliacao_id`, `nota` (1-5 opcional), `comentario` (opcional), `status`
- Valida input (nota entre 1-5, comentario max 1000 chars)
- Atualiza registro via service role
- Protegida com HMAC usando `WEBHOOK_SECRET`

### 4. Pagina `/admin/avaliacoes`

Pagina interna para o admin:
- Lista todas avaliacoes com filtros (pendentes, respondidas, nao avaliou, publicadas)
- Mostra: codigo do servico, cliente, instalador, nota, comentario, status
- Toggle para marcar como "publicada"
- Nota media geral e por instalador

### 5. Navegacao

- Adicionar rota no `App.tsx`
- Adicionar "Avaliacoes" no menu lateral (desktop e mobile)

## Arquivos

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Criar tabela + trigger + RLS |
| `supabase/functions/disparar-avaliacao/index.ts` | Criar |
| `supabase/functions/registrar-avaliacao/index.ts` | Criar |
| `supabase/config.toml` | Adicionar 2 functions |
| `src/pages/admin/Avaliacoes.tsx` | Criar |
| `src/App.tsx` | Adicionar rota |
| `src/components/layout/AdminLayout.tsx` | Adicionar link menu |
| `src/components/layout/MobileAdminLayout.tsx` | Adicionar link menu mobile |

## Proxima fase (depois de validar)

Alterar a pagina de Aprovacoes para mostrar o status da avaliacao e bloquear o botao "Aprovar" enquanto estiver pendente.

