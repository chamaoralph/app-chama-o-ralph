-- Corrigir políticas de UPDATE para instaladores
-- O problema é que as políticas RESTRICTIVE (No) são muito restritivas

-- Primeiro, vamos dropar as políticas existentes de UPDATE para instaladores
DROP POLICY IF EXISTS "Instaladores podem atualizar serviços atribuídos" ON public.servicos;
DROP POLICY IF EXISTS "Instaladores podem pegar serviços disponíveis SE certificados" ON public.servicos;
DROP POLICY IF EXISTS "Instaladores podem solicitar serviços disponíveis" ON public.servicos;

-- Recriar como PERMISSIVE (usando default) para que qualquer uma delas permita a ação
-- Política 1: Instaladores podem atualizar serviços que estão trabalhando
CREATE POLICY "Instaladores podem atualizar serviços atribuídos"
ON public.servicos
FOR UPDATE
USING (
  has_role(auth.uid(), 'instalador'::app_role) 
  AND instalador_id = auth.uid() 
  AND status IN ('atribuido', 'em_andamento')
)
WITH CHECK (
  has_role(auth.uid(), 'instalador'::app_role) 
  AND instalador_id = auth.uid() 
  AND status IN ('atribuido', 'em_andamento', 'aguardando_aprovacao')
);

-- Política 2: Instaladores certificados podem pegar serviços disponíveis
CREATE POLICY "Instaladores podem pegar serviços disponíveis SE certificados"
ON public.servicos
FOR UPDATE
USING (
  has_role(auth.uid(), 'instalador'::app_role) 
  AND status = 'disponivel'
  AND empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = auth.uid())
  AND instalador_certificado_para_tipo(auth.uid(), tipo_servico) = true
)
WITH CHECK (
  instalador_id = auth.uid() 
  AND status = 'atribuido'
);

-- Política 3: Instaladores podem solicitar serviços disponíveis (sem certificação)
CREATE POLICY "Instaladores podem solicitar serviços disponíveis"
ON public.servicos
FOR UPDATE
USING (
  has_role(auth.uid(), 'instalador'::app_role) 
  AND status = 'disponivel'
  AND empresa_id IN (SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = auth.uid())
)
WITH CHECK (
  instalador_id = auth.uid() 
  AND status = 'solicitado'
);