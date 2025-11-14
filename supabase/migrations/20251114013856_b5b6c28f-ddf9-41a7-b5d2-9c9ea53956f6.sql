-- 1. Adicionar política RLS para admin ver todos usuários da empresa
CREATE POLICY "Admin pode ver todos usuarios da empresa" 
ON usuarios 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
  )
  AND empresa_id IN (
    SELECT empresa_id 
    FROM usuarios 
    WHERE id = auth.uid()
  )
);

-- 2. Criar trigger para registrar no caixa ao aprovar serviço
CREATE TRIGGER trigger_registrar_no_caixa_ao_aprovar
  AFTER UPDATE ON servicos
  FOR EACH ROW
  EXECUTE FUNCTION registrar_no_caixa_ao_aprovar();