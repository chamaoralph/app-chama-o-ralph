-- Adicionar coluna valor_unitario na tabela movimentacoes_suportes
ALTER TABLE public.movimentacoes_suportes
ADD COLUMN valor_unitario NUMERIC DEFAULT 0;

-- Comentário para documentação
COMMENT ON COLUMN public.movimentacoes_suportes.valor_unitario IS 'Valor unitário do suporte nesta entrega/movimentação';