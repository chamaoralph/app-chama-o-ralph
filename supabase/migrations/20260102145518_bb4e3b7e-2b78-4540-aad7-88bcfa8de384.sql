-- Tabela de cache RFM para clientes
CREATE TABLE public.clientes_rfm_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  recency_days INTEGER NOT NULL DEFAULT 9999,
  frequency_count INTEGER NOT NULL DEFAULT 0,
  monetary_value NUMERIC NOT NULL DEFAULT 0,
  recency_score INTEGER NOT NULL DEFAULT 1,
  frequency_score INTEGER NOT NULL DEFAULT 1,
  monetary_score INTEGER NOT NULL DEFAULT 1,
  rfm_score TEXT NOT NULL DEFAULT 'R1F1M1',
  segmento TEXT NOT NULL DEFAULT 'Inativo',
  periodo_analise INTEGER NOT NULL DEFAULT 365,
  ultima_atualizacao TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_id, periodo_analise)
);

-- Tabela de log de importação de clientes
CREATE TABLE public.importacao_clientes_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  arquivo_nome TEXT NOT NULL,
  total_linhas INTEGER NOT NULL DEFAULT 0,
  novos_clientes INTEGER NOT NULL DEFAULT 0,
  clientes_atualizados INTEGER NOT NULL DEFAULT 0,
  erros JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_clientes_rfm_cache_empresa ON public.clientes_rfm_cache(empresa_id);
CREATE INDEX idx_clientes_rfm_cache_segmento ON public.clientes_rfm_cache(segmento);
CREATE INDEX idx_clientes_rfm_cache_cliente_periodo ON public.clientes_rfm_cache(cliente_id, periodo_analise);
CREATE INDEX idx_importacao_clientes_log_empresa ON public.importacao_clientes_log(empresa_id);

-- RLS para clientes_rfm_cache
ALTER TABLE public.clientes_rfm_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver RFM da empresa"
ON public.clientes_rfm_cache
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

CREATE POLICY "Admins podem gerenciar RFM da empresa"
ON public.clientes_rfm_cache
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

-- RLS para importacao_clientes_log
ALTER TABLE public.importacao_clientes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver logs de importação da empresa"
ON public.importacao_clientes_log
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

CREATE POLICY "Admins podem criar logs de importação"
ON public.importacao_clientes_log
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND empresa_id IN (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

-- Função para calcular RFM
CREATE OR REPLACE FUNCTION public.calculate_rfm(p_empresa_id UUID, p_periodo_dias INTEGER DEFAULT 365)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) AS recency_days,
    COUNT(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN 1 END)::INTEGER AS frequency_count,
    COALESCE(SUM(CASE WHEN s.status = 'concluido' AND s.data_servico_agendada >= v_data_inicio THEN s.valor_total ELSE 0 END), 0) AS monetary_value,
    -- Recency Score: 5(0-30d), 4(31-60d), 3(61-90d), 2(91-180d), 1(>180d)
    CASE 
      WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 30 THEN 5
      WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 60 THEN 4
      WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 90 THEN 3
      WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 180 THEN 2
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
      WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 30 THEN '5'
      WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 60 THEN '4'
      WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 90 THEN '3'
      WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 180 THEN '2'
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
      WHEN (CASE WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 30 THEN 5
                 WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 60 THEN 4
                 WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 90 THEN 3
                 WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 180 THEN 2
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
      WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) > 180 THEN 'Perdido'
      -- Em Risco: R=2 AND (F>=3 OR M>=3)
      WHEN (CASE WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 30 THEN 5
                 WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 60 THEN 4
                 WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 90 THEN 3
                 WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 180 THEN 2
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
      WHEN (CASE WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 30 THEN 5
                 WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 60 THEN 4
                 WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 90 THEN 3
                 WHEN COALESCE(EXTRACT(DAY FROM CURRENT_DATE - MAX(s.data_servico_agendada::date))::INTEGER, 9999) <= 180 THEN 2
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
$$;

-- Função para importar clientes via CSV
CREATE OR REPLACE FUNCTION public.import_clientes_csv(p_empresa_id UUID, p_dados JSONB, p_arquivo_nome TEXT DEFAULT 'import.csv')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_telefone TEXT;
  v_nome TEXT;
  v_bairro TEXT;
  v_endereco TEXT;
  v_cliente_existente UUID;
  v_novos INTEGER := 0;
  v_atualizados INTEGER := 0;
  v_erros JSONB := '[]'::jsonb;
  v_total INTEGER := 0;
  v_log_id UUID;
BEGIN
  -- Iterar sobre cada item do array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_dados)
  LOOP
    v_total := v_total + 1;
    
    BEGIN
      -- Extrair e normalizar dados
      v_nome := TRIM(v_item->>'nome');
      v_telefone := REGEXP_REPLACE(TRIM(COALESCE(v_item->>'telefone', '')), '[^0-9]', '', 'g');
      v_bairro := TRIM(COALESCE(v_item->>'bairro', ''));
      v_endereco := TRIM(COALESCE(v_item->>'endereco', ''));
      
      -- Validar telefone
      IF v_telefone IS NULL OR LENGTH(v_telefone) < 10 THEN
        v_erros := v_erros || jsonb_build_object('linha', v_total, 'erro', 'Telefone inválido: ' || COALESCE(v_item->>'telefone', 'vazio'));
        CONTINUE;
      END IF;
      
      -- Validar nome
      IF v_nome IS NULL OR v_nome = '' THEN
        v_erros := v_erros || jsonb_build_object('linha', v_total, 'erro', 'Nome vazio');
        CONTINUE;
      END IF;
      
      -- Verificar se cliente existe (por telefone)
      SELECT id INTO v_cliente_existente
      FROM clientes
      WHERE empresa_id = p_empresa_id 
        AND REGEXP_REPLACE(telefone, '[^0-9]', '', 'g') = v_telefone
      LIMIT 1;
      
      IF v_cliente_existente IS NOT NULL THEN
        -- Atualizar cliente existente
        UPDATE clientes
        SET 
          nome = COALESCE(NULLIF(v_nome, ''), nome),
          bairro = COALESCE(NULLIF(v_bairro, ''), bairro),
          endereco_completo = COALESCE(NULLIF(v_endereco, ''), endereco_completo),
          updated_at = now()
        WHERE id = v_cliente_existente;
        
        v_atualizados := v_atualizados + 1;
      ELSE
        -- Criar novo cliente
        INSERT INTO clientes (empresa_id, nome, telefone, bairro, endereco_completo, origem_lead)
        VALUES (p_empresa_id, v_nome, v_telefone, NULLIF(v_bairro, ''), NULLIF(v_endereco, ''), 'Importação');
        
        v_novos := v_novos + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros || jsonb_build_object('linha', v_total, 'erro', SQLERRM);
    END;
  END LOOP;
  
  -- Registrar log de importação
  INSERT INTO importacao_clientes_log (empresa_id, arquivo_nome, total_linhas, novos_clientes, clientes_atualizados, erros)
  VALUES (p_empresa_id, p_arquivo_nome, v_total, v_novos, v_atualizados, v_erros)
  RETURNING id INTO v_log_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'total_linhas', v_total,
    'novos_clientes', v_novos,
    'clientes_atualizados', v_atualizados,
    'erros', v_erros
  );
END;
$$;