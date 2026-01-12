-- Limitar tamanho de arquivos nos buckets
UPDATE storage.buckets
SET file_size_limit = 5242880  -- 5MB em bytes
WHERE id = 'fotos-servicos';

UPDATE storage.buckets
SET file_size_limit = 10485760  -- 10MB para notas fiscais (PDFs maiores)
WHERE id = 'notas-fiscais';

UPDATE storage.buckets
SET file_size_limit = 5242880  -- 5MB para comprovantes
WHERE id = 'comprovantes';