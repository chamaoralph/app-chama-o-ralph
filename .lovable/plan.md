

# Implementar campo `token` na tabela e Edge Function

## Alterações

1. **Migration SQL**: `ALTER TABLE public.cliques_whatsapp ADD COLUMN token text;`
2. **Edge Function `registrar-clique`**: Atualizar destructuring e insert para incluir `token` do body (linha 33 e linhas 42-46)

Duas edições simples e diretas.

