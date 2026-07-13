-- Controle de itens de acessórios entregues a cada instalador (ex: antenas, suportes),
-- generalizando o padrão já usado em movimentacoes_suportes (que é específico de TV).

CREATE TABLE public.estoque_instalador_movimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  instalador_id UUID NOT NULL REFERENCES public.usuarios(id),
  catalogo_id UUID NOT NULL REFERENCES public.catalogo_servicos(id),
  quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  tipo_movimento TEXT NOT NULL CHECK (tipo_movimento IN ('entrega', 'devolucao', 'uso')),
  servico_id UUID REFERENCES public.servicos(id),
  data_movimento DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.estoque_instalador_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar estoque dos instaladores"
ON public.estoque_instalador_movimentos
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

CREATE POLICY "Instaladores podem ver seu proprio estoque"
ON public.estoque_instalador_movimentos
FOR SELECT
USING (instalador_id = auth.uid());
