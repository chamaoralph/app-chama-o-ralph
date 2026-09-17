-- Campo para controlar envio de upsell pós-avaliação positiva (fila-upsell)
ALTER TABLE public.avaliacoes
  ADD COLUMN upsell_enviado_em TIMESTAMPTZ NULL;
