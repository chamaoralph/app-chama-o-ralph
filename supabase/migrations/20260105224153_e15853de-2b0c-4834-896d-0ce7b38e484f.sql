-- Criar tabela para armazenar recibos diários
CREATE TABLE public.recibos_diarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  instalador_id UUID NOT NULL REFERENCES usuarios(id),
  data_referencia DATE NOT NULL,
  valor_mao_obra NUMERIC NOT NULL DEFAULT 0,
  valor_reembolso NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  quantidade_servicos INTEGER NOT NULL DEFAULT 0,
  servicos_ids UUID[] NOT NULL,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recibos_diarios ENABLE ROW LEVEL SECURITY;

-- Instaladores podem ver seus próprios recibos
CREATE POLICY "Instaladores podem ver seus recibos"
ON public.recibos_diarios
FOR SELECT
USING (instalador_id = auth.uid());

-- Instaladores podem criar seus próprios recibos
CREATE POLICY "Instaladores podem criar seus recibos"
ON public.recibos_diarios
FOR INSERT
WITH CHECK (instalador_id = auth.uid());

-- Admins podem ver todos os recibos da empresa
CREATE POLICY "Admins podem ver recibos da empresa"
ON public.recibos_diarios
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (
    SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = auth.uid()
  )
);

-- Índices para performance
CREATE INDEX idx_recibos_instalador ON public.recibos_diarios(instalador_id);
CREATE INDEX idx_recibos_data ON public.recibos_diarios(data_referencia);
CREATE INDEX idx_recibos_empresa ON public.recibos_diarios(empresa_id);