-- =====================================================================
-- Serviços com acessório "pendente de estoque central" (origem_estoque/
-- fornecedor = 'instalador' — ver migration 20260810120000) voltam a
-- aparecer para TODOS os instaladores em /instalador/servicos-disponiveis.
-- Antes, o front-end escondia o serviço de quem não tinha o suporte em
-- mãos. Agora ele aparece pra todo mundo e, ao tentar solicitar, o
-- instalador sem o suporte vê um aviso — mas pode confirmar e pegar o
-- serviço mesmo assim.
--
-- Pra montar esse aviso ("peça pra Fulano, que tem em estoque"), o
-- front-end precisa saber quais OUTROS instaladores têm saldo suficiente
-- de um determinado acessório. A RLS de movimentacoes_suportes só deixa
-- cada instalador ver as próprias movimentações (ver migration
-- 20260126215411), então essa função roda com SECURITY DEFINER e expõe
-- só o nome de quem tem estoque — nunca quantidades nem o histórico.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.instaladores_com_suporte_disponivel(
  p_catalogo_id UUID,
  p_quantidade INTEGER
)
RETURNS TABLE (nome TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.nome
  FROM usuarios u
  WHERE u.tipo = 'instalador'
    AND u.ativo = true
    AND u.id <> auth.uid()
    AND u.empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
    AND COALESCE((
      SELECT SUM(
        CASE m.tipo_movimento
          WHEN 'entrega' THEN m.quantidade
          WHEN 'devolucao' THEN -m.quantidade
          WHEN 'uso' THEN -m.quantidade
          ELSE 0
        END
      )
      FROM movimentacoes_suportes m
      WHERE m.instalador_id = u.id
        AND m.catalogo_id = p_catalogo_id
    ), 0) >= GREATEST(p_quantidade, 1)
  ORDER BY u.nome;
$$;

COMMENT ON FUNCTION public.instaladores_com_suporte_disponivel(UUID, INTEGER) IS
  'Lista (só o nome) os instaladores ativos da mesma empresa que têm, em mãos, saldo >= quantidade do acessório informado. Usado no aviso de "suporte indisponível" em /instalador/servicos-disponiveis.';
