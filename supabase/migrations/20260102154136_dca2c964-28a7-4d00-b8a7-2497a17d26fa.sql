-- Criar tabela de configurações RFM
CREATE TABLE public.configuracoes_rfm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  
  -- Recency thresholds (dias)
  recency_5 INTEGER NOT NULL DEFAULT 30,
  recency_4 INTEGER NOT NULL DEFAULT 60,
  recency_3 INTEGER NOT NULL DEFAULT 90,
  recency_2 INTEGER NOT NULL DEFAULT 180,
  
  -- Frequency thresholds (quantidade de serviços)
  frequency_5 INTEGER NOT NULL DEFAULT 6,
  frequency_4 INTEGER NOT NULL DEFAULT 4,
  frequency_3 INTEGER NOT NULL DEFAULT 2,
  frequency_2 INTEGER NOT NULL DEFAULT 1,
  
  -- Monetary thresholds (R$)
  monetary_5 NUMERIC NOT NULL DEFAULT 1800,
  monetary_4 NUMERIC NOT NULL DEFAULT 1200,
  monetary_3 NUMERIC NOT NULL DEFAULT 600,
  monetary_2 NUMERIC NOT NULL DEFAULT 300,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(empresa_id)
);

-- Enable RLS
ALTER TABLE public.configuracoes_rfm ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins podem ver configurações RFM da empresa"
ON public.configuracoes_rfm
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

CREATE POLICY "Admins podem criar configurações RFM"
ON public.configuracoes_rfm
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

CREATE POLICY "Admins podem atualizar configurações RFM"
ON public.configuracoes_rfm
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

-- Trigger para updated_at
CREATE TRIGGER update_configuracoes_rfm_updated_at
BEFORE UPDATE ON public.configuracoes_rfm
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Atualizar função calculate_rfm para usar configurações personalizadas
CREATE OR REPLACE FUNCTION public.calculate_rfm(p_empresa_id uuid, p_periodo_dias integer DEFAULT 365)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_data_inicio DATE;
  v_clientes_processados INTEGER := 0;
  v_result JSONB;
  -- Configurações RFM (com valores padrão)
  v_recency_5 INTEGER := 30;
  v_recency_4 INTEGER := 60;
  v_recency_3 INTEGER := 90;
  v_recency_2 INTEGER := 180;
  v_frequency_5 INTEGER := 6;
  v_frequency_4 INTEGER := 4;
  v_frequency_3 INTEGER := 2;
  v_frequency_2 INTEGER := 1;
  v_monetary_5 NUMERIC := 1800;
  v_monetary_4 NUMERIC := 1200;
  v_monetary_3 NUMERIC := 600;
  v_monetary_2 NUMERIC := 300;
