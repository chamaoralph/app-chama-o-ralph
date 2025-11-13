-- Criar função para registrar no caixa ao aprovar serviço
CREATE OR REPLACE FUNCTION registrar_no_caixa_ao_aprovar()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
        
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
            'Serviço',
            'Serviço ' || NEW.codigo || ' concluído',
            NEW.valor_total,
            CURRENT_DATE,
            'Pix'
        );
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para executar a função
CREATE TRIGGER trigger_registrar_caixa
AFTER UPDATE ON servicos
FOR EACH ROW
EXECUTE FUNCTION registrar_no_caixa_ao_aprovar();