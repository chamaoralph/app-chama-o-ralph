

# Serviços com "Correção Solicitada" invisíveis para o instalador

## Problema
Quando o admin solicita correção de um serviço, o status muda para `correcao_solicitada`. Porém, nenhuma tela do instalador inclui esse status nos filtros de consulta:

- **Minha Agenda** filtra apenas: `solicitado`, `atribuido`, `em_andamento`
- **Dashboard** filtra apenas: `atribuido`, `em_andamento`
- **Finalizar Serviço** provavelmente também não aceita esse status

O serviço "some" do ponto de vista do instalador.

## Solução

### 1. Incluir `correcao_solicitada` nas queries do instalador

**`src/pages/instalador/MinhaAgenda.tsx`**
- Adicionar `correcao_solicitada` ao `.in("status", [...])` para que o serviço apareça na agenda.

**`src/pages/instalador/Dashboard.tsx`**
- Incluir `correcao_solicitada` nas queries de "próximo serviço" e contadores relevantes.

### 2. Exibir alerta visual claro no card do serviço

**`src/components/instalador/AgendaServicoCard.tsx`** (e `MobileServicoCard.tsx`)
- Quando `status === 'correcao_solicitada'`, mostrar um badge vermelho "Correção Solicitada" e exibir a observação do admin (campo `observacoes_instalador`).

### 3. Permitir re-finalizar o serviço

**`src/pages/instalador/FinalizarServico.tsx`**
- Aceitar status `correcao_solicitada` como válido para edição/re-envio de fotos.
- Ao re-enviar, o status volta para `aguardando_aprovacao`.

### 4. Atualizar RLS (se necessário)

A policy `Instaladores podem ver serviços atribuídos` usa `instalador_id = auth.uid()` sem filtro de status, então o SELECT já funciona. A policy de UPDATE permite `atribuido` e `em_andamento` no USING — preciso adicionar `correcao_solicitada` para que o instalador consiga atualizar o serviço.

**Migration SQL:**
```sql
-- Atualizar policy de UPDATE para incluir correcao_solicitada
DROP POLICY "Instaladores podem atualizar serviços atribuídos" ON public.servicos;
CREATE POLICY "Instaladores podem atualizar serviços atribuídos"
ON public.servicos FOR UPDATE TO public
USING (
  has_role(auth.uid(), 'instalador'::app_role) 
  AND instalador_id = auth.uid() 
  AND status = ANY (ARRAY['atribuido','em_andamento','correcao_solicitada'])
)
WITH CHECK (
  has_role(auth.uid(), 'instalador'::app_role) 
  AND instalador_id = auth.uid() 
  AND status = ANY (ARRAY['atribuido','em_andamento','aguardando_aprovacao'])
);
```

## Arquivos a editar
- `src/pages/instalador/MinhaAgenda.tsx` — adicionar status ao filtro
- `src/pages/instalador/Dashboard.tsx` — adicionar status ao filtro
- `src/components/instalador/AgendaServicoCard.tsx` — badge de correção + mostrar observação
- `src/components/instalador/MobileServicoCard.tsx` — idem para mobile
- `src/pages/instalador/FinalizarServico.tsx` — aceitar `correcao_solicitada` para re-envio
- Migration SQL — atualizar RLS policy de UPDATE