BEGIN
  v_data_inicio := CURRENT_DATE - p_periodo_dias;
  
  -- Buscar configurações personalizadas da empresa
  SELECT 
    COALESCE(recency_5, 30), COALESCE(recency_4, 60), COALESCE(recency_3, 90), COALESCE(recency_2, 180),
    COALESCE(frequency_5, 6), COALESCE(frequency_4, 4), COALESCE(frequency_3, 2), COALESCE(frequency_2, 1),
    COALESCE(monetary_5, 1800), COALESCE(monetary_4, 1200), COALESCE(monetary_3, 600), COALESCE(monetary_2, 300)
  INTO 
    v_recency_5, v_recency_4, v_recency_3, v_recency_2,
    v_frequency_5, v_frequency_4, v_frequency_3, v_frequency_2,
    v_monetary_5, v_monetary_4, v_monetary_3, v_monetary_2
  FROM configuracoes_rfm
  WHERE empresa_id = p_empresa_id;
  
  -- Deletar cache antigo para este período
  DELETE FROM clientes_rfm_cache 
  WHERE empresa_id = p_empresa_id AND periodo_analise = p_periodo_dias;
  
  -- Inserir novos cálculos RFM
  INSERT INTO clientes_rfm_cache (
    cliente_id, empresa_id, recency_days, frequency_count, monetary_value,
    recency_score, frequency_score, monetary_score, rfm_score, segmento, periodo_analise
  )
  SELECT 
    c.id AS cliente_id,
    c.empresa_id,
    COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) AS recency_days,
    COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END)::INTEGER AS frequency_count,
    COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) AS monetary_value,
    -- Recency Score usando configurações
    CASE 
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_5 THEN 5
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_4 THEN 4
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_3 THEN 3
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_2 THEN 2
      ELSE 1
    END AS recency_score,
    -- Frequency Score usando configurações
    CASE 
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_5 THEN 5
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_4 THEN 4
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_3 THEN 3
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_2 THEN 2
      ELSE 1
    END AS frequency_score,
    -- Monetary Score usando configurações
    CASE 
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_5 THEN 5
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_4 THEN 4
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_3 THEN 3
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_2 THEN 2
      ELSE 1
    END AS monetary_score,
    -- RFM Score concatenado
    'R' || CASE 
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_5 THEN '5'
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_4 THEN '4'
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_3 THEN '3'
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_2 THEN '2'
      ELSE '1'
    END || 'F' || CASE 
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_5 THEN '5'
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_4 THEN '4'
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_3 THEN '3'
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_2 THEN '2'
      ELSE '1'
    END || 'M' || CASE 
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_5 THEN '5'
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_4 THEN '4'
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_3 THEN '3'
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_2 THEN '2'
      ELSE '1'
    END AS rfm_score,
    -- Segmento usando variáveis locais calculadas
    CASE 
      -- VIP: R>=4 AND F>=4 AND M>=4
      WHEN (CASE WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_5 THEN 5
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_4 THEN 4
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_3 THEN 3
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_2 THEN 2
                 ELSE 1 END) >= 4
           AND (CASE WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_5 THEN 5
                     WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_4 THEN 4
                     WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_3 THEN 3
                     WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_2 THEN 2
                     ELSE 1 END) >= 4
           AND (CASE WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_5 THEN 5
                     WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_4 THEN 4
                     WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_3 THEN 3
                     WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_2 THEN 2
                     ELSE 1 END) >= 4
      THEN 'VIP'
      -- Perdido: R=1 (> recency_2 dias)
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) > v_recency_2 THEN 'Perdido'
      -- Em Risco: R=2 AND (F>=3 OR M>=3)
      WHEN (CASE WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_5 THEN 5
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_4 THEN 4
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_3 THEN 3
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_2 THEN 2
                 ELSE 1 END) = 2
           AND ((CASE WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_5 THEN 5
                      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_4 THEN 4
                      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_3 THEN 3
                      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_2 THEN 2
                      ELSE 1 END) >= 3
                OR (CASE WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_5 THEN 5
                         WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_4 THEN 4
                         WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_3 THEN 3
                         WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= v_monetary_2 THEN 2
                         ELSE 1 END) >= 3)
      THEN 'Em Risco'
      -- Ativo: R>=3 AND F>=2
      WHEN (CASE WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_5 THEN 5
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_4 THEN 4
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_3 THEN 3
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= v_recency_2 THEN 2
                 ELSE 1 END) >= 3
           AND (CASE WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_5 THEN 5
                     WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_4 THEN 4
                     WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_3 THEN 3
                     WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= v_frequency_2 THEN 2
                     ELSE 1 END) >= 2
      THEN 'Ativo'
      -- Inativo: default
      ELSE 'Inativo'
    END AS segmento,
    p_periodo_dias AS periodo_analise
  FROM clientes c
  LEFT JOIN servicos s ON s.cliente_id = c.id AND s.empresa_id = c.empresa_id
  WHERE c.empresa_id = p_empresa_id
  GROUP BY c.id, c.empresa_id;
  
  GET DIAGNOSTICS v_clientes_processados = ROW_COUNT;
  
  v_result := jsonb_build_object(
    'success', true,
    'clientes_processados', v_clientes_processados,
    'periodo_dias', p_periodo_dias,
    'data_calculo', now()
  );
  
  RETURN v_result;
END;
$function$;