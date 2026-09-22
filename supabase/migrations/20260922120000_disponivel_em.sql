-- ============================================================
-- Prioridade de instaladores — Etapa 6
-- Registra quando o serviço ENTROU em 'disponivel' (diferente de
-- updated_at, que muda em qualquer edição, mesmo sem trocar status).
-- Usado pela montar-cascata para só montar fila de serviço recém
-- liberado, ignorando serviços antigos parados em 'disponivel'.
-- Aditivo: coluna nasce nula em todos os serviços existentes, e só é
-- preenchida na TRANSIÇÃO para 'disponivel' — uma edição qualquer
-- enquanto o serviço já está disponivel não reabre a janela.
-- ============================================================

ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS disponivel_em timestamptz;

COMMENT ON COLUMN public.servicos.disponivel_em IS
  'Data/hora em que o serviço entrou em status disponivel pela última vez. NULL para serviços que nunca passaram por essa transição desde a criação da coluna (nunca deve ser tratado como recente). Preenchido só na transição, não em qualquer edição.';

CREATE OR REPLACE FUNCTION public.atualizar_disponivel_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'disponivel'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'disponivel') THEN
    NEW.disponivel_em := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_atualizar_disponivel_em
  BEFORE INSERT OR UPDATE ON public.servicos
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_disponivel_em();
