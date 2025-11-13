-- Adicionar colunas para finalização de serviços
ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS fotos_conclusao TEXT[],
ADD COLUMN IF NOT EXISTS nota_fiscal_url TEXT,
ADD COLUMN IF NOT EXISTS valor_reembolso_despesas DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS observacoes_instalador TEXT;