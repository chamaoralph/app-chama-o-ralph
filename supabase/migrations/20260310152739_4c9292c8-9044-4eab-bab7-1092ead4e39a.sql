CREATE POLICY "Admins podem deletar recibos da empresa"
ON public.recibos_diarios
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid()
  )
);