

# Sincronização Automática: Aceite do Cliente → Cotação Aprovada

## Objetivo
Quando o cliente assina o termo no `/aceite/:token` e escolhe uma modalidade, o sistema deve **automaticamente**:
1. Atualizar a **cobertura** da cotação na "📺 Calculadora de Instalação de TV" (Total se Completa, Parcial se Colaborativa)
2. Recalcular **valor estimado** + **valor mão de obra** com base no novo preço
3. Mudar o **status da cotação para "aprovada"** — disparando a trigger existente que cria o serviço

## Como funciona

### Fluxo atual
- Cliente abre link → escolhe modalidade → assina → `termos_aceite.status = 'aceito'` ✅
- A cotação **não muda nada** ❌

### Novo fluxo
Após salvar o aceite (etapa 3 da página pública), uma **edge function** `aprovar-cotacao-via-termo` é chamada com o token. Ela:

1. Lê o termo aceito (`termos_aceite` por token), valida que `status='aceito'`
2. Pega a cotação vinculada (`cotacao_id`)
3. Mapeia modalidade escolhida → cobertura:
   - `completa` → cobertura **total**
   - `colaborativa` → cobertura **parcial**
4. Busca preço em `precos_instalacao_tv` usando `tamanho_tv`, `tipo_parede` (já salvos na cotação) + nova cobertura
5. Atualiza a cotação:
   - `valor_estimado` = `valor_mao_obra` da tabela
   - `valor_material` = `valor_parafusos`
   - `origem_suporte` + `custo_suporte` conforme `tipo_suporte`
   - `status` = `'aprovada'`
6. A trigger `criar_servico_ao_confirmar` (já existe) detecta status mudando para `aprovada` e cria o serviço automaticamente
7. A trigger `sincronizar_servico_ao_editar_cotacao` mantém os valores em sincronia

### Por quê edge function (e não direto do front)
O cliente que assina é **anônimo (anon)** e não tem permissão de UPDATE em `cotacoes`. A edge function roda com `service_role` e faz a aprovação com segurança, validando antes que o token existe e está aceito.

### Onde ler a cobertura/parede para o cálculo
Hoje a cotação **não armazena** `tamanho_tv`, `tipo_parede`, `cobertura` — esses selectores ficam só em estado local da edição. Para a sincronização funcionar de forma confiável, vamos adicionar 3 colunas opcionais em `cotacoes`:
- `tv_tamanho` (text)
- `tv_parede` (text)
- `tv_cobertura` (text)

Salvas quando o admin usa a calculadora ao criar/editar a cotação. A edge function lê esses campos para recalcular após a escolha da modalidade.

### Painel admin
O `TermoAceiteCard` continua mostrando status. Quando a cotação for aprovada via aceite, o usuário verá no modal a cotação como "Aprovada" e o serviço já criado em Serviços.

## Mudanças

### Banco (1 migration)
- Adicionar `tv_tamanho`, `tv_parede`, `tv_cobertura` em `cotacoes` (nullable)

### Edge function nova
- `supabase/functions/aprovar-cotacao-via-termo/index.ts` — recebe `{ token }`, valida, recalcula preço, atualiza cotação para `aprovada`. Pública (verify_jwt = false) porque é chamada pelo cliente anônimo.

### Frontend
- `src/pages/AceiteTermo.tsx`: após `confirmarAceite` salvar com sucesso, chama a edge function com o token. Mostra mensagem "Pedido confirmado" no sucesso.
- `src/pages/admin/cotacoes/Lista.tsx` e `src/pages/admin/cotacoes/Nova.tsx`: ao salvar a cotação com a calculadora preenchida, persistir `tv_tamanho`, `tv_parede`, `tv_cobertura`.

## Detalhes técnicos
- A trigger `criar_servico_ao_confirmar` cria o serviço quando `status` vira `aprovada` — nada a alterar nela
- Se a nova combinação (parede + nova cobertura) for ND, a edge function ainda aprova a cotação mas mantém os valores originais e retorna aviso (cliente já assinou, não bloqueamos)
- Idempotente: se a cotação já está `aprovada`, a função não faz nada e retorna sucesso
- Sem mudanças no comportamento visual da página de aceite além da chamada extra após salvar

