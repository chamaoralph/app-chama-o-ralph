-- Adicionar coluna data_conclusao para registrar quando o instalador finalizou o serviço no sistema
ALTER TABLE public.servicos
ADD COLUMN data_conclusao TIMESTAMPTZ;

COMMENT ON COLUMN public.servicos.data_conclusao 
IS 'Data/hora em que o instalador finalizou o servico no sistema (quando subiu as fotos e clicou finalizar)';