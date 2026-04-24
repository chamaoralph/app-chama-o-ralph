## Objetivo

Garantir que **nenhum serviço apareça para os instaladores enquanto o cliente não assinar o termo**. Hoje, ao aprovar a cotação, o serviço é criado imediatamente com status `disponivel`, ficando visível na lista de "Serviços Disponíveis".

## Novo fluxo

1. Admin clica **"Aprovar"** numa cotação pendente.
2. Em vez de virar `aprovada` direto, a cotação vai para o novo status **`termo_pendente`** (badge laranja "Aguardando Termo").
3. Nenhum serviço é criado ainda — instaladores não veem nada.
4. Admin envia o termo pelo card já existente (`TermoAceiteCard`).
5. Quando o cliente assina (em `/aceite/:token`), a edge function `aprovar-cotacao-via-termo` é chamada e muda o status da cotação para `aprovada` — só então o trigger `criar_servico_ao_confirmar` cria o serviço com status `disponivel`, e ele aparece para os instaladores.
6. Se o admin quiser pular o termo (cenário antigo), continua podendo "Aprovar diretamente" via uma ação secundária.

## Mudanças

### 1. Banco (migration)

- Atualizar o constraint `cotacoes_status_check` para incluir `'termo_pendente'`:
  ```
  ALTER TABLE cotacoes DROP CONSTRAINT cotacoes_status_check;
  ALTER TABLE cotacoes ADD CONSTRAINT cotacoes_status_check
    CHECK (status IN ('pendente','termo_pendente','aprovada','perdida','sem_resposta','nao_gerou'));
  ```
- Nenhuma alteração no trigger `criar_servico_ao_confirmar` — ele já só dispara quando muda para `aprovada`, então o serviço continuará sendo criado no momento certo (após assinatura).

### 2. `src/pages/admin/cotacoes/Lista.tsx`

- Renomear o botão verde **"Aprovar"** (linhas ~971-989) para **"Aprovar e Enviar Termo"**: ao clicar, atualiza `status` para `'termo_pendente'` (em vez de `'aprovada'`), abre a edição da cotação ou mantém o usuário na lista exibindo um toast com instrução para enviar o termo via card de edição.
- Adicionar opção secundária (menu/dropdown ou botão pequeno) **"Aprovar sem termo"** que mantém o comportamento antigo (`status: 'aprovada'`) para casos excepcionais.
- Atualizar `getStatusBadge` (linha 666) adicionando a entrada `termo_pendente: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Aguardando Termo' }`.
- Mostrar os botões "Reprovar" e o ciclo completo também quando status for `termo_pendente`.
- Replicar o mesmo comportamento nos handlers `onAprovar` dos calendários `CalendarioCotacoesSemanal` e `CalendarioCotacoesMensal` (linhas ~799 e ~813).

### 3. `src/components/admin/CalendarioCotacoesSemanal.tsx` e `CalendarioCotacoesMensal.tsx`

- Aceitar/exibir o novo status `termo_pendente` com a mesma cor da badge (cards laranja).

### 4. `src/components/admin/TermoAceiteCard.tsx`

- Quando o termo é aceito (estado já existente do componente), exibir um aviso "Termo assinado — cotação aprovada automaticamente" (apenas informativo; a aprovação acontece pela edge function).
- Quando o termo ainda está pendente, deixar claro: "Aguardando assinatura — o serviço só aparecerá para os instaladores após o cliente assinar".

### 5. Edge function `aprovar-cotacao-via-termo`

- Já faz exatamente o que precisamos: muda `cotacoes.status` de qualquer valor para `'aprovada'` quando o termo é aceito, o que dispara o trigger e cria o serviço. Nenhuma alteração necessária.

### 6. Filtros e telas relacionadas

- Onde houver filtros por status na Lista de Cotações (filtros existentes), adicionar a opção "Aguardando Termo".

## Observações

- Cotações com status `aprovada` antigas continuam funcionando normalmente (já têm serviço criado).
- A página de Aprovações de serviços (`/admin/aprovacoes`) e a lista de Serviços Disponíveis para instaladores não precisam mudar — elas operam sobre `servicos`, e o serviço só será criado quando o termo for assinado.

## Arquivos afetados

- Nova migration SQL (constraint).
- `src/pages/admin/cotacoes/Lista.tsx`
- `src/components/admin/CalendarioCotacoesSemanal.tsx`
- `src/components/admin/CalendarioCotacoesMensal.tsx`
- `src/components/admin/TermoAceiteCard.tsx`
