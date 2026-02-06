

## Correção: Lançamento no Caixa na Data Agendada

### Problema Identificado

Quando um instalador finaliza um serviço, o lançamento de receita no caixa está entrando com a **data de hoje** (quando foi finalizado), ao invés da **data em que o serviço estava agendado**.

Exemplo encontrado:
- **SRV-2026-067**: agendado para 27/01/2026, mas entrou no caixa em 06/02/2026

Isso acontece porque o trigger `registrar_no_caixa_ao_aprovar` usa `CURRENT_DATE` para definir a data do lançamento.

### Dados Afetados

Encontrei 10 lançamentos com datas incorretas nos últimos registros:
- SRV-2026-067: agendado 27/01, lançado 06/02
- SRV-2026-077: agendado 29/01, lançado 06/02
- SRV-2026-065: agendado 28/01, lançado 06/02
- SRV-2026-074: agendado 31/01, lançado 06/02
- E outros...

---

### Solução em 2 Partes

**Parte 1: Corrigir o trigger para usar a data agendada**

Alterar o trigger para usar `NEW.data_servico_agendada::date` no lugar de `CURRENT_DATE`:

```sql
CREATE OR REPLACE FUNCTION public.registrar_no_caixa_ao_aprovar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status <> 'concluido') THEN

    -- Receita do servico - agora usa data_servico_agendada
    INSERT INTO public.lancamentos_caixa (
      empresa_id, servico_id, tipo, categoria, descricao, valor, data_lancamento, forma_pagamento
    ) VALUES (
      NEW.empresa_id, 
      NEW.id, 
      'receita', 
      'Receita de Servico',
      'Receita do servico ' || NEW.codigo, 
      NEW.valor_total, 
      NEW.data_servico_agendada::date,  -- CORRIGIDO: usa data agendada
      'Pix'
    )
    ON CONFLICT (servico_id, tipo, categoria) DO NOTHING;

  END IF;

  RETURN NEW;
END;
$function$;
```

**Parte 2: Corrigir lançamentos existentes com datas erradas**

```sql
UPDATE lancamentos_caixa l
SET data_lancamento = s.data_servico_agendada::date
FROM servicos s
WHERE l.servico_id = s.id
  AND l.categoria = 'Receita de Servico'
  AND l.data_lancamento != s.data_servico_agendada::date;
```

---

### Resultado Esperado

- O serviço SRV-2026-067 passará a aparecer no caixa do dia 27/01/2026
- Todos os serviços futuros entrarão no caixa na data correta (data agendada)
- O relatório de caixa refletirá a receita no dia em que o serviço estava programado

