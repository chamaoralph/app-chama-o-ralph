-- Vincula cada movimentação de suporte (entrega/devolução) ao modelo específico
-- do catálogo de acessórios (catalogo_servicos), permitindo dar baixa/repor no
-- estoque central real (estoque_lotes/estoque_saldo) em vez de um número solto.
-- Nullable: movimentações antigas (e as de tipo_movimento='uso' geradas
-- automaticamente na aprovação, que não sabem o modelo) ficam sem catalogo_id.
alter table public.movimentacoes_suportes
  add column if not exists catalogo_id uuid references public.catalogo_servicos(id);
