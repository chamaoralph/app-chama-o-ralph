-- 1. Remover constraint antiga de cotacoes se existir e criar nova
ALTER TABLE public.cotacoes DROP CONSTRAINT IF EXISTS cotacoes_status_check;

-- Criar nova constraint para cotações (sem 'enviada', sem 'confirmada')
ALTER TABLE public.cotacoes ADD CONSTRAINT cotacoes_status_check 
  CHECK (status IN ('pendente', 'aprovada', 'perdida', 'sem_resposta', 'nao_gerou'));

-- Atualizar cotações com status 'enviada' para 'pendente'
UPDATE public.cotacoes SET status = 'pendente' WHERE status = 'enviada';

-- Atualizar cotações com status 'confirmada' para 'aprovada'
UPDATE public.cotacoes SET status = 'aprovada' WHERE status = 'confirmada';

-- 2. Remover constraint antiga de servicos se existir e criar nova com 'solicitado'
ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_status_check;

-- Criar nova constraint para serviços (incluindo 'solicitado')
ALTER TABLE public.servicos ADD CONSTRAINT servicos_status_check 
  CHECK (status IN ('disponivel', 'solicitado', 'atribuido', 'em_andamento', 'concluido', 'cancelado', 'aguardando_distribuicao'));

-- 3. Adicionar RLS para instaladores poderem solicitar serviços (status='disponivel' -> 'solicitado')
DROP POLICY IF EXISTS "Instaladores podem solicitar serviços disponíveis" ON public.servicos;

CREATE POLICY "Instaladores podem solicitar serviços disponíveis" 
ON public.servicos 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'instalador'::app_role) 
  AND status = 'disponivel'
  AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
)
WITH CHECK (
  instalador_id = auth.uid() 
  AND status = 'solicitado'
);

-- 4. Atualizar policy para instaladores verem serviços solicitados
DROP POLICY IF EXISTS "Instaladores podem ver serviços atribuídos" ON public.servicos;

CREATE POLICY "Instaladores podem ver serviços atribuídos" 
ON public.servicos 
FOR SELECT 
USING (
  has_role(auth.uid(), 'instalador'::app_role) 
  AND instalador_id = auth.uid()
);

-- 5. Atualizar policy para instaladores atualizarem serviços atribuídos (inclui solicitado)
DROP POLICY IF EXISTS "Instaladores podem atualizar serviços atribuídos" ON public.servicos;

CREATE POLICY "Instaladores podem atualizar serviços atribuídos" 
ON public.servicos 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'instalador'::app_role) 
  AND instalador_id = auth.uid()
  AND status IN ('solicitado', 'atribuido', 'em_andamento')
);