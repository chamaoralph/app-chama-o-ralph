

# Tela de Follow-Up de Cotações Pendentes

## O que vai ser construído

Uma nova página `/admin/follow-up` dedicada ao acompanhamento de cotações pendentes, com registro de contatos feitos e atalho para envio de mensagem via WhatsApp.

## Alterações no banco de dados

### Nova tabela: `followup_contatos`
Registra cada tentativa de contato feita com o cliente:
- `id` (uuid, PK)
- `cotacao_id` (uuid, referencia cotacoes)
- `empresa_id` (uuid)
- `tipo_contato` (text) — "telefone", "whatsapp", "email"
- `observacoes` (text, nullable)
- `created_at` (timestamp, default now())
- `usuario_id` (uuid) — quem fez o contato

RLS: admins da empresa podem CRUD.

## Nova página: `src/pages/admin/FollowUp.tsx`

### Conteúdo da tabela
Para cada cotação pendente, exibir:
- Nome do cliente + telefone
- Tipo de serviço
- Data de criação da cotação (há quantos dias)
- Quantidade de contatos já feitos
- Data do último contato (ou "Nenhum contato")
- Botões de ação:
  - "Registrar Contato" — abre modal para anotar o tipo e observação
  - "WhatsApp" — abre `wa.me/{telefone}` com mensagem pré-formatada

### Filtros
- Ordenar por: mais antigos primeiro, sem contato, menos contatos
- Filtrar por: faixa de dias sem contato (ex: >7 dias, >15 dias, >30 dias)

### Cards de resumo no topo
- Total de pendentes
- Sem nenhum contato
- Último contato > 7 dias
- Média de dias pendente

## Navegação
- Adicionar link "📞 Follow-Up" no sidebar do admin (desktop e mobile)
- Adicionar rota `/admin/follow-up` no `App.tsx`

## Arquivos envolvidos
- Nova migration SQL (tabela `followup_contatos` + RLS)
- `src/pages/admin/FollowUp.tsx` (nova página)
- `src/App.tsx` (nova rota)
- `src/components/layout/AdminLayout.tsx` (link no sidebar)
- `src/components/layout/MobileAdminLayout.tsx` (link no menu mobile)

