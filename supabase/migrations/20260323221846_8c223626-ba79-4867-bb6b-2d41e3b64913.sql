
ALTER TABLE public.servicos 
ADD COLUMN valor_recebido_cliente numeric DEFAULT 0,
ADD COLUMN recebimento_cliente text;

ALTER TABLE public.recibos_diarios 
ADD COLUMN valor_recebido_cliente numeric DEFAULT 0;
