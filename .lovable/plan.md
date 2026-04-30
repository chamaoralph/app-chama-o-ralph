## Substituir `confirm()` nativo por AlertDialog estilizado

**Problema:** Ao clicar em "Aprovar sem termo", aparece um popup do navegador com texto em negrito mostrando "An embedded page at ...lovableproject.com says" — é o `window.confirm()` padrão, que é feio e não combina com o design do app.

**Solução:** Trocar o `confirm()` por um `AlertDialog` (do shadcn/ui), que já está importado no arquivo e segue o design system do projeto.

### Mudanças em `src/pages/admin/cotacoes/Lista.tsx`

1. **Adicionar state** para controlar o dialog:
   ```ts
   const [cotacaoParaAprovarSemTermo, setCotacaoParaAprovarSemTermo] = 
     useState<{ id: string; clienteTemTermo: boolean } | null>(null)
   ```

2. **Substituir o `onClick`** do botão "Aprovar sem termo" para apenas abrir o dialog (em vez de chamar `confirm()`).

3. **Adicionar um `<AlertDialog>`** no final da página, com:
   - **Título:** "Aprovar sem termo de aceite?"
   - **Descrição dinâmica:**
     - Se cliente nunca assinou: "⚠️ Esse cliente NUNCA assinou um termo. Deseja prosseguir e liberar o serviço sem termo assinado?"
     - Se já assinou antes: "O serviço será liberado imediatamente para os instaladores, sem exigir assinatura digital do cliente."
   - **Botões:** "Cancelar" e "Sim, aprovar" (verde)
   - Ao confirmar: faz o `update` para `status: 'aprovada'`, mostra toast e recarrega.

### Resultado
O popup feio do navegador desaparece. Em vez dele, abre um modal elegante, centralizado, com a mesma cara dos outros modais do sistema (igual ao de excluir cotação).