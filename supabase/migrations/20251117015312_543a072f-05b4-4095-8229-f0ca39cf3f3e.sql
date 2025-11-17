-- Tabela de questionários
CREATE TABLE public.questionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  titulo TEXT NOT NULL,
  tipo_conteudo TEXT NOT NULL CHECK (tipo_conteudo IN ('artigo', 'treinamento')),
  conteudo_id UUID NOT NULL,
  tipos_servico_liberados TEXT[] NOT NULL,
  nota_minima INTEGER DEFAULT 100,
  tentativas_maximas INTEGER DEFAULT NULL,
  tempo_limite_minutos INTEGER DEFAULT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_questionarios_empresa ON public.questionarios(empresa_id);
CREATE INDEX idx_questionarios_conteudo ON public.questionarios(tipo_conteudo, conteudo_id);

-- Tabela de perguntas
CREATE TABLE public.perguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionario_id UUID NOT NULL REFERENCES public.questionarios(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  enunciado TEXT NOT NULL,
  tipo TEXT DEFAULT 'multipla_escolha' CHECK (tipo IN ('multipla_escolha', 'verdadeiro_falso')),
  pontos INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_perguntas_questionario ON public.perguntas(questionario_id);

-- Tabela de alternativas
CREATE TABLE public.alternativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta_id UUID NOT NULL REFERENCES public.perguntas(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  correta BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_alternativas_pergunta ON public.alternativas(pergunta_id);

-- Tabela de tentativas
CREATE TABLE public.tentativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionario_id UUID NOT NULL REFERENCES public.questionarios(id),
  instalador_id UUID NOT NULL REFERENCES public.usuarios(id),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  nota_obtida NUMERIC(5,2) NOT NULL,
  total_perguntas INTEGER NOT NULL,
  acertos INTEGER NOT NULL,
  aprovado BOOLEAN NOT NULL,
  tempo_gasto_minutos INTEGER,
  iniciada_em TIMESTAMPTZ DEFAULT now(),
  finalizada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tentativas_instalador ON public.tentativas(instalador_id);
CREATE INDEX idx_tentativas_questionario ON public.tentativas(questionario_id);

-- Tabela de respostas por tentativa
CREATE TABLE public.respostas_tentativa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tentativa_id UUID NOT NULL REFERENCES public.tentativas(id) ON DELETE CASCADE,
  pergunta_id UUID NOT NULL REFERENCES public.perguntas(id),
  alternativa_escolhida_id UUID NOT NULL REFERENCES public.alternativas(id),
  correta BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_respostas_tentativa ON public.respostas_tentativa(tentativa_id);

-- Tabela de certificações
CREATE TABLE public.certificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instalador_id UUID NOT NULL REFERENCES public.usuarios(id),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  questionario_id UUID NOT NULL REFERENCES public.questionarios(id),
  tentativa_id UUID NOT NULL REFERENCES public.tentativas(id),
  tipos_servico_liberados TEXT[] NOT NULL,
  validade_ate DATE,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instalador_id, questionario_id)
);

CREATE INDEX idx_certificacoes_instalador ON public.certificacoes(instalador_id);
CREATE INDEX idx_certificacoes_tipos ON public.certificacoes USING GIN (tipos_servico_liberados);

-- Tabela de progresso de visualização
CREATE TABLE public.progresso_visualizacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instalador_id UUID NOT NULL REFERENCES public.usuarios(id),
  tipo_conteudo TEXT NOT NULL CHECK (tipo_conteudo IN ('artigo', 'treinamento')),
  conteudo_id UUID NOT NULL,
  visualizado_completo BOOLEAN DEFAULT false,
  tempo_visualizacao_segundos INTEGER DEFAULT 0,
  ultima_visualizacao TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instalador_id, tipo_conteudo, conteudo_id)
);

CREATE INDEX idx_progresso_instalador ON public.progresso_visualizacao(instalador_id);

-- RLS: Questionários
ALTER TABLE public.questionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar questionários" ON public.questionarios
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) AND 
    empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

