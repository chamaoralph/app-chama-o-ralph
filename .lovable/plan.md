# Plano: Gerar Documentação Técnica Completa do Projeto

Vou gerar um arquivo Markdown extenso e detalhado (`DOCUMENTACAO_TECNICA.md`) salvo em `/mnt/documents/` para você baixar e compartilhar com o Claude. O arquivo seguirá EXATAMENTE a estrutura de 13 seções que você pediu.

## O que será incluído

### 1. Visão Geral
- Nome: **Chamao Ralph** (sistema de gestão para empresa de instalação de TVs e serviços técnicos)
- Objetivo, público (admins + instaladores), funcionalidades, URL de produção (`https://chamaoralph.lovable.app`)

### 2. Stack Técnica
- React 19 + Vite 5 + TypeScript 5.8 + Tailwind 3.4 + shadcn/ui (Radix)
- Supabase (Lovable Cloud) — auth, DB, storage, edge functions
- React Router 7, TanStack Query 5, React Hook Form + Zod
- jsPDF, html2canvas, JSZip, xlsx, recharts, date-fns, sonner
- Integrações: Google Ads (webhook + conversões offline), n8n WhatsApp, Lovable AI (se aplicável)
- Lista completa de dependências com versões extraída do `package.json`

### 3. Estrutura de Pastas
Árvore completa real (`src/components/{admin,auth,instalador,layout,ui}`, `src/pages/{admin,instalador}`, `src/hooks`, `src/lib`, `src/integrations/supabase`, `supabase/functions/*`, `supabase/migrations`) com explicação do papel de cada uma.

### 4. Modelo de Dados
Para CADA uma das 33 tabelas (alternativas, artigos, avaliacoes, certificacoes, clientes, clientes_rfm_cache, cliques_whatsapp, configuracoes_rfm, conversoes_offline, cotacoes, empresas, followup_contatos, google_ads_metrics, importacao_clientes_log, indisponibilidades_instaladores, instaladores, lancamentos_caixa, movimentacoes_suportes, perguntas, precos_instalacao_tv, progresso_visualizacao, questionarios, recibos_diarios, respostas_tentativa, servicos, telefones_bloqueados, tentativas, termos_aceite, tipos_servico, treinamentos, user_invitations, user_roles, usuarios):
- Colunas, tipos, NOT NULL, defaults, PK, FKs lógicas (multi-tenant via `empresa_id`)
- Relacionamentos (1:N empresa→tudo, 1:N cliente→cotacoes→servicos→avaliacoes etc.)
- Funções (22 functions: `has_role`, `calculate_rfm`, `criar_servico_ao_confirmar`, `sincronizar_servico_ao_editar_cotacao`, `registrar_no_caixa_ao_aprovar`, `criar_certificacao_apos_aprovacao`, `instalador_certificado_para_tipo`, `normalizar_telefone_br`, `criar_cotacao_whatsapp_atomic`, `import_clientes_csv`, `validate_signup_invitation`, `create_user_invitation`, `handle_delete_cotacao_cleanup`, `criar_despesa_ao_pagar_instalador`, `atualizar_valor_ao_aceitar_servico`, `criar_avaliacao_ao_finalizar`, `remover_lancamentos_ao_desaprovar`, etc.)
- Triggers (lista completa por tabela)

### 5. Autenticação e Autorização
- Supabase Auth (email/senha), signup gated por `user_invitations` (token)
- Roles: `admin` e `instalador` em tabela separada `user_roles` + enum `app_role`
- `AuthProvider` (`src/lib/auth.tsx`), `ProtectedRoute` com `requiredType`
- Verificação server-side via função `has_role(uuid, app_role)` security definer

### 6. RLS — todas as policies
Para cada tabela, cada policy com nome, comando, roles, USING, WITH CHECK e tradução em português. Padrão multi-tenant: `empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())`.

