CREATE POLICY "Admins podem deletar serviços da empresa"
ON public.servicos FOR DELETE TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id FROM public.usuarios
    WHERE id = auth.uid() AND tipo = 'admin'
  )
);