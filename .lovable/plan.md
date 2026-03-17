
Objetivo: explicar o “1 fantasma” em Aprovações e corrigir o contador para refletir exatamente o que a tela mostra.

Diagnóstico confirmado (com dados reais do banco):
- Na empresa atual:
  - `aguardando_aprovacao = 0`
  - `solicitado = 1`
- Existe 1 serviço com status `solicitado`:
  - `SRV-2026-101` (id `40f48c0e-776e-427b-bb76-619c0c88ff45`)

Causa raiz do erro:
- O badge de Aprovações está contando **dois status**:
  - `solicitado` + `aguardando_aprovacao`
- Porém a página `/admin/aprovacoes` (filtro “Pendentes”) mostra **somente**:
  - `aguardando_aprovacao`
- Resultado: badge mostra “1”, tela abre vazia.  
- Então não é inconsistência do banco; é desalinhamento de regra entre contador e listagem.

Plano de correção:
1) Alinhar regra do badge lateral
- Arquivo: `src/components/layout/AdminLayout.tsx`
- Trocar o filtro do contador para considerar apenas:
  - `status = 'aguardando_aprovacao'`

2) Alinhar regra do card/badge de Aprovações no Dashboard
- Arquivo: `src/pages/admin/Dashboard.tsx`
- Trocar o cálculo de `servicosDisponiveis` (que hoje soma `solicitado` + `aguardando_aprovacao`) para apenas:
  - `status = 'aguardando_aprovacao'`

3) Evitar confusão futura (clareza semântica)
- Renomear variável de contagem para algo explícito (ex.: `aprovacoesPendentesCount`) no Dashboard.
- Assim fica claro que “Aprovações” não inclui “Solicitações”.

4) Robustez de leitura de usuário
- Onde houver busca de perfil com `.single()` para esse contador, usar `.maybeSingle()` + fallback `0` para evitar estado inconsistente se perfil não vier.

Impacto esperado após ajuste:
- Se houver apenas `solicitado`, badge de Aprovações fica 0/oculto.
- A lista de Aprovações continua vazia (agora consistente com o badge).
- Quando surgir item realmente em `aguardando_aprovacao`, badge e lista voltam a bater.

Arquivos a ajustar:
- `src/components/layout/AdminLayout.tsx`
- `src/pages/admin/Dashboard.tsx`
