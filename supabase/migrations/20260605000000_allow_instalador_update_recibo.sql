-- Instaladores podem atualizar seus próprios recibos (para regerar/atualizar valores)
-- A restrição WITH CHECK garante que não podem alterar instalador_id nem status_pagamento para 'pago'
CREATE POLICY "Instaladores podem atualizar seus recibos"
ON public.recibos_diarios FOR UPDATE
USING (instalador_id = auth.uid())
WITH CHECK (
  instalador_id = auth.uid()
  AND (status_pagamento IS NULL OR status_pagamento = 'pendente')
);
