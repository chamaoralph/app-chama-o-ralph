DROP POLICY "Admins podem deletar cotações da empresa" ON public.cotacoes;

CREATE POLICY "Admins podem deletar cotações da empresa"
ON public.cotacoes FOR DELETE TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid() AND tipo = 'admin'
  )
);