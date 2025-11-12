-- Criar tabela de empresas
CREATE TABLE IF NOT EXISTS empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    telefone TEXT,
    email TEXT,
    plano TEXT DEFAULT 'pro' CHECK (plano IN ('trial', 'basic', 'pro', 'enterprise')),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver sua própria empresa
CREATE POLICY "Usuários podem ver sua própria empresa"
ON empresas
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid()
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_empresas_updated_at
BEFORE UPDATE ON empresas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Inserir empresa inicial
INSERT INTO empresas (nome, cnpj, telefone, email, plano)
VALUES ('Chama o Ralph Instalações', '50.445.911/0001-09', '11945672534', 'chamaoralph@gmail.com', 'pro');