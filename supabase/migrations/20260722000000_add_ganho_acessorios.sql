-- =============================================================================
-- Migration: 20260722000000_add_ganho_acessorios.sql
-- Objetivo : Separar o LUCRO dos acessórios extras (ganho) do REEMBOLSO (custo).
--            Antes, o repasse inteiro de cada extra ia para
--            valor_reembolso_despesas / custo_suporte, misturando custo real
--            com lucro. Agora o lucro (fatia 70/30) vai para colunas próprias.
--
-- valor_reembolso_despesas / custo_suporte continuam existindo e passam a
-- guardar só a parte de CUSTO dos extras (mais reembolsos de despesas reais,
-- como antes). ganho_acessorios_* guarda só a parte de LUCRO.
--
-- default 0 (não jsonb, é numeric simples) — serviços antigos ficam com 0,
-- preservando o cálculo de mão de obra existente (retrocompatível).
-- =============================================================================

alter table public.servicos
  add column if not exists ganho_acessorios_instalador numeric not null default 0;

alter table public.servicos
  add column if not exists ganho_acessorios_empresa numeric not null default 0;
