-- Permite que admins excluam clientes cadastrados por engano (ex: fornecedor
-- que entrou como cliente) direto pela tela de Follow-Up. Sem essa policy o
-- RLS bloqueia qualquer DELETE em clientes, mesmo pra admin.
--
-- Efeito em cascata já configurado nas FKs existentes:
--   cotacoes.cliente_id            -> ON DELETE CASCADE (remove as cotações do cliente)
--   clientes_rfm_cache.cliente_id  -> ON DELETE CASCADE
--   servicos.cliente_id            -> NO ACTION (bloqueia o delete se já tiver serviço)
--   avaliacoes.cliente_id          -> NO ACTION (bloqueia o delete se já tiver avaliação)
-- Ou seja: só é possível excluir cliente que ainda não gerou serviço real —
-- exatamente o caso de cadastro por engano.

CREATE POLICY "Admins podem deletar clientes da empresa"
ON public.clientes
FOR DELETE
TO public
USING (
  empresa_id IN (
    SELECT usuarios.empresa_id FROM usuarios
    WHERE usuarios.id = auth.uid() AND usuarios.tipo = 'admin'
  )
);