CREATE POLICY "Instaladores veem questionários ativos" ON public.questionarios
  FOR SELECT USING (
    ativo = true AND
    empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

-- RLS: Perguntas
ALTER TABLE public.perguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem perguntas de questionários da empresa" ON public.perguntas
  FOR SELECT USING (
    questionario_id IN (
      SELECT id FROM questionarios 
      WHERE empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins gerenciam perguntas" ON public.perguntas
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    questionario_id IN (
      SELECT id FROM questionarios 
      WHERE empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- RLS: Alternativas
ALTER TABLE public.alternativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem alternativas" ON public.alternativas
  FOR SELECT USING (
    pergunta_id IN (
      SELECT p.id FROM perguntas p
      JOIN questionarios q ON q.id = p.questionario_id
      WHERE q.empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
    )
  );

CREATE POLICY "Admins gerenciam alternativas" ON public.alternativas
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    pergunta_id IN (
      SELECT p.id FROM perguntas p
      JOIN questionarios q ON q.id = p.questionario_id
      WHERE q.empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- RLS: Tentativas
ALTER TABLE public.tentativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instaladores veem suas tentativas" ON public.tentativas
  FOR SELECT USING (instalador_id = auth.uid());

CREATE POLICY "Instaladores criam suas tentativas" ON public.tentativas
  FOR INSERT WITH CHECK (instalador_id = auth.uid());

CREATE POLICY "Admins veem todas tentativas da empresa" ON public.tentativas
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

-- RLS: Respostas
ALTER TABLE public.respostas_tentativa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem respostas de suas tentativas" ON public.respostas_tentativa
  FOR SELECT USING (
    tentativa_id IN (SELECT id FROM tentativas WHERE instalador_id = auth.uid())
  );

CREATE POLICY "Usuários criam respostas em suas tentativas" ON public.respostas_tentativa
  FOR INSERT WITH CHECK (
    tentativa_id IN (SELECT id FROM tentativas WHERE instalador_id = auth.uid())
  );

-- RLS: Certificações
ALTER TABLE public.certificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instaladores veem suas certificações" ON public.certificacoes
  FOR SELECT USING (instalador_id = auth.uid());

CREATE POLICY "Sistema cria certificações" ON public.certificacoes
  FOR INSERT WITH CHECK (instalador_id = auth.uid());

CREATE POLICY "Admins veem todas certificações da empresa" ON public.certificacoes
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

-- RLS: Progresso
ALTER TABLE public.progresso_visualizacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instaladores gerenciam seu progresso" ON public.progresso_visualizacao
  FOR ALL USING (instalador_id = auth.uid());

CREATE POLICY "Admins veem progresso da empresa" ON public.progresso_visualizacao
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    instalador_id IN (
      SELECT id FROM usuarios 
      WHERE empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- Função para verificar certificação
CREATE OR REPLACE FUNCTION instalador_certificado_para_tipo(
  _instalador_id UUID,
  _tipos_servico TEXT[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM certificacoes c
    WHERE c.instalador_id = _instalador_id
      AND c.ativa = true
      AND (c.validade_ate IS NULL OR c.validade_ate > CURRENT_DATE)
      AND c.tipos_servico_liberados && _tipos_servico
  );
$$;

-- Trigger para criar certificação após aprovação
CREATE OR REPLACE FUNCTION criar_certificacao_apos_aprovacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  tipos_liberados TEXT[];
  empresa_id_instalador UUID;
BEGIN
  IF NEW.aprovado = true THEN
    SELECT tipos_servico_liberados, empresa_id
    INTO tipos_liberados, empresa_id_instalador
    FROM questionarios
    WHERE id = NEW.questionario_id;
    
    INSERT INTO certificacoes (
      instalador_id,
      empresa_id,
      questionario_id,
      tentativa_id,
      tipos_servico_liberados,
      ativa
    ) VALUES (
      NEW.instalador_id,
      empresa_id_instalador,
      NEW.questionario_id,
      NEW.id,
      tipos_liberados,
      true
    )
    ON CONFLICT (instalador_id, questionario_id) 
    DO UPDATE SET
      tentativa_id = NEW.id,
      tipos_servico_liberados = tipos_liberados,
      ativa = true,
      created_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_criar_certificacao
  AFTER INSERT ON tentativas
  FOR EACH ROW
  WHEN (NEW.aprovado = true)
  EXECUTE FUNCTION criar_certificacao_apos_aprovacao();

-- Trigger de updated_at
CREATE TRIGGER update_questionarios_updated_at 
  BEFORE UPDATE ON public.questionarios 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Modificar RLS dos serviços para verificar certificação
DROP POLICY IF EXISTS "Instaladores podem pegar serviços disponíveis" ON servicos;

CREATE POLICY "Instaladores podem pegar serviços disponíveis SE certificados" ON servicos
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'instalador'::app_role) AND
    status = 'disponivel' AND
    empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()) AND
    instalador_certificado_para_tipo(auth.uid(), tipo_servico) = true
  )
  WITH CHECK (
    instalador_id = auth.uid() AND status = 'atribuido'
  );