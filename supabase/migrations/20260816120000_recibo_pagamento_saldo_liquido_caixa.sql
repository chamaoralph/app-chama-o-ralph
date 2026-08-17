-- Agora quem recebe o pagamento do cliente costuma ser o instalador, e é ele quem repassa
-- (ou não) a diferença pra empresa. O gatilho antigo sempre lançava uma despesa fixa de
-- "mão de obra + reembolso" no Caixa quando o recibo diário era marcado como pago,
-- ignorando quanto o instalador já tinha recebido em mãos do cliente (valor_recebido_cliente)
-- e lançando reembolso como despesa separada (o que outra migração já decidiu não fazer
-- para o lançamento por serviço).
--
-- Este gatilho passa a lançar UM único lançamento com o saldo líquido real:
--   saldo = valor_mao_obra + valor_reembolso - valor_recebido_cliente
--   saldo > 0  -> despesa "Pagamento Instalador" (empresa paga o instalador)
--   saldo < 0  -> receita "Recebimento Instalador" (instalador paga/devolve à empresa)
--   saldo = 0  -> já quitado em mãos, nada a lançar
CREATE OR REPLACE FUNCTION public.criar_despesa_ao_pagar_instalador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_saldo NUMERIC;
  v_nome TEXT;
BEGIN
  -- Quando status muda para 'pago', lançar o saldo líquido no caixa
  IF NEW.status_pagamento = 'pago' AND (OLD.status_pagamento IS NULL OR OLD.status_pagamento = 'pendente') THEN

    v_saldo := COALESCE(NEW.valor_mao_obra, 0) + COALESCE(NEW.valor_reembolso, 0) - COALESCE(NEW.valor_recebido_cliente, 0);

    SELECT nome INTO v_nome FROM usuarios WHERE id = NEW.instalador_id;

    IF v_saldo > 0 THEN
      INSERT INTO lancamentos_caixa (
        empresa_id, tipo, categoria, descricao,
        valor, data_lancamento, forma_pagamento
      ) VALUES (
        NEW.empresa_id, 'despesa', 'Pagamento Instalador',
        'Pagamento recibo ' || COALESCE(v_nome, '') || ' - ' || TO_CHAR(NEW.data_referencia, 'DD/MM/YYYY'),
        v_saldo, NEW.data_pagamento, 'PIX'
      );
    ELSIF v_saldo < 0 THEN
      INSERT INTO lancamentos_caixa (
        empresa_id, tipo, categoria, descricao,
        valor, data_lancamento, forma_pagamento
      ) VALUES (
        NEW.empresa_id, 'receita', 'Recebimento Instalador',
        'Recebimento de ' || COALESCE(v_nome, '') || ' - ' || TO_CHAR(NEW.data_referencia, 'DD/MM/YYYY'),
        ABS(v_saldo), NEW.data_pagamento, 'PIX'
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;
