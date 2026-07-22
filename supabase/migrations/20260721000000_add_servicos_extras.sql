-- =============================================================================
-- Migration: 20260721000000_add_servicos_extras.sql
-- Objetivo : Guardar os acessórios extras vendidos pelo instalador na
--            finalização do serviço (fora do que já estava no orçamento).
--
-- Formato de cada item do array (ExtraServicoItem em src/lib/orcamento.ts):
--   { catalogo_id, nome, valor_venda, valor_compra, fornecedor,
--     lucro, repasse_instalador, repasse_empresa }
--
-- IF NOT EXISTS porque parte do schema de estoque/acessórios foi criada
-- direto no Supabase (fora do controle de versão) — evita erro se a coluna
-- já existir.
-- =============================================================================

alter table public.servicos
  add column if not exists servicos_extras jsonb not null default '[]'::jsonb;
