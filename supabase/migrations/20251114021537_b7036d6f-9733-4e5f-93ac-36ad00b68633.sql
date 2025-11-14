-- Adicionar foreign key de servicos.instalador_id para usuarios.id
-- Isso permitirá fazer joins corretamente nas queries
ALTER TABLE public.servicos 
ADD CONSTRAINT fk_servicos_instalador 
FOREIGN KEY (instalador_id) 
REFERENCES public.usuarios(id) 
ON DELETE SET NULL;