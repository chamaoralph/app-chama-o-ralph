-- Tornar o bucket fotos-servicos público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'fotos-servicos';

-- Adicionar política de leitura pública para as fotos
CREATE POLICY "Fotos de serviços são publicamente visíveis"
ON storage.objects
FOR SELECT
USING (bucket_id = 'fotos-servicos');