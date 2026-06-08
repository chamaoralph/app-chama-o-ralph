ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS itens_extras JSONB DEFAULT '[]'::jsonb;
