-- Criar tabela de lançamentos de caixa
CREATE TABLE IF NOT EXISTS lancamentos_caixa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id),
    servico_id UUID REFERENCES servicos(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    categoria TEXT NOT NULL,
    descricao TEXT,
    valor DECIMAL(10,2) NOT NULL,
    data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
    forma_pagamento TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar Row Level Security
ALTER TABLE lancamentos_caixa ENABLE ROW LEVEL SECURITY;

-- Política para admins visualizarem lançamentos da empresa
CREATE POLICY "Admins podem ver lançamentos da empresa"
ON lancamentos_caixa
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid()
  )
);

-- Política para admins criarem lançamentos
CREATE POLICY "Admins podem criar lançamentos"
ON lancamentos_caixa
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid()
  )
);

-- Política para admins atualizarem lançamentos
CREATE POLICY "Admins podem atualizar lançamentos da empresa"
ON lancamentos_caixa
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid()
  )
);

-- Política para admins deletarem lançamentos
CREATE POLICY "Admins podem deletar lançamentos da empresa"
ON lancamentos_caixa
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid()
  )
);

-- Criar índices para performance
CREATE INDEX idx_lancamentos_empresa ON lancamentos_caixa(empresa_id);
CREATE INDEX idx_lancamentos_data ON lancamentos_caixa(data_lancamento);