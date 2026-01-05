-- Atualizar política para permitir status 'aguardando_aprovacao' na finalização
DROP POLICY IF EXISTS "Instaladores podem atualizar serviços atribuídos" ON public.servicos;

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