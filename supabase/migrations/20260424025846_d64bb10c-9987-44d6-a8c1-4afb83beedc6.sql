CREATE TABLE public.termos_aceite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cotacao_id UUID NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  cliente_cpf TEXT,
  cliente_endereco TEXT,
  
  tv_marca_modelo TEXT,
  tv_polegadas TEXT,
  tv_tipo TEXT,
  
  valor_completa NUMERIC(10,2),
  valor_colaborativa NUMERIC(10,2),
  modalidade_escolhida TEXT,
  
  nome_aceite TEXT,
  cpf_aceite TEXT,
  assinatura_base64 TEXT,
  aceite_user_agent TEXT,
  aceite_data_hora TIMESTAMPTZ,
  
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  visualizado_em TIMESTAMPTZ,
  aceito_em TIMESTAMPTZ,
  pdf_url TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_termos_aceite_token ON public.termos_aceite(token);
CREATE INDEX idx_termos_aceite_cotacao ON public.termos_aceite(cotacao_id);
CREATE INDEX idx_termos_aceite_empresa ON public.termos_aceite(empresa_id);

ALTER TABLE public.termos_aceite ENABLE ROW LEVEL SECURITY;

-- Admin da empresa pode tudo
CREATE POLICY "Admins gerenciam termos da empresa"
ON public.termos_aceite
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_empresa_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_empresa_id(auth.uid()));

-- Anon pode ler (necessário para o cliente acessar o termo via link)
CREATE POLICY "Anon pode ler termos via token"
ON public.termos_aceite
FOR SELECT
TO anon
USING (true);

-- Anon pode atualizar (para registrar aceite/assinatura)
CREATE POLICY "Anon pode atualizar termos via token"
ON public.termos_aceite
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Bloquear insert/delete para anon
CREATE POLICY "Bloquear insert anon termos"
ON public.termos_aceite
AS RESTRICTIVE
FOR INSERT
TO anon
WITH CHECK (false);

CREATE POLICY "Bloquear delete anon termos"
ON public.termos_aceite
AS RESTRICTIVE
FOR DELETE
TO anon
USING (false);

-- Trigger para updated_at
CREATE TRIGGER update_termos_aceite_updated_at
BEFORE UPDATE ON public.termos_aceite
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();