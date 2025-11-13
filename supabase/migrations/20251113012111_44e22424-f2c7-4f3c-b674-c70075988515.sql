-- Remover políticas existentes do bucket fotos-servicos
DROP POLICY IF EXISTS "Fotos de serviços são visíveis publicamente" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias fotos" ON storage.objects;

-- Remover políticas existentes do bucket notas-fiscais
DROP POLICY IF EXISTS "Usuários podem ver suas próprias notas fiscais" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem fazer upload de suas notas fiscais" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias notas fiscais" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias notas fiscais" ON storage.objects;

-- Criar políticas permissivas para fotos-servicos
CREATE POLICY "Permitir todos os selects em fotos-servicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'fotos-servicos');

CREATE POLICY "Permitir todos os inserts em fotos-servicos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'fotos-servicos' AND auth.role() = 'authenticated');

CREATE POLICY "Permitir todos os updates em fotos-servicos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'fotos-servicos' AND auth.role() = 'authenticated');

CREATE POLICY "Permitir todos os deletes em fotos-servicos"
ON storage.objects FOR DELETE
USING (bucket_id = 'fotos-servicos' AND auth.role() = 'authenticated');

-- Criar políticas permissivas para notas-fiscais
CREATE POLICY "Permitir todos os selects em notas-fiscais"
ON storage.objects FOR SELECT
USING (bucket_id = 'notas-fiscais' AND auth.role() = 'authenticated');

CREATE POLICY "Permitir todos os inserts em notas-fiscais"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'notas-fiscais' AND auth.role() = 'authenticated');

CREATE POLICY "Permitir todos os updates em notas-fiscais"
ON storage.objects FOR UPDATE
USING (bucket_id = 'notas-fiscais' AND auth.role() = 'authenticated');

CREATE POLICY "Permitir todos os deletes em notas-fiscais"
ON storage.objects FOR DELETE
USING (bucket_id = 'notas-fiscais' AND auth.role() = 'authenticated');