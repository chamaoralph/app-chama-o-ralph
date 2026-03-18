

# Lista de Bloqueio de Telefones (Blacklist)

## Problema
Mensagens de amigos, familiares e spam chegam pelo WhatsApp e criam cotações automáticas, poluindo o funil de conversão.

## Solução
Criar uma lista de bloqueio de telefones. Números bloqueados são ignorados pela Edge Function — nenhuma cotação é criada. O admin pode bloquear direto da lista de cotações e gerenciar a lista nas configurações.

## Alterações

### 1. Nova tabela `telefones_bloqueados`
```sql
CREATE TABLE public.telefones_bloqueados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  telefone TEXT NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(empresa_id, telefone)
);

ALTER TABLE public.telefones_bloqueados ENABLE ROW LEVEL SECURITY;

-- Admins gerenciam
CREATE POLICY "Admins gerenciam bloqueios"
  ON public.telefones_bloqueados FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) 
    AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) 
    AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

-- Bloquear anon
CREATE POLICY "Bloquear anon telefones_bloqueados"
  ON public.telefones_bloqueados AS RESTRICTIVE FOR ALL TO anon
  USING (false);
```

### 2. Atualizar Edge Function `criar-cotacao-whatsapp`
Antes de buscar/criar o cliente, consultar `telefones_bloqueados`. Se o telefone estiver na lista, retornar resposta indicando que foi ignorado (sem criar cotação).

### 3. Botão "Bloquear Número" na lista de cotações
Na lista de cotações, adicionar uma ação por cotação para bloquear o telefone do cliente. Ao bloquear:
- Insere o telefone na tabela `telefones_bloqueados`
- Exclui a cotação atual (opcional, com confirmação)
- Exclui cotações pendentes anteriores do mesmo telefone (opcional)

### 4. Seção de gerenciamento na página de Configurações
Lista simples dos telefones bloqueados com opção de desbloquear.

