

# PDF Completo do Termo Assinado

## Objetivo
Quando o cliente conclui a assinatura no `/aceite/:token`, gerar **automaticamente um PDF completo e profissional** com todos os dados do termo (cliente, equipamento, modalidade escolhida, valor, texto integral do termo, assinatura e dados de auditoria). O PDF fica disponível para download imediato pelo cliente e acessível no painel admin como prova/garantia jurídica.

## Como funciona

### Fluxo do cliente (página pública)
Hoje a Etapa 4 mostra "Termo aceito!" com um botão "Salvar / Imprimir" que usa `window.print()`. Vamos substituir isso por:
1. Botão **"📄 Baixar PDF do Termo Assinado"** (verde, destaque)
2. Ao clicar, gera o PDF no navegador (sem servidor) com `jsPDF` e dispara o download
3. Mensagem complementar: "Guarde este documento — ele é sua garantia"
4. O PDF é gerado **uma vez** ao abrir a Etapa 4 (auto), salvo no Storage e a URL fica vinculada ao termo. O botão também permite re-download a qualquer momento abrindo o link.

### Fluxo no admin
No `TermoAceiteCard` (modal de edição da cotação), quando o termo está aceito:
- Botão **"📄 Ver PDF"** que abre o PDF salvo no Storage em nova aba
- Se por algum motivo o PDF ainda não foi gerado, botão "Gerar PDF agora" que cria sob demanda

### Conteúdo do PDF (1-2 páginas A4)

**Cabeçalho**
- Nome da empresa (buscado em `empresas`)
- Título: "Termo de Instalação de TV — Aceite Digital"
- ID do aceite + data/hora

**Seção 1 — Dados do Cliente**
- Nome, CPF, telefone, endereço

**Seção 2 — Equipamento**
- Marca/Modelo, Polegadas, Tipo (LED/QLED/OLED/The Frame)

**Seção 3 — Modalidade Contratada**
- Nome da modalidade (Completa ou Colaborativa)
- Valor em destaque
- Resumo das coberturas dessa modalidade

**Seção 4 — Termo Completo**
- Todas as 7 seções do texto (mesmo conteúdo de `TERMO_SECOES`)

**Seção 5 — Aceite e Assinatura**
- Texto do aceite (`TERMO_ACEITE_TEXTO`)
- Imagem da assinatura (do `assinatura_base64`)
- Linha "Assinado por: {nome} — CPF {cpf}"
- Data/hora do aceite
- User-agent (rodapé pequeno, prova técnica)
- Validade conforme MP 2.200-2/2001

**Rodapé em todas as páginas**
- Empresa + ID do termo + paginação ("Página X de Y")

### Onde o PDF fica salvo
Novo bucket público no Storage: `termos-assinados`. Path: `{empresa_id}/{termo_id}.pdf`. URL pública salva em `termos_aceite.pdf_url` (coluna que **já existe**).

### Quando o PDF é gerado
Após a chamada bem-sucedida da edge function `aprovar-cotacao-via-termo`, o front:
1. Gera o PDF localmente com jsPDF (rápido, sem custo de função)
2. Faz upload no bucket `termos-assinados` via cliente Supabase (anon — política permite escrever quando linha do termo está em status `aceito`)
3. Atualiza `termos_aceite.pdf_url`

## Mudanças

### Banco (1 migration)
- Criar bucket `termos-assinados` (público)
- Política de Storage: anon pode INSERT/UPDATE em `termos-assinados/{empresa_id}/...` apenas quando o token está aceito (validação simplificada: permitir INSERT por anon no bucket; arquivo é nomeado pelo termo_id que vem do registro autenticado por token); admins da empresa fazem ALL nos arquivos da própria empresa
- (Coluna `pdf_url` já existe em `termos_aceite`, nada a alterar)

### Dependências
- `jspdf` — geração de PDF no cliente (sem precisar de servidor)

### Frontend
- **Novo arquivo** `src/lib/gerarTermoPDF.ts`: função `gerarTermoPDF(termo, empresa)` que retorna `Blob` do PDF usando `jsPDF`. Lida com quebras de página, embed da assinatura, formatação A4.
- **Editar** `src/pages/AceiteTermo.tsx`:
  - Após confirmar aceite, chamar `gerarTermoPDF`, fazer upload no bucket, atualizar `pdf_url`
  - Etapa 4: substituir "Salvar / Imprimir" por botão "📄 Baixar PDF do Termo Assinado" que abre `pdf_url` (ou regera se ainda não existir)
- **Editar** `src/components/admin/TermoAceiteCard.tsx`:
  - Quando aceito: botão "Ver PDF" abre `pdf_url` em nova aba
  - Se `pdf_url` ausente: botão "Gerar PDF agora" que executa a mesma rotina

## Detalhes técnicos
- jsPDF roda 100% no navegador, sem custo de servidor
- Assinatura é embutida como imagem PNG (já está em base64 no estado)
- Layout A4 com margens de 18mm, fonte Helvetica, tamanho 10-11pt para corpo
- O texto do termo (`TERMO_SECOES`) é a única fonte de verdade — mesmo conteúdo que o cliente leu na Etapa 2
- Idempotente: se `pdf_url` já existe, não regera (a menos que admin force)
- Arquivo nomeado: `termo-{cliente_nome_slug}-{id_curto}.pdf` no download
- Bucket público para evitar lag de signed URLs (mesmo padrão de `fotos-servicos` já em uso no projeto)

