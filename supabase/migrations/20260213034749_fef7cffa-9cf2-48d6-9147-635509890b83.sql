
-- Tabela de avaliações de clientes
CREATE TABLE public.avaliacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  servico_id UUID NOT NULL UNIQUE REFERENCES public.servicos(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  nota INTEGER CHECK (nota >= 1 AND nota <= 5),
  comentario TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'respondida', 'nao_avaliou')),
  publicada BOOLEAN NOT NULL DEFAULT false,
  enviado_em TIMESTAMPTZ,
  respondido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- Admins podem ler avaliações da empresa
CREATE POLICY "Admins podem ver avaliacoes da empresa"
ON public.avaliacoes FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

-- Admins podem atualizar (toggle publicada)
CREATE POLICY "Admins podem atualizar avaliacoes da empresa"
ON public.avaliacoes FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

-- Bloquear acesso anônimo
CREATE POLICY "Bloquear acesso anonimo avaliacoes"
ON public.avaliacoes FOR ALL
USING (false);

-- Trigger: criar avaliação quando serviço muda para aguardando_aprovacao
CREATE OR REPLACE FUNCTION public.criar_avaliacao_ao_finalizar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'aguardando_aprovacao' AND (OLD.status IS NULL OR OLD.status != 'aguardando_aprovacao') THEN
    INSERT INTO avaliacoes (servico_id, empresa_id, cliente_id, status)
    VALUES (NEW.id, NEW.empresa_id, NEW.cliente_id, 'pendente')
    ON CONFLICT (servico_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_criar_avaliacao_ao_finalizar
AFTER UPDATE ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.criar_avaliacao_ao_finalizar();

-- Índices
CREATE INDEX idx_avaliacoes_empresa_id ON public.avaliacoes(empresa_id);
CREATE INDEX idx_avaliacoes_status ON public.avaliacoes(status);
