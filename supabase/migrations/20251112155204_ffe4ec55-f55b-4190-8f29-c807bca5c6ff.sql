-- Remove a constraint antiga
ALTER TABLE cotacoes 
DROP CONSTRAINT IF EXISTS cotacoes_status_check;

-- Adiciona a nova constraint com todos os status incluindo 'confirmada'
ALTER TABLE cotacoes 
ADD CONSTRAINT cotacoes_status_check 
CHECK (status IN ('enviada', 'aguardando_resposta', 'confirmada', 'perdida', 'sem_resposta'));