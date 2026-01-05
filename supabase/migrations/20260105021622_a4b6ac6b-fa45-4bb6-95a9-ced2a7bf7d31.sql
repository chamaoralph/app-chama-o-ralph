-- Drop and recreate foreign keys with ON DELETE CASCADE

-- 1. respostas_tentativa.pergunta_id -> perguntas.id
ALTER TABLE public.respostas_tentativa 
DROP CONSTRAINT IF EXISTS respostas_tentativa_pergunta_id_fkey;

ALTER TABLE public.respostas_tentativa 
ADD CONSTRAINT respostas_tentativa_pergunta_id_fkey 
FOREIGN KEY (pergunta_id) REFERENCES public.perguntas(id) ON DELETE CASCADE;

-- 2. respostas_tentativa.alternativa_escolhida_id -> alternativas.id
ALTER TABLE public.respostas_tentativa 
DROP CONSTRAINT IF EXISTS respostas_tentativa_alternativa_escolhida_id_fkey;

ALTER TABLE public.respostas_tentativa 
ADD CONSTRAINT respostas_tentativa_alternativa_escolhida_id_fkey 
FOREIGN KEY (alternativa_escolhida_id) REFERENCES public.alternativas(id) ON DELETE CASCADE;

-- 3. alternativas.pergunta_id -> perguntas.id (cascade delete alternatives when question is deleted)
ALTER TABLE public.alternativas 
DROP CONSTRAINT IF EXISTS alternativas_pergunta_id_fkey;

ALTER TABLE public.alternativas 
ADD CONSTRAINT alternativas_pergunta_id_fkey 
FOREIGN KEY (pergunta_id) REFERENCES public.perguntas(id) ON DELETE CASCADE;