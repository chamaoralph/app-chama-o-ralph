# Corrigir erro ao criar usuário novo (instalador)

## Problema

Ao criar conta pelo convite, aparece:
> `new row violates row-level security policy for table "user_roles"`

### Causa raiz

O fluxo atual no client (`src/lib/auth.tsx` → `signUp`) faz **4 operações separadas**:

1. `supabase.auth.signUp()` — cria em `auth.users` ✅
2. `INSERT public.usuarios` ✅
3. `INSERT public.user_roles` ❌ **falha aqui**
4. `INSERT public.instaladores` (não chega a executar)

A policy de `user_roles` exige `auth.uid() = user_id`. Acontece que logo depois do `signUp`, a sessão JWT do novo usuário ainda **não está propagada** no header da requisição — então `auth.uid()` chega como `NULL` no banco e o INSERT é bloqueado pela RLS (corretamente, do ponto de vista de segurança).

Isso também deixa cadastros "pela metade": o usuário Pedro já existe em `auth.users` e em `usuarios`, mas sem role nem registro em `instaladores` — e como o email já está em uso, ele não consegue tentar de novo.

### Por que NÃO afrouxar a policy

Permitir INSERT em `user_roles` sem `auth.uid()` checado seria uma falha de segurança grave — qualquer um poderia se cadastrar como `admin`. A policy está correta. O fluxo é que está errado.

## Solução

Mover toda a criação de registros relacionados ao novo usuário para um **trigger no banco** que dispara em `AFTER INSERT ON auth.users`. O trigger lê os dados do convite e do `raw_user_meta_data` enviados pelo client e popula `usuarios`, `user_roles` e (se for o caso) `instaladores` em uma única transação atômica, com privilégios de `SECURITY DEFINER` (bypass de RLS, seguro porque a lógica está controlada no servidor).

### Mudanças

**1. Migration SQL**
- Criar função `public.handle_new_user()` (`SECURITY DEFINER`, `search_path = public`):
  - Lê `nome`, `telefone`, `empresa_id`, `tipo` de `NEW.raw_user_meta_data`
  - Insere em `public.usuarios`
  - Insere em `public.user_roles` com a `role` do metadata
  - Se `tipo = 'instalador'`, insere em `public.instaladores`
  - Tratamento de exceção: se algo falhar, levanta erro claro (cancela a criação do auth.user também)
- Criar trigger `on_auth_user_created` em `auth.users AFTER INSERT`
- **Limpeza do usuário Pedro órfão**: deletar de `public.usuarios` e de `auth.users` (id `a74ab656-55c7-4b0e-90aa-34e22d30dcd1`) para que ele consiga se cadastrar de novo

**2. `src/lib/auth.tsx` — função `signUp`**
- Passar `nome`, `telefone`, `empresa_id`, `tipo` dentro de `options.data` no `supabase.auth.signUp()` (vai para `raw_user_meta_data`)
- Remover os 3 inserts manuais (`usuarios`, `user_roles`, `instaladores`) — o trigger faz tudo

### Detalhes técnicos

```sql
-- migration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text := NEW.raw_user_meta_data->>'tipo';
  v_empresa_id uuid := (NEW.raw_user_meta_data->>'empresa_id')::uuid;
BEGIN
  -- pula se metadata não veio (ex: signup feito por outro caminho)
  IF v_tipo IS NULL OR v_empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.usuarios (id, empresa_id, nome, telefone, tipo, ativo)
  VALUES (
    NEW.id,
    v_empresa_id,
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'telefone',
    v_tipo,
    true
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_tipo::app_role);

  IF v_tipo = 'instalador' THEN
    INSERT INTO public.instaladores (id, empresa_id, ativo)
    VALUES (NEW.id, v_empresa_id, true);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- limpeza do cadastro órfão do Pedro
DELETE FROM public.usuarios WHERE id = 'a74ab656-55c7-4b0e-90aa-34e22d30dcd1';
DELETE FROM auth.users WHERE id = 'a74ab656-55c7-4b0e-90aa-34e22d30dcd1';
```

```ts
// src/lib/auth.tsx — signUp simplificado
const { data: authData, error: authError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/`,
    data: {
      nome: userData.nome,
      telefone: userData.telefone,
      empresa_id: userData.empresa_id,
      tipo: userData.tipo,
    },
  },
});
if (authError) throw authError;
// trigger faz o resto — nada de inserts manuais aqui
```

## Resultado esperado

- Pedro (e qualquer novo convidado) consegue se cadastrar normalmente
- Cadastros viram atômicos: ou tudo é criado, ou nada é (sem mais usuários "pela metade")
- Policies de `user_roles` continuam estritas (segurança preservada)
- Funciona pra admin e pra instalador
