-- =============================================================================
-- Migration: 20260728140000_add_suporte_garantia_total.sql
--
-- Suporte para o plano "Garantia Total" (cotacoes.tv_cobertura = 'total'):
-- na finalização do serviço, o instalador marca se usou um suporte fixo
-- universal da empresa. Se sim, o custo real (FIFO, via baixar_estoque_fifo)
-- é somado a custo_suporte (reembolso puro pra empresa, sem repasse 70/30) e
-- a UI de aprovação já recalcula valor_mao_obra_instalador automaticamente
-- (useEffect existente em Aprovacoes.tsx: valorTotalMaoObra = recebido -
-- reembolsos - ganhos), absorvendo o custo igualmente entre instalador e
-- empresa — ninguém lucra em cima dele.
--
-- usou_suporte_garantia_total: respondido pelo instalador na finalização.
-- estoque_suporte_garantia_baixado: trava pra a baixa real de estoque (via
-- baixar_estoque_fifo, chamada em Aprovacoes.tsx) acontecer no máximo uma vez
-- por serviço, mesmo que o admin desaprove e reaprove depois.
-- =============================================================================

alter table public.servicos
  add column if not exists usou_suporte_garantia_total boolean not null default false,
  add column if not exists estoque_suporte_garantia_baixado boolean not null default false;

-- baixar_estoque_fifo até agora só era chamada de dentro de outra function
-- (SECURITY DEFINER, no trigger de aprovação de cotação). Agora Aprovacoes.tsx
-- passa a chamá-la diretamente do client via supabase.rpc, então garante o
-- grant explícito pro role usado pelo PostgREST.
grant execute on function public.baixar_estoque_fifo(uuid, integer, uuid) to authenticated;
