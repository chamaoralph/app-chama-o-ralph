-- Criar tabela de artigos
CREATE TABLE public.artigos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  publicado BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_artigos_empresa ON public.artigos(empresa_id);
CREATE INDEX idx_artigos_categoria ON public.artigos(categoria);
CREATE INDEX idx_artigos_publicado ON public.artigos(publicado);

-- Criar tabela de treinamentos
CREATE TABLE public.treinamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  video_url TEXT NOT NULL,
  categoria TEXT,
  duracao_minutos INTEGER,
  publicado BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_treinamentos_empresa ON public.treinamentos(empresa_id);
CREATE INDEX idx_treinamentos_categoria ON public.treinamentos(categoria);
CREATE INDEX idx_treinamentos_publicado ON public.treinamentos(publicado);

-- RLS Policies para artigos
ALTER TABLE public.artigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver artigos da empresa" ON public.artigos
  FOR SELECT USING (
    empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

CREATE POLICY "Admins podem gerenciar artigos" ON public.artigos
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) AND 
    empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

-- RLS Policies para treinamentos
ALTER TABLE public.treinamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver treinamentos da empresa" ON public.treinamentos
  FOR SELECT USING (
    empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

CREATE POLICY "Admins podem gerenciar treinamentos" ON public.treinamentos
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) AND 
    empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

-- Triggers para updated_at
CREATE TRIGGER update_artigos_updated_at 
  BEFORE UPDATE ON public.artigos 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_treinamentos_updated_at 
  BEFORE UPDATE ON public.treinamentos 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();