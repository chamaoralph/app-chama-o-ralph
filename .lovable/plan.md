

# Termo de Aceite Digital — Envio por WhatsApp e Assinatura Online

## Objetivo
Permitir que o admin envie um termo de aceite por WhatsApp direto da cotação. O cliente abre o link no celular, escolhe a modalidade (Completa ou Colaborativa), lê o termo, assina com o dedo e o aceite fica registrado no sistema.

## Como funciona

### 1. Botão "Enviar Termo" na cotação (modal de edição)
Aparece **só para cotações de Instalação de TV** que já têm cliente, telefone e ao menos um valor preenchido. Estados:
- **Nunca enviado** → "📋 Enviar Termo" (verde)
- **Pendente / Visualizado** → "⏳ Termo Pendente — Reenviar" (âmbar)
- **Aceito** → "✅ Termo Aceito" (verde claro, abre painel de detalhes)

### 2. Modal "Enviar Termo"
Como a cotação não tem ainda campos de TV/CPF, o admin preenche um pequeno form antes de enviar:
- **Marca/Modelo da TV** (texto livre, opcional)
- **Polegadas** (número — pré-preenchido a partir do tamanho_tv da cotação se houver: ex "55")
- **Tipo de TV** (LED / QLED / OLED / The Frame / Outro) — define se Colaborativa fica disponível
- **Valor Modalidade Completa** (R$) — pré-preenchido com valor da cobertura "Total" da tabela de preços
- **Valor Modalidade Colaborativa** (R$) — pré-preenchido com valor da cobertura "Parcial"

Ao confirmar:
1. Cria registro em `termos_aceite` com token curto (8 chars)
2. Abre WhatsApp em nova aba com mensagem pronta + link `https://chamaoralph.lovable.app/aceite/{token}`
3. Toast "Link gerado e WhatsApp aberto"

### 3. Página pública `/aceite/:token` (sem login, mobile-first)
Stepper de 4 etapas:

**Etapa 1 — Modalidade**
Dois cards lado a lado (Completa azul / Colaborativa verde) com valor e principais coberturas. Se TV for OLED, The Frame ou >55", o card Colaborativa fica desabilitado com aviso.

**Etapa 2 — Termo**
Texto completo do termo (hardcoded conforme fornecido), com scroll. Botão "Continuar" só habilita ao rolar até o fim. Indicador "↓ Role para ler" animado some no final.

**Etapa 3 — Assinatura**
- CPF (máscara 000.000.000-00, input `tel`)
- Nome completo
- Canvas de assinatura (`touch-action: none`, "Assine com o dedo aqui", botão Limpar)
- Checkbox de declaração
- Botão "Aceitar e Assinar" só habilita com tudo preenchido

**Etapa 4 — Confirmação**
Tela verde de sucesso, resumo (nome, CPF, modalidade, ID, data/hora), preview da assinatura, botão "Salvar como PDF" (`window.print()`).

Ao acessar: se `status='aceito'` mostra resumo do aceite. Se inválido, tela de erro. Ao abrir pendente, atualiza para `visualizado`.

### 4. Painel "Termo de Aceite" no modal da cotação
Card abaixo do botão mostrando: status, datas (enviado/visualizado/aceito), modalidade escolhida, preview da assinatura, e botões "Reenviar", "Copiar link", "Ver PDF".

## Mudanças

### Banco (1 migration)
- Tabela `termos_aceite` (campos do prompt: cotacao_id, dados cliente snapshot, dados TV, valor_completa, valor_colaborativa, modalidade_escolhida, dados do aceite, token único, status, timestamps)
- RLS:
  - Admin da empresa: ALL nos termos da própria empresa
  - **anon**: SELECT e UPDATE somente quando filtra por `token` (necessário para o cliente assinar sem login). Bloqueio de INSERT/DELETE para anon. Campos sensíveis ficam protegidos pela natureza do token aleatório.
- Índices em `token` e `cotacao_id`

### Código
- **Nova rota pública** `/aceite/:token` em `src/App.tsx` (fora do `ProtectedRoute`)
- **Nova página** `src/pages/AceiteTermo.tsx` (mobile-first, stepper, canvas de assinatura)
- **Novo componente** `src/components/admin/EnviarTermoModal.tsx` (form com dados da TV + valores)
- **Novo componente** `src/components/admin/TermoAceiteCard.tsx` (painel de status no modal de edição)
- **Novo arquivo** `src/lib/termoTexto.ts` (texto completo do termo como constante)
- **Editar** `src/pages/admin/cotacoes/Lista.tsx`: integrar botão "Enviar Termo" e card de status no Dialog de edição quando `ehInstalacaoTV(tipo_servico)` for true

## Detalhes técnicos
- Token: `crypto.randomUUID().split('-')[0]` (8 chars) — colisão improvável, fácil de digitar
- Assinatura: `<canvas>` com handlers `pointerdown/move/up`, exporta `toDataURL('image/png')` salvo como `assinatura_base64` (texto)
- Telefone WhatsApp: normaliza com `replace(/\D/g,'')` e prefixa `55` se faltar
- IP do aceite: omitido (frontend não tem acesso confiável); registramos só `user_agent` e timestamp
- PDF: `window.print()` com CSS `@media print` na página de confirmação (sem dependências novas)
- Validação Colaborativa indisponível: `tipo === 'OLED' || tipo === 'The Frame' || polegadas > 55`
- Inputs com `font-size: 16px` (anti-zoom iOS)
- Sem alterações no fluxo das cotações que não são de TV

