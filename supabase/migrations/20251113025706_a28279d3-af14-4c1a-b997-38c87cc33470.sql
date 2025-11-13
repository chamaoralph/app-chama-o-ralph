-- Adicionar política para instaladores pegarem serviços disponíveis
CREATE POLICY "Instaladores podem pegar serviços disponíveis"
ON servicos
FOR UPDATE
USING (
  has_role(auth.uid(), 'instalador'::app_role) 
  AND status = 'disponivel' 
  AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
)
WITH CHECK (
  instalador_id = auth.uid() 
  AND status = 'atribuido'
);