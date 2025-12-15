-- Adicionar campos de faixa de horário na tabela cotacoes
ALTER TABLE public.cotacoes
ADD COLUMN horario_inicio TIME,
ADD COLUMN horario_fim TIME;

-- Comentário para documentar os campos
COMMENT ON COLUMN public.cotacoes.horario_inicio IS 'Horário inicial da disponibilidade do cliente';
COMMENT ON COLUMN public.cotacoes.horario_fim IS 'Horário final da disponibilidade do cliente';