-- Permite marcar "outro instalador ajudou" num serviço.
--
-- Escopo combinado com o dono do produto:
-- - Só aparece na finalização do serviço (upload de fotos), preenchido pelo
--   instalador principal. Lista todos os instaladores cadastrados da empresa
--   (sem checar certificação/disponibilidade), exceto ele mesmo.
-- - Puramente informativo/de controle: NÃO mexe no repasse real. O repasse
--   da empresa pro instalador principal continua sendo os mesmos 50% de
--   sempre (valor_mao_obra_instalador não é alterado por esta migration).
--   O acerto dos 25% com o ajudante é combinado direto entre os dois,
--   fora do sistema — o app só guarda o valor de referência (congelado no
--   momento da finalização) pra aparecer no extrato do ajudante.
-- - Reembolso, acessórios e avaliação do cliente continuam 100% do
--   instalador principal — não são tocados aqui.
-- - Depois que o serviço é concluído, não é mais possível trocar/remover o
--   ajudante (trigger de trava abaixo).

ALTER TABLE public.servicos
  ADD COLUMN instalador_ajudante_id uuid REFERENCES public.instaladores(id),
  ADD COLUMN valor_mao_obra_ajudante numeric(10,2);

COMMENT ON COLUMN public.servicos.instalador_ajudante_id IS
  'Instalador que ajudou no serviço (opcional). Só informativo — não recebe repasse da empresa pelo sistema, acerta os 25% direto com o instalador principal.';
COMMENT ON COLUMN public.servicos.valor_mao_obra_ajudante IS
  'Valor de referência do ajudante (25% da mão de obra, metade de valor_mao_obra_instalador), congelado no momento da finalização. Não sai do caixa pelo sistema.';

-- Ninguém marca a si mesmo como próprio ajudante.
ALTER TABLE public.servicos
  ADD CONSTRAINT servicos_ajudante_diferente_do_principal
  CHECK (instalador_ajudante_id IS NULL OR instalador_ajudante_id <> instalador_id);

-- Trava: uma vez concluído, o ajudante (e o valor de referência dele) não
-- pode mais ser alterado. Escopo estrito só nessas duas colunas — não mexe
-- em nenhuma outra edição pós-conclusão que o admin já faça hoje.
CREATE OR REPLACE FUNCTION public.bloquear_edicao_ajudante_pos_conclusao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'concluido' AND (
       NEW.instalador_ajudante_id IS DISTINCT FROM OLD.instalador_ajudante_id
    OR NEW.valor_mao_obra_ajudante IS DISTINCT FROM OLD.valor_mao_obra_ajudante
  ) THEN
    RAISE EXCEPTION 'Não é possível alterar o instalador ajudante depois do serviço concluído';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_edicao_ajudante_pos_conclusao ON public.servicos;
CREATE TRIGGER trg_bloquear_edicao_ajudante_pos_conclusao
BEFORE UPDATE ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_edicao_ajudante_pos_conclusao();

-- Nenhuma policy de RLS nova é necessária:
-- - SELECT: "Usuários podem ver serviços da sua empresa" já cobre qualquer
--   usuário (admin ou instalador) da mesma empresa, então o ajudante já
--   consegue ler o serviço para montar o próprio extrato.
-- - UPDATE: quem marca o ajudante é sempre o instalador PRINCIPAL na tela de
--   finalização, e "Instaladores podem atualizar serviços atribuídos a
--   eles" (instalador_id = auth.uid()) já cobre esse caso.
