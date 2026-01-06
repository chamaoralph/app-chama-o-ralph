-- Adicionar campos de pagamento na tabela recibos_diarios
ALTER TABLE public.recibos_diarios 
ADD COLUMN status_pagamento TEXT DEFAULT 'pendente',
ADD COLUMN data_pagamento DATE,
ADD COLUMN comprovante_pix_url TEXT;

-- Adicionar constraint para validar status
ALTER TABLE public.recibos_diarios
ADD CONSTRAINT recibos_status_pagamento_check 
CHECK (status_pagamento IN ('pendente', 'pago'));

-- Criar bucket de storage para comprovantes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('comprovantes', 'comprovantes', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para comprovantes
CREATE POLICY "Admins podem fazer upload de comprovantes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'comprovantes' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins podem ver comprovantes da empresa"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'comprovantes'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Instaladores podem ver seus comprovantes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'comprovantes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para admin atualizar recibos
CREATE POLICY "Admins podem atualizar recibos da empresa"
ON public.recibos_diarios FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (
    SELECT usuarios.empresa_id FROM usuarios WHERE usuarios.id = auth.uid()
  )
);

-- Trigger para criar despesa automaticamente ao pagar
CREATE OR REPLACE FUNCTION public.criar_despesa_ao_pagar_instalador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Quando status muda para 'pago', criar lancamento no caixa
  IF NEW.status_pagamento = 'pago' AND (OLD.status_pagamento IS NULL OR OLD.status_pagamento = 'pendente') THEN
    
    -- Inserir despesa de mão de obra
    IF NEW.valor_mao_obra > 0 THEN
      INSERT INTO lancamentos_caixa (
        empresa_id, tipo, categoria, descricao, 
        valor, data_lancamento, forma_pagamento
      )
      SELECT 
        NEW.empresa_id,
        'despesa',
        'Pagamento Instalador',
        'Pagamento recibo ' || u.nome || ' - ' || TO_CHAR(NEW.data_referencia, 'DD/MM/YYYY'),
        NEW.valor_mao_obra,
        NEW.data_pagamento,
        'PIX'
      FROM usuarios u WHERE u.id = NEW.instalador_id;
    END IF;
    
    -- Se houver reembolso, inserir separadamente
    IF NEW.valor_reembolso > 0 THEN
      INSERT INTO lancamentos_caixa (
        empresa_id, tipo, categoria, descricao, 
        valor, data_lancamento, forma_pagamento
      )
      SELECT 
        NEW.empresa_id,
        'despesa',
        'Reembolso Materiais',
        'Reembolso ' || u.nome || ' - ' || TO_CHAR(NEW.data_referencia, 'DD/MM/YYYY'),
        NEW.valor_reembolso,
        NEW.data_pagamento,
        'PIX'
      FROM usuarios u WHERE u.id = NEW.instalador_id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_criar_despesa_pagamento
AFTER UPDATE ON public.recibos_diarios
FOR EACH ROW
EXECUTE FUNCTION public.criar_despesa_ao_pagar_instalador();