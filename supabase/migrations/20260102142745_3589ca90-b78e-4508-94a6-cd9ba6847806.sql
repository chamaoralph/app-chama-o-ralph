-- Criar tabela tipos_servico
CREATE TABLE public.tipos_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tipos_servico ENABLE ROW LEVEL SECURITY;

-- Usuarios da empresa podem ver tipos de servico
CREATE POLICY "Usuarios podem ver tipos da empresa" ON public.tipos_servico
  FOR SELECT USING (empresa_id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid()
  ));

-- Admins podem gerenciar tipos
CREATE POLICY "Admins podem gerenciar tipos" ON public.tipos_servico
  FOR ALL USING (
    has_role(auth.uid(), 'admin') AND
    empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

-- Inserir dados iniciais para todas as empresas existentes
INSERT INTO public.tipos_servico (empresa_id, nome, ordem)
SELECT id, 'TV', 1 FROM empresas
UNION ALL
SELECT id, 'Fechadura', 2 FROM empresas
UNION ALL
SELECT id, 'Outros', 3 FROM empresas;