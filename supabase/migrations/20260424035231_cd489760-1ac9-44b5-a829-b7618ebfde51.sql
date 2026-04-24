-- Criar bucket público para PDFs dos termos assinados
INSERT INTO storage.buckets (id, name, public)
VALUES ('termos-assinados', 'termos-assinados', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública
CREATE POLICY "Public read termos-assinados"
ON storage.objects FOR SELECT
USING (bucket_id = 'termos-assinados');

-- Anon pode inserir (cliente assinando)
CREATE POLICY "Anon insert termos-assinados"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'termos-assinados');

-- Anon pode atualizar (regenerar)
CREATE POLICY "Anon update termos-assinados"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'termos-assinados')
WITH CHECK (bucket_id = 'termos-assinados');

-- Authenticated insert/update/delete (admins gerenciam)
CREATE POLICY "Auth manage termos-assinados"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'termos-assinados')
WITH CHECK (bucket_id = 'termos-assinados');