-- 1. Remover trigger antigo
DROP TRIGGER IF EXISTS trigger_registrar_no_caixa_ao_aprovar ON servicos;

-- 2. Recriar função com lógica correta (3 lançamentos)
CREATE OR REPLACE FUNCTION public.registrar_no_caixa_ao_aprovar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
        
        -- 1. RECEITA: valor total do serviço
        INSERT INTO lancamentos_caixa (
            empresa_id,
            servico_id,
            tipo,
            categoria,
            descricao,
            valor,
            data_lancamento,
            forma_pagamento
        ) VALUES (
            NEW.empresa_id,
            NEW.id,
            'receita',
            'Receita de Serviço',
            'Receita do serviço ' || NEW.codigo,
            NEW.valor_total,
            CURRENT_DATE,
            'Pix'
        );
        
        -- 2. DESPESA: Pagamento ao instalador
        INSERT INTO lancamentos_caixa (
            empresa_id,
            servico_id,
            tipo,
            categoria,
            descricao,
            valor,
            data_lancamento,
            forma_pagamento
        ) VALUES (
            NEW.empresa_id,
            NEW.id,
            'despesa',
            'Pagamento Instalador',
            'Pagamento instalador - ' || NEW.codigo,
            NEW.valor_mao_obra_instalador,
            CURRENT_DATE,
            'Pix'
        );
        
        -- 3. DESPESA: Reembolso de materiais (se houver)
        IF NEW.valor_reembolso_despesas > 0 THEN
            INSERT INTO lancamentos_caixa (
                empresa_id,
                servico_id,
                tipo,
                categoria,
                descricao,
                valor,
                data_lancamento,
                forma_pagamento
            ) VALUES (
                NEW.empresa_id,
                NEW.id,
                'despesa',
                'Reembolso Materiais',
                'Reembolso materiais - ' || NEW.codigo,
                NEW.valor_reembolso_despesas,
                CURRENT_DATE,
                'Pix'
            );
        END IF;
        
    END IF;
    RETURN NEW;
END;
$function$;

-- 3. Recriar trigger
CREATE TRIGGER trigger_registrar_no_caixa_ao_aprovar
  AFTER UPDATE ON servicos
  FOR EACH ROW
  EXECUTE FUNCTION registrar_no_caixa_ao_aprovar();