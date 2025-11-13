-- Criar bucket público para fotos de serviços
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-servicos', 'fotos-servicos', true);

-- Criar bucket privado para notas fiscais
INSERT INTO storage.buckets (id, name, public)
VALUES ('notas-fiscais', 'notas-fiscais', false);

-- Políticas RLS para fotos-servicos (público)
CREATE POLICY "Fotos de serviços são visíveis publicamente"
ON storage.objects FOR SELECT
USING (bucket_id = 'fotos-servicos');

CREATE POLICY "Usuários autenticados podem fazer upload de fotos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fotos-servicos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Usuários podem atualizar suas próprias fotos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'fotos-servicos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Usuários podem deletar suas próprias fotos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'fotos-servicos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Políticas RLS para notas-fiscais (privado)
CREATE POLICY "Usuários podem ver suas próprias notas fiscais"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'notas-fiscais' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Usuários podem fazer upload de suas notas fiscais"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'notas-fiscais' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Usuários podem atualizar suas próprias notas fiscais"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'notas-fiscais' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Usuários podem deletar suas próprias notas fiscais"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'notas-fiscais' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);