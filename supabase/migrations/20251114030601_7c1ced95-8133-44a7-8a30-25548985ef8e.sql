-- Remover o índice parcial anterior que não funciona com ON CONFLICT
DROP INDEX IF EXISTS public.ux_lancamentos_unicos;

-- Criar constraint UNIQUE completa (funciona com ON CONFLICT)
ALTER TABLE public.lancamentos_caixa
ADD CONSTRAINT uq_lancamentos_servico_tipo_categoria 
UNIQUE (servico_id, tipo, categoria);