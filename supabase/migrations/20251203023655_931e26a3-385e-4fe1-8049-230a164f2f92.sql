-- Remover constraint antiga
ALTER TABLE public.cotacoes DROP CONSTRAINT IF EXISTS cotacoes_status_check;

-- Adicionar constraint atualizada com todos os status necessários
ALTER TABLE public.cotacoes ADD CONSTRAINT cotacoes_status_check
CHECK (status IN (
  'pendente',
  'enviada',
  'aguardando_resposta',
  'confirmada',
  'perdida',
  'sem_resposta',
  'aprovada',
  'reprovada',
  'nao_gerou'
));