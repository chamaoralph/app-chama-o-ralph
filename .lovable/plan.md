## Escolher modalidades ao enviar o termo

Hoje o termo sempre inclui as duas modalidades (Completa e Colaborativa). Quando o cliente já decidiu no momento da cotação, o admin poderá restringir o termo a **apenas uma modalidade**.

### Mudanças

**`src/components/admin/EnviarTermoModal.tsx`**
- Adicionar um seletor no topo do modal: **"Modalidades a enviar"** com 3 opções (RadioGroup ou Select):
  1. **Ambas** (padrão — comportamento atual)
  2. **Apenas Completa** (cliente já optou pela instalação completa)
  3. **Apenas Colaborativa** (cliente já optou pela instalação mais simples)
- Ocultar o campo de valor da modalidade que **não** será enviada.
- Validação ao enviar:
  - "Apenas Completa" → exige `valor_completa > 0`; grava `valor_colaborativa = null`.
  - "Apenas Colaborativa" → exige `valor_colaborativa > 0`; grava `valor_completa = null`. Bloquear essa opção se `colabInfo.indisponivel` (TV OLED/The Frame/>55") com aviso explicativo.
  - "Ambas" → comportamento atual.

**`src/pages/AceiteTermo.tsx`**
- Na Etapa 2 (escolha da modalidade):
  - Se `valor_colaborativa == null` → renderizar apenas o card **Completa** e pré-selecionar `modalidade = "completa"`.
  - Se `valor_completa == null` → renderizar apenas o card **Colaborativa** e pré-selecionar `modalidade = "colaborativa"`.
  - Se ambos presentes → layout atual com as duas opções.
- Ajustar o texto de cabeçalho: quando só há uma modalidade, mostrar "Confirme os detalhes da sua instalação" em vez de "Escolha a modalidade".

### Detalhes técnicos

- Nenhuma alteração de banco: `valor_completa` e `valor_colaborativa` já são nullable em `termos_aceite`.
- A edge function `aprovar-cotacao-via-termo` já usa `modalidade_escolhida` para decidir o valor final — sem impacto.
- `gerarTermoPDF.ts` já lê apenas a modalidade escolhida para o PDF — sem impacto.
- O helper `colaborativaIndisponivelLista` continua válido para impedir o envio de "Apenas Colaborativa" quando há TV incompatível.

### Resultado

**Enviar Termo**: admin escolhe entre "Ambas / Só Completa / Só Colaborativa" antes de gerar o link.  
**Tela de Aceite**: cliente vê somente a(s) modalidade(s) enviada(s); se for uma só, ela já vem pré-selecionada e ele segue direto para assinatura.
