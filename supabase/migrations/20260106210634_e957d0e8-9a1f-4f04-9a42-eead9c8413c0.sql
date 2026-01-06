-- Enhance CSV import function with input length limits and max rows check
-- This adds comprehensive input validation to prevent resource exhaustion

CREATE OR REPLACE FUNCTION public.import_clientes_csv(p_dados jsonb, p_arquivo_nome text DEFAULT 'import.csv'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id UUID;
  v_is_admin BOOLEAN;
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
  v_max_rows INTEGER := 10000;  -- Maximum rows limit
  v_max_nome_len INTEGER := 100;
  v_max_bairro_len INTEGER := 100;
  v_max_endereco_len INTEGER := 200;
BEGIN
  -- SECURITY: Get empresa_id from authenticated user (server-side only)
  SELECT empresa_id INTO v_empresa_id
  FROM usuarios
  WHERE id = auth.uid();
  
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'User not found or no company associated';
  END IF;
  
  -- SECURITY: Verify user has admin role
  SELECT has_role(auth.uid(), 'admin'::app_role) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can import clients';
  END IF;

  -- SECURITY: Check total rows to prevent resource exhaustion
  IF jsonb_array_length(p_dados) > v_max_rows THEN
    RAISE EXCEPTION 'Import too large: % rows (max %)', jsonb_array_length(p_dados), v_max_rows;
  END IF;

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
      
      -- SECURITY: Enforce length limits to prevent data quality issues
      IF LENGTH(v_nome) > v_max_nome_len THEN
        v_nome := SUBSTRING(v_nome, 1, v_max_nome_len);
      END IF;
      IF LENGTH(v_bairro) > v_max_bairro_len THEN
        v_bairro := SUBSTRING(v_bairro, 1, v_max_bairro_len);
      END IF;
      IF LENGTH(v_endereco) > v_max_endereco_len THEN
        v_endereco := SUBSTRING(v_endereco, 1, v_max_endereco_len);
      END IF;
      
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
      
      -- Verificar se cliente existe (por telefone) - using server-side empresa_id
      SELECT id INTO v_cliente_existente
      FROM clientes
      WHERE empresa_id = v_empresa_id 
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
        -- Criar novo cliente - using server-side empresa_id
        INSERT INTO clientes (empresa_id, nome, telefone, bairro, endereco_completo, origem_lead)
        VALUES (v_empresa_id, v_nome, v_telefone, NULLIF(v_bairro, ''), NULLIF(v_endereco, ''), 'Importação');
        
        v_novos := v_novos + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros || jsonb_build_object('linha', v_total, 'erro', SQLERRM);
    END;
  END LOOP;
  
  -- Registrar log de importação - using server-side empresa_id
  INSERT INTO importacao_clientes_log (empresa_id, arquivo_nome, total_linhas, novos_clientes, clientes_atualizados, erros)
  VALUES (v_empresa_id, p_arquivo_nome, v_total, v_novos, v_atualizados, v_erros)
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
$function$;