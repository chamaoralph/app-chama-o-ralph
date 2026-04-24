## Diagnóstico

Os serviços **SRV-2026-246** e **SRV-2026-255** foram criados com todos os valores zerados porque as cotações de origem foram aprovadas sem ter `valor_estimado` preenchido (e com `tvs_itens` contendo um item "em branco" — sem tamanho/parede/cobertura).

Quando isso acontece, a trigger `criar_servico_ao_confirmar` calcula `valor_total = 0`, `valor_mao_obra_instalador = 0`, `valor_reembolso = 0`.

Provável causa: a cotação foi aprovada (botão **Aprovar** ou **Aprovar sem termo**) antes de o admin escolher tamanho/parede no seletor de TV — o `SelectorPrecoTV` mantém um item vazio inicial e o "valor estimado" não foi calculado.

## Correções

### 1. Corrigir os 2 serviços já existentes
Reabrir o fluxo: o admin precisa abrir cada cotação, preencher tamanho/parede da TV (gerando o valor) e salvar. A trigger `sincronizar_servico_ao_editar_cotacao` recalculará `valor_total`, `valor_mao_obra_instalador` e `valor_reembolso_despesas` no serviço automaticamente.

Para evitar trabalho manual, vou:
- Listar para você os dados conhecidos das duas cotações (descrições já indicam os tamanhos: SRV-255 → TV 32" alvenaria, SRV-246 → estante/quadro alvenaria) para você confirmar/editar.
- Após você confirmar tamanhos/valores, atualizo as cotações via migração de dados, o que dispara a sincronização do serviço.

### 2. Prevenir o problema (validação na aprovação)
Em `src/pages/admin/cotacoes/Lista.tsx`, nos dois botões **Aprovar** e **Aprovar sem termo**:

- Antes de fazer o `update`, validar:
  - `cotacao.valor_estimado > 0`, **ou**
  - `cotacao.tvs_itens` contém pelo menos um item com `tamanho`, `parede` e `valor_mao_obra > 0`.
- Se não passar, exibir toast de erro: *"Preencha o tamanho/parede da TV (ou um valor estimado) antes de aprovar. Use o botão Editar."*
- Botões ficam **desabilitados** com tooltip equivalente quando a cotação não tiver valor.

### 3. Reforço no banco (defesa em profundidade)
Adicionar verificação na trigger `criar_servico_ao_confirmar`: se `valor_estimado IS NULL OR valor_estimado <= 0`, lançar `RAISE EXCEPTION 'Cotação sem valor estimado — preencha antes de aprovar.'`. Isso impede que qualquer outro caminho (ex: edge function de aceite de termo, importação) crie serviços zerados silenciosamente.

## Arquivos afetados

- `src/pages/admin/cotacoes/Lista.tsx` — validação nos botões de aprovação
- Nova migração SQL — atualizar trigger `criar_servico_ao_confirmar` com guarda de valor
- Atualização de dados (via insert tool) das cotações `327d1b39…` e `b529a3bf…` após você confirmar os valores corretos

## Pergunta antes de implementar

Quais valores devo lançar nessas duas cotações para destravar os serviços?

- **SRV-2026-246** (descrição: *"Uma estante e um quadro em parede de alvenaria"*) — não é instalação de TV. Qual `valor_estimado` (mão de obra) e `valor_material`?
- **SRV-2026-255** (descrição: *"TV 32'' em alvenaria — Levar nosso suporte"*) — devo aplicar a tabela de preços (TV 32", alvenaria, suporte da empresa) ou um valor manual?

Me passe os valores e eu já implemento tudo (correção + prevenção) na próxima etapa.