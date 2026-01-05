-- Adicionar 'aguardando_aprovacao' ao constraint de status
ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_status_check;

ALTER TABLE public.servicos ADD CONSTRAINT servicos_status_check 
CHECK (status IN ('disponivel', 'solicitado', 'atribuido', 'em_andamento', 'concluido', 'cancelado', 'aguardando_distribuicao', 'aguardando_aprovacao'));