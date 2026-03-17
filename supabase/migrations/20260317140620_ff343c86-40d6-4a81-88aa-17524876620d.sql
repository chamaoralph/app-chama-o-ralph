
DROP POLICY "Instaladores podem atualizar serviços atribuídos" ON public.servicos;
CREATE POLICY "Instaladores podem atualizar serviços atribuídos"
ON public.servicos FOR UPDATE TO public
USING (
  has_role(auth.uid(), 'instalador'::app_role) 
  AND instalador_id = auth.uid() 
  AND status = ANY (ARRAY['atribuido','em_andamento','correcao_solicitada'])
)
WITH CHECK (
  has_role(auth.uid(), 'instalador'::app_role) 
  AND instalador_id = auth.uid() 
  AND status = ANY (ARRAY['atribuido','em_andamento','aguardando_aprovacao'])
);
