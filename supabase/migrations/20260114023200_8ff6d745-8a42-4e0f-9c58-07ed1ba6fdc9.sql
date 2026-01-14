-- Fix 1: Add 'correcao_solicitada' status to servicos constraint
ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_status_check;
ALTER TABLE public.servicos ADD CONSTRAINT servicos_status_check 
CHECK (status = ANY (ARRAY['disponivel'::text, 'solicitado'::text, 'atribuido'::text, 'em_andamento'::text, 'concluido'::text, 'cancelado'::text, 'aguardando_distribuicao'::text, 'aguardando_aprovacao'::text, 'correcao_solicitada'::text]));

-- Fix 2: Add observacoes_instalador length constraint
ALTER TABLE public.servicos 
ADD CONSTRAINT observacoes_instalador_max_length 
CHECK (char_length(observacoes_instalador) <= 500);

-- Fix 3: Secure calculate_rfm function - derive empresa_id from auth and add admin check
CREATE OR REPLACE FUNCTION public.calculate_rfm(
  p_periodo_dias INTEGER DEFAULT 365
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_data_inicio DATE;
  v_clientes_processados INTEGER := 0;
  v_config RECORD;
BEGIN
  -- Get empresa_id from authenticated user (server-side only)
  SELECT empresa_id INTO v_empresa_id
  FROM usuarios
  WHERE id = auth.uid();
  
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'User not found or no company associated';
  END IF;
  
  -- Verify user has admin role
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can calculate RFM';
  END IF;
  
  v_data_inicio := CURRENT_DATE - p_periodo_dias;
  
  -- Get RFM configuration for the company
  SELECT * INTO v_config
  FROM configuracoes_rfm
  WHERE empresa_id = v_empresa_id;
  
  -- If no config exists, use defaults
  IF v_config IS NULL THEN
    v_config.recency_5 := 30;
    v_config.recency_4 := 60;
    v_config.recency_3 := 90;
    v_config.recency_2 := 180;
    v_config.frequency_5 := 6;
    v_config.frequency_4 := 4;
    v_config.frequency_3 := 2;
    v_config.frequency_2 := 1;
    v_config.monetary_5 := 1800;
    v_config.monetary_4 := 1200;
    v_config.monetary_3 := 600;
    v_config.monetary_2 := 300;
  END IF;
  
  -- Delete old cache for this empresa and periodo
  DELETE FROM clientes_rfm_cache 
  WHERE empresa_id = v_empresa_id AND periodo_analise = p_periodo_dias;
  
  -- Insert new RFM calculations
  INSERT INTO clientes_rfm_cache (
    cliente_id,
    empresa_id,
    recency_days,
    frequency_count,
    monetary_value,
    recency_score,
    frequency_score,
    monetary_score,
    rfm_score,
    segmento,
    periodo_analise
  )
  SELECT 
    c.id,
    c.empresa_id,
    COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) as recency_days,
    COUNT(s.id)::INTEGER as frequency_count,
    COALESCE(SUM(s.valor_total), 0) as monetary_value,
    CASE 
      WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_5 THEN 5
      WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_4 THEN 4
      WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_3 THEN 3
      WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_2 THEN 2
      ELSE 1
    END as recency_score,
    CASE 
      WHEN COUNT(s.id) >= v_config.frequency_5 THEN 5
      WHEN COUNT(s.id) >= v_config.frequency_4 THEN 4
      WHEN COUNT(s.id) >= v_config.frequency_3 THEN 3
      WHEN COUNT(s.id) >= v_config.frequency_2 THEN 2
      ELSE 1
    END as frequency_score,
    CASE 
      WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_5 THEN 5
      WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_4 THEN 4
      WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_3 THEN 3
      WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_2 THEN 2
      ELSE 1
    END as monetary_score,
    'R' || CASE 
      WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_5 THEN '5'
      WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_4 THEN '4'
      WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_3 THEN '3'
      WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_2 THEN '2'
      ELSE '1'
    END || 'F' || CASE 
      WHEN COUNT(s.id) >= v_config.frequency_5 THEN '5'
      WHEN COUNT(s.id) >= v_config.frequency_4 THEN '4'
      WHEN COUNT(s.id) >= v_config.frequency_3 THEN '3'
      WHEN COUNT(s.id) >= v_config.frequency_2 THEN '2'
      ELSE '1'
    END || 'M' || CASE 
      WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_5 THEN '5'
      WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_4 THEN '4'
      WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_3 THEN '3'
      WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_2 THEN '2'
      ELSE '1'
    END as rfm_score,
    CASE 
      WHEN (
        CASE 
          WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_5 THEN 5
          WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_4 THEN 4
          WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_3 THEN 3
          WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_2 THEN 2
          ELSE 1
        END +
        CASE 
          WHEN COUNT(s.id) >= v_config.frequency_5 THEN 5
          WHEN COUNT(s.id) >= v_config.frequency_4 THEN 4
          WHEN COUNT(s.id) >= v_config.frequency_3 THEN 3
          WHEN COUNT(s.id) >= v_config.frequency_2 THEN 2
          ELSE 1
        END +
        CASE 
          WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_5 THEN 5
          WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_4 THEN 4
          WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_3 THEN 3
          WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_2 THEN 2
          ELSE 1
        END
      ) >= 13 THEN 'VIP'
      WHEN (
        CASE 
          WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_5 THEN 5
          WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_4 THEN 4
          WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_3 THEN 3
          WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_2 THEN 2
          ELSE 1
        END +
        CASE 
          WHEN COUNT(s.id) >= v_config.frequency_5 THEN 5
          WHEN COUNT(s.id) >= v_config.frequency_4 THEN 4
          WHEN COUNT(s.id) >= v_config.frequency_3 THEN 3
          WHEN COUNT(s.id) >= v_config.frequency_2 THEN 2
          ELSE 1
        END +
        CASE 
          WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_5 THEN 5
          WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_4 THEN 4
          WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_3 THEN 3
          WHEN COALESCE(SUM(s.valor_total), 0) >= v_config.monetary_2 THEN 2
          ELSE 1
        END
      ) >= 10 THEN 'Ativo'
      WHEN (
        CASE 
          WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_5 THEN 5
          WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_4 THEN 4
          WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_3 THEN 3
          WHEN COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - MAX(s.data_servico_agendada::date)))::INTEGER, 9999) <= v_config.recency_2 THEN 2
          ELSE 1
        END
      ) >= 3 THEN 'Em Risco'
      WHEN COUNT(s.id) = 0 THEN 'Inativo'
      ELSE 'Perdido'
    END as segmento,
    p_periodo_dias
  FROM clientes c
  LEFT JOIN servicos s ON s.cliente_id = c.id 
    AND s.status = 'concluido'
    AND s.data_servico_agendada >= v_data_inicio
  WHERE c.empresa_id = v_empresa_id
    AND c.ativo = true
  GROUP BY c.id, c.empresa_id;
  
  GET DIAGNOSTICS v_clientes_processados = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'clientes_processados', v_clientes_processados,
    'periodo_dias', p_periodo_dias,
    'empresa_id', v_empresa_id
  );
END;
$$;