-- Drop ALL existing fotos-servicos policies first
DROP POLICY IF EXISTS "Users can view photos from their company services" ON storage.objects;
DROP POLICY IF EXISTS "Installers can upload photos to their assigned services" ON storage.objects;
DROP POLICY IF EXISTS "Installers can update photos on their assigned services" ON storage.objects;
DROP POLICY IF EXISTS "Installers can delete photos on their assigned services" ON storage.objects;

-- Make bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'fotos-servicos';

-- Create company-scoped RLS policies for fotos-servicos
CREATE POLICY "Company users can view service photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fotos-servicos' AND
  EXISTS (
    SELECT 1 FROM servicos s
    JOIN usuarios u ON u.empresa_id = s.empresa_id
    WHERE u.id = auth.uid()
    AND s.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Installers can upload service photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fotos-servicos' AND
  EXISTS (
    SELECT 1 FROM servicos
    WHERE instalador_id = auth.uid()
    AND id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Installers can update service photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'fotos-servicos' AND
  EXISTS (
    SELECT 1 FROM servicos
    WHERE instalador_id = auth.uid()
    AND id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Installers can delete service photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'fotos-servicos' AND
  EXISTS (
    SELECT 1 FROM servicos
    WHERE instalador_id = auth.uid()
    AND id::text = (storage.foldername(name))[1]
  )
);