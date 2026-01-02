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
BEGIN
  v_data_inicio := CURRENT_DATE - p_periodo_dias;
  
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
    -- Recency Score: 5(0-30d), 4(31-60d), 3(61-90d), 2(91-180d), 1(>180d)
    CASE 
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 30 THEN 5
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 60 THEN 4
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 90 THEN 3
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 180 THEN 2
      ELSE 1
    END AS recency_score,
    -- Frequency Score: 5(>=6), 4(4-5), 3(2-3), 2(1), 1(0)
    CASE 
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 6 THEN 5
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 4 THEN 4
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 2 THEN 3
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 1 THEN 2
      ELSE 1
    END AS frequency_score,
    -- Monetary Score: 5(>=1800), 4(1200-1799), 3(600-1199), 2(300-599), 1(<300)
    CASE 
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 1800 THEN 5
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 1200 THEN 4
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 600 THEN 3
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 300 THEN 2
      ELSE 1
    END AS monetary_score,
    -- RFM Score concatenado
    'R' || CASE 
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 30 THEN '5'
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 60 THEN '4'
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 90 THEN '3'
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 180 THEN '2'
      ELSE '1'
    END || 'F' || CASE 
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 6 THEN '5'
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 4 THEN '4'
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 2 THEN '3'
      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 1 THEN '2'
      ELSE '1'
    END || 'M' || CASE 
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 1800 THEN '5'
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 1200 THEN '4'
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 600 THEN '3'
      WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 300 THEN '2'
      ELSE '1'
    END AS rfm_score,
    -- Segmento
    CASE 
      -- VIP: R>=4 AND F>=4 AND M>=4
      WHEN (CASE WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 30 THEN 5
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 60 THEN 4
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 90 THEN 3
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 180 THEN 2
                 ELSE 1 END) >= 4
           AND (CASE WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 6 THEN 5
                     WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 4 THEN 4
                     WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 2 THEN 3
                     WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 1 THEN 2
                     ELSE 1 END) >= 4
           AND (CASE WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 1800 THEN 5
                     WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 1200 THEN 4
                     WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 600 THEN 3
                     WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 300 THEN 2
                     ELSE 1 END) >= 4
      THEN 'VIP'
      -- Perdido: R=1 (>180 dias)
      WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) > 180 THEN 'Perdido'
      -- Em Risco: R=2 AND (F>=3 OR M>=3)
      WHEN (CASE WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 30 THEN 5
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 60 THEN 4
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 90 THEN 3
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 180 THEN 2
                 ELSE 1 END) = 2
           AND ((CASE WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 6 THEN 5
                      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 4 THEN 4
                      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 2 THEN 3
                      WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 1 THEN 2
                      ELSE 1 END) >= 3
                OR (CASE WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 1800 THEN 5
                         WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 1200 THEN 4
                         WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 600 THEN 3
                         WHEN COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) >= 300 THEN 2
                         ELSE 1 END) >= 3)
      THEN 'Em Risco'
      -- Ativo: R>=3 AND F>=2
      WHEN (CASE WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 30 THEN 5
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 60 THEN 4
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 90 THEN 3
                 WHEN COALESCE((CURRENT_DATE - MAX(s.data_servico_agendada::date)), 9999) <= 180 THEN 2
                 ELSE 1 END) >= 3
           AND (CASE WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 6 THEN 5
                     WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 4 THEN 4
                     WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 2 THEN 3
                     WHEN COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END) >= 1 THEN 2
                     ELSE 1 END) >= 2
      THEN 'Ativo'
      -- Inativo: R<=2 AND F<=2 AND M<=2
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