### 7. Fluxos e Regras de Negócio
- **Cotação WhatsApp**: webhook n8n → `criar-cotacao-whatsapp` (advisory lock anti-duplicação) → cotação `pendente`
- **Envio de termo**: admin gera termo → cliente acessa `/aceite/:token` → assina → `aprovar-cotacao-via-termo` aprova cotação e calcula preço pela cobertura escolhida
- **Aprovação cotação**: trigger `criar_servico_ao_confirmar` cria registro em `servicos` (status `disponivel` ou `aguardando_distribuicao`)
- **Self-assignment**: instalador certificado pega serviço `disponivel` (`instalador_certificado_para_tipo`) → `atribuido`
- **Finalização**: instalador upa fotos, marca recebimento do cliente → `aguardando_aprovacao` → admin aprova → `concluido` → trigger `registrar_no_caixa_ao_aprovar` cria receita; `criar_avaliacao_ao_finalizar` dispara avaliação WhatsApp
- **Recibos diários**: instalador agrupa serviços → admin paga → `criar_despesa_ao_pagar_instalador` lança despesa
- **Certificação**: instalador faz quiz (100% nota mínima) → trigger `criar_certificacao_apos_aprovacao` libera tipos de serviço
- **RFM Marketing**: `calculate_rfm` RPC (admin-only) atualiza `clientes_rfm_cache`
- **Importação CSV**: `import_clientes_csv` deduplica por telefone+nome
- **Alertas cliente, blocklist telefones, follow-up, conversões offline Google Ads**

### 8. Rotas e Páginas
Todas as rotas extraídas de `App.tsx`:
- Públicas: `/`, `/login`, `/signup`, `/instalar`, `/aceite/:token`
- `/admin/*` (15 rotas: dashboard, cotacoes, cotacoes/nova, servicos, servicos/:id, aprovacoes, caixa, despesas, instaladores, clientes, relatorios, marketing, follow-up, conteudo, suportes, questionarios, questionarios/:id/perguntas, certificacoes, configuracoes, avaliacoes)
- `/instalador/*` (11 rotas: dashboard, servicos-disponiveis, minha-agenda, finalizar-servico/:id, extrato, conhecimento, fazer-questionario/:id, resultado-questionario/:tentativaId, meus-certificados, conhecimento/artigo/:id, conhecimento/treinamento/:id)

### 9. Componentes Principais
Para cada componente em `src/components/{admin,instalador,auth,layout}`: localização, props, queries Supabase, hooks usados.

### 10. Services, Hooks e Utils
- `src/lib/auth.tsx` — AuthContext
- `src/lib/precosTV.ts`, `termoTexto.ts`, `gerarTermoPDF.ts`, `utils.ts`
- `src/hooks/use-mobile.tsx`, `use-toast.ts`
- Padrão: chamadas Supabase inline em cada page/component (não há camada `services/` separada)

### 11. Edge Functions
Para cada uma das 8 functions, descrição + trigger:
- `criar-cotacao-whatsapp` (HTTP, sem JWT, x-webhook-token)
- `aprovar-cotacao-via-termo` (HTTP)
- `google-ads-webhook` (HTTP, sem JWT)
- `disparar-avaliacao` (HTTP, sem JWT) e `registrar-avaliacao` (HTTP, sem JWT)
- `registrar-clique` (HTTP)
- `inserir-conversao-offline` (HTTP)
- `backup-storage` (HTTP, JSZip backups admin)

Incluirei o código essencial (assinatura, fluxo principal) — não vou colar 8 arquivos inteiros para não estourar o limite do arquivo, mas vou listar caminho exato para o Claude consultar.

### 12. Estado Atual
- O que está pronto (auth, multi-tenant, cotação→termo→serviço, agenda, recibos, certificações, RFM, integrações Ads/WhatsApp, backup)
- Limitações conhecidas (sem testes automatizados, sem camada de services dedicada, dependência de n8n externo)

### 13. Variáveis de Ambiente
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- Secrets de edge functions: `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_TOKEN` (n8n), tokens Google Ads, etc.

## Entrega

Ao aprovar, vou:
1. Executar um script Python que gera `/mnt/documents/DOCUMENTACAO_TECNICA.md` (estimado 40–80 KB)
2. Emitir uma `<lov-artifact>` para você baixar

O arquivo será autossuficiente — outro modelo poderá entender 100% do projeto só lendo ele.
