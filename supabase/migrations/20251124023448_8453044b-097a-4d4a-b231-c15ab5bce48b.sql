-- Adicionar policy de DELETE para cotações
-- Apenas admins podem deletar cotações da sua empresa
CREATE POLICY "Admins podem deletar cotações da empresa"
ON public.cotacoes
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (
    SELECT empresa_id 
    FROM usuarios 
    WHERE id = auth.uid()
  )
);