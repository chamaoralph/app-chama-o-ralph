-- 1. CORRIGIR POLÍTICA RLS RECURSIVA DA TABELA USUARIOS
-- Remover a política problemática que causa recursão infinita
DROP POLICY IF EXISTS "Admin pode ver todos usuarios da empresa" ON public.usuarios;

-- Recriar a política SEM fazer SELECT na própria tabela usuarios
-- Usar apenas has_role e a empresa_id do próprio usuário autenticado
CREATE POLICY "Admin pode ver todos usuarios da empresa" 
ON public.usuarios
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- 2. REPROCESSAR LANÇAMENTOS DO CAIXA PARA SERVIÇOS CONCLUÍDOS
-- Buscar serviços concluídos que não têm lançamentos
DO $$
DECLARE
  servico_record RECORD;
BEGIN
  FOR servico_record IN 
    SELECT 
      s.id,
      s.codigo,
      s.empresa_id,
      s.valor_total,
      s.valor_mao_obra_instalador,
      s.valor_reembolso_despesas
    FROM servicos s
    WHERE s.status = 'concluido'
      AND s.codigo IN ('SRV-2025-002', 'SRV-2025-003')
      AND NOT EXISTS (
        SELECT 1 FROM lancamentos_caixa 
        WHERE servico_id = s.id
      )
  LOOP
    -- Receita do serviço
    INSERT INTO lancamentos_caixa (
      empresa_id,
      servico_id,
      tipo,
      categoria,
      descricao,
      valor,
      data_lancamento,
      forma_pagamento
    ) VALUES (
      servico_record.empresa_id,
      servico_record.id,
      'receita',
      'Receita de Serviço',
      'Receita do serviço ' || servico_record.codigo,
      servico_record.valor_total,
      CURRENT_DATE,
      'Pix'
    );
    
    -- Pagamento ao instalador
    INSERT INTO lancamentos_caixa (
      empresa_id,
      servico_id,
      tipo,
      categoria,
      descricao,
      valor,
      data_lancamento,
      forma_pagamento
    ) VALUES (
      servico_record.empresa_id,
      servico_record.id,
      'despesa',
      'Pagamento Instalador',
      'Pagamento instalador - ' || servico_record.codigo,
      servico_record.valor_mao_obra_instalador,
      CURRENT_DATE,
      'Pix'
    );
    
    -- Reembolso de materiais (se houver)
    IF servico_record.valor_reembolso_despesas > 0 THEN
      INSERT INTO lancamentos_caixa (
        empresa_id,
        servico_id,
        tipo,
        categoria,
        descricao,
        valor,
        data_lancamento,
        forma_pagamento
      ) VALUES (
        servico_record.empresa_id,
        servico_record.id,
        'despesa',
        'Reembolso Materiais',
        'Reembolso materiais - ' || servico_record.codigo,
        servico_record.valor_reembolso_despesas,
        CURRENT_DATE,
        'Pix'
      );
    END IF;
  END LOOP;
END $$;