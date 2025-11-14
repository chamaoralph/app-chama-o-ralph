-- 1. Modificar trigger para prevenir duplicação de lançamentos
CREATE OR REPLACE FUNCTION public.registrar_no_caixa_ao_aprovar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    -- Só executar quando status mudar para 'concluido'
    IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
        
        -- VERIFICAR SE JÁ EXISTEM LANÇAMENTOS PARA ESTE SERVIÇO
        IF EXISTS (SELECT 1 FROM lancamentos_caixa WHERE servico_id = NEW.id) THEN
            -- Já existem lançamentos, não criar novos
            RETURN NEW;
        END IF;
        
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

-- 2. Criar função para remover lançamentos ao desaprovar
CREATE OR REPLACE FUNCTION public.remover_lancamentos_ao_desaprovar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    -- Se o status mudou de 'concluido' para outro status, remover lançamentos
    IF OLD.status = 'concluido' AND NEW.status != 'concluido' THEN
        DELETE FROM lancamentos_caixa
        WHERE servico_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- 3. Criar trigger para remover lançamentos ao desaprovar
DROP TRIGGER IF EXISTS trigger_remover_lancamentos_ao_desaprovar ON public.servicos;
CREATE TRIGGER trigger_remover_lancamentos_ao_desaprovar
    BEFORE UPDATE ON public.servicos
    FOR EACH ROW
    EXECUTE FUNCTION public.remover_lancamentos_ao_desaprovar();

-- 4. Limpar lançamentos duplicados do SRV-2025-003
DELETE FROM lancamentos_caixa
WHERE servico_id = (SELECT id FROM servicos WHERE codigo = 'SRV-2025-003');

-- 5. Recriar os lançamentos corretos do SRV-2025-003
INSERT INTO lancamentos_caixa (empresa_id, servico_id, tipo, categoria, descricao, valor, data_lancamento, forma_pagamento)
SELECT 
    s.empresa_id,
    s.id,
    'receita',
    'Receita de Serviço',
    'Receita do serviço ' || s.codigo,
    s.valor_total,
    CURRENT_DATE,
    'Pix'
FROM servicos s
WHERE s.codigo = 'SRV-2025-003';

INSERT INTO lancamentos_caixa (empresa_id, servico_id, tipo, categoria, descricao, valor, data_lancamento, forma_pagamento)
SELECT 
    s.empresa_id,
    s.id,
    'despesa',
    'Pagamento Instalador',
    'Pagamento instalador - ' || s.codigo,
    s.valor_mao_obra_instalador,
    CURRENT_DATE,
    'Pix'
FROM servicos s
WHERE s.codigo = 'SRV-2025-003';

INSERT INTO lancamentos_caixa (empresa_id, servico_id, tipo, categoria, descricao, valor, data_lancamento, forma_pagamento)
SELECT 
    s.empresa_id,
    s.id,
    'despesa',
    'Reembolso Materiais',
    'Reembolso materiais - ' || s.codigo,
    s.valor_reembolso_despesas,
    CURRENT_DATE,
    'Pix'
FROM servicos s
WHERE s.codigo = 'SRV-2025-003'
AND s.valor_reembolso_despesas > 0;