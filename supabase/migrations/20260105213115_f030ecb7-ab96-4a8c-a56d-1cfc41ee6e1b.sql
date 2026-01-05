-- Criar tabela de indisponibilidades dos instaladores
CREATE TABLE public.indisponibilidades_instaladores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instalador_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  hora_inicio TIME, -- NULL = dia inteiro
  hora_fim TIME,    -- NULL = dia inteiro
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_indisponibilidades_instalador ON indisponibilidades_instaladores(instalador_id);
CREATE INDEX idx_indisponibilidades_datas ON indisponibilidades_instaladores(data_inicio, data_fim);

-- Enable RLS
ALTER TABLE public.indisponibilidades_instaladores ENABLE ROW LEVEL SECURITY;

-- Instalador pode ver suas próprias indisponibilidades
CREATE POLICY "Instaladores podem ver suas indisponibilidades"
ON public.indisponibilidades_instaladores
FOR SELECT
USING (instalador_id = auth.uid());

-- Instalador pode criar suas próprias indisponibilidades
CREATE POLICY "Instaladores podem criar suas indisponibilidades"
ON public.indisponibilidades_instaladores
FOR INSERT
WITH CHECK (instalador_id = auth.uid());

-- Instalador pode atualizar suas próprias indisponibilidades
CREATE POLICY "Instaladores podem atualizar suas indisponibilidades"
ON public.indisponibilidades_instaladores
FOR UPDATE
USING (instalador_id = auth.uid());

-- Instalador pode deletar suas próprias indisponibilidades
CREATE POLICY "Instaladores podem deletar suas indisponibilidades"
ON public.indisponibilidades_instaladores
FOR DELETE
USING (instalador_id = auth.uid());

-- Admin pode ver todas as indisponibilidades da empresa
CREATE POLICY "Admin pode ver indisponibilidades da empresa"
ON public.indisponibilidades_instaladores
FOR SELECT
USING (
  empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);