-- Criar tabela de usuários
CREATE TABLE public.usuarios (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('admin', 'instalador')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar tabela de instaladores
CREATE TABLE public.instaladores (
  id UUID NOT NULL PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  pontos_gamificacao INTEGER NOT NULL DEFAULT 0,
  nivel INTEGER NOT NULL DEFAULT 1,
  saldo_a_receber DECIMAL(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instaladores ENABLE ROW LEVEL SECURITY;

-- Políticas para usuários: podem ver e editar seu próprio perfil
CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.usuarios
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.usuarios
  FOR UPDATE
  USING (auth.uid() = id);

-- Políticas para instaladores: podem ver e editar seus próprios dados
CREATE POLICY "Instaladores podem ver seus próprios dados"
  ON public.instaladores
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Instaladores podem atualizar seus próprios dados"
  ON public.instaladores
  FOR UPDATE
  USING (auth.uid() = id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_usuarios_updated_at
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instaladores_updated_at
  BEFORE UPDATE ON public.instaladores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_usuarios_empresa_id ON public.usuarios(empresa_id);
CREATE INDEX idx_usuarios_tipo ON public.usuarios(tipo);
CREATE INDEX idx_instaladores_empresa_id ON public.instaladores(empresa_id);