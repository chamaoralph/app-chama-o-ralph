-- Primeiro, dropar a política antiga
DROP POLICY IF EXISTS "Instaladores podem atualizar serviços atribuídos" ON servicos;

-- Criar nova política com USING e WITH CHECK
CREATE POLICY "Instaladores podem atualizar serviços atribuídos"
ON servicos
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'instalador'::app_role) 
  AND instalador_id = auth.uid() 
  AND status = ANY (ARRAY['solicitado'::text, 'atribuido'::text, 'em_andamento'::text])
)
WITH CHECK (
  has_role(auth.uid(), 'instalador'::app_role) 
  AND instalador_id = auth.uid() 
  AND status = ANY (ARRAY['solicitado'::text, 'atribuido'::text, 'em_andamento'::text, 'aguardando_aprovacao'::text])
);