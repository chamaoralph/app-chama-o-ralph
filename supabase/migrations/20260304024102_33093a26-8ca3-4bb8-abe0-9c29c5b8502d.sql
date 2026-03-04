-- Allow admins to INSERT receipts for installers in their company
CREATE POLICY "Admins podem criar recibos da empresa"
ON public.recibos_diarios
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND empresa_id IN (
    SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = auth.uid()
  )
);