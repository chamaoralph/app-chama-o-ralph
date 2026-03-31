

# Correção: Não consegue excluir cotação

## Problema

A política de segurança (RLS) para deletar cotações exige que o usuário tenha a role `admin` na tabela `user_roles`. Porém, essa verificação usa a função `has_role()` que consulta a tabela `user_roles`.

Atualmente, apenas **1 usuário** tem a role `admin` na tabela `user_roles` (ID: `7c547e2c-...`). Se você está logado com outro usuário admin (ou se a tabela `usuarios` marca como `tipo = 'admin'` mas o `user_roles` não tem o registro correspondente), a exclusão é bloqueada silenciosamente pelo banco.

## Solução

Alterar a política de DELETE para usar a mesma lógica das outras políticas (SELECT/UPDATE), que verificam `empresa_id` via tabela `usuarios`, em vez de exigir role na `user_roles`:

```sql
DROP POLICY "Admins podem deletar cotações da empresa" ON public.cotacoes;

CREATE POLICY "Usuários podem deletar cotações da sua empresa"
ON public.cotacoes FOR DELETE TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid()
  )
);
```

Isso torna a exclusão consistente com as demais operações (SELECT, UPDATE) que já usam o mesmo padrão de `empresa_id`.

## Alternativa mais restritiva

Se quiser manter a exclusão apenas para admins, mas sem depender da tabela `user_roles`:

```sql
DROP POLICY "Admins podem deletar cotações da empresa" ON public.cotacoes;

CREATE POLICY "Admins podem deletar cotações da empresa"
ON public.cotacoes FOR DELETE TO authenticated
USING (
  empresa_id IN (
    SELECT empresa_id FROM usuarios WHERE id = auth.uid() AND tipo = 'admin'
  )
);
```

## Arquivo alterado
- Apenas uma migration SQL — nenhuma alteração de código necessária

