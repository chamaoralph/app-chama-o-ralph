-- 1. Criar função para normalizar telefone (remover tudo exceto dígitos)
CREATE OR REPLACE FUNCTION public.normalizar_telefone_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.telefone := REGEXP_REPLACE(NEW.telefone, '[^0-9]', '', 'g');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Criar trigger para normalizar automaticamente antes de INSERT/UPDATE
DROP TRIGGER IF EXISTS trg_normalizar_telefone ON clientes;
CREATE TRIGGER trg_normalizar_telefone
BEFORE INSERT OR UPDATE ON clientes
FOR EACH ROW EXECUTE FUNCTION public.normalizar_telefone_trigger();

-- 3. Normalizar apenas telefones de clientes ATIVOS
UPDATE clientes 
SET telefone = REGEXP_REPLACE(telefone, '[^0-9]', '', 'g')
WHERE telefone ~ '[^0-9]'
AND ativo = true;