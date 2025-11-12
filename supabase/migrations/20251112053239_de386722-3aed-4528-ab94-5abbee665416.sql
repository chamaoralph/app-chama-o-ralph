-- Criar tabela de clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  idade INTEGER,
  endereco_completo TEXT,
  cep TEXT,
  bairro TEXT,
  origem_lead TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(empresa_id, telefone)
);

-- Criar tabela de cotações
CREATE TABLE IF NOT EXISTS public.cotacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  data_servico_desejada DATE,
  tipo_servico TEXT[],
  descricao_servico TEXT,
  valor_estimado NUMERIC(10,2),
  origem_lead TEXT,
  ocasiao TEXT,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'enviada' CHECK (status IN ('enviada', 'em_analise', 'aprovada', 'recusada', 'cancelada')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes ENABLE ROW LEVEL SECURITY;

-- Políticas para clientes
CREATE POLICY "Usuários podem ver clientes da sua empresa"
ON public.clientes
FOR SELECT
TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
  )
);

CREATE POLICY "Usuários podem criar clientes na sua empresa"
ON public.clientes
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id IN (
    SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
  )
);

CREATE POLICY "Usuários podem atualizar clientes da sua empresa"
ON public.clientes
FOR UPDATE
TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
  )
);

-- Políticas para cotações
CREATE POLICY "Usuários podem ver cotações da sua empresa"
ON public.cotacoes
FOR SELECT
TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
  )
);

CREATE POLICY "Usuários podem criar cotações na sua empresa"
ON public.cotacoes
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id IN (
    SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
  )
);

CREATE POLICY "Usuários podem atualizar cotações da sua empresa"
ON public.cotacoes
FOR UPDATE
TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cotacoes_updated_at
BEFORE UPDATE ON public.cotacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
