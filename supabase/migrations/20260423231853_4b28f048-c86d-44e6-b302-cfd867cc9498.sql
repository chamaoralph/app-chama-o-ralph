
-- 1. Função auxiliar de normalização (remove não-numéricos e prefixo 55 BR)
CREATE OR REPLACE FUNCTION public.normalizar_telefone_br(p_telefone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_clean text;
BEGIN
  v_clean := regexp_replace(COALESCE(p_telefone, ''), '[^0-9]', '', 'g');
  -- Se tiver 12 ou 13 dígitos e começar com 55, remove o 55
  IF length(v_clean) IN (12, 13) AND left(v_clean, 2) = '55' THEN
    v_clean := substring(v_clean from 3);
  END IF;
  RETURN v_clean;
END;
$$;

-- 2. Atualizar trigger de normalização da tabela clientes
CREATE OR REPLACE FUNCTION public.normalizar_telefone_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.telefone := public.normalizar_telefone_br(NEW.telefone);
  RETURN NEW;
END;
$$;

-- 3. Mesclar duplicatas existentes (mantém o mais antigo)
DO $$
DECLARE
  v_grupo RECORD;
  v_principal_id uuid;
  v_dup_ids uuid[];
BEGIN
  FOR v_grupo IN
    SELECT 
      empresa_id,
      public.normalizar_telefone_br(telefone) AS tel_norm,
      array_agg(id ORDER BY created_at ASC) AS ids
    FROM public.clientes
    WHERE telefone IS NOT NULL AND telefone <> ''
    GROUP BY empresa_id, public.normalizar_telefone_br(telefone)
    HAVING count(*) > 1
  LOOP
    v_principal_id := v_grupo.ids[1];
    v_dup_ids := v_grupo.ids[2:];

    -- Repontar registros vinculados para o cliente principal
    UPDATE public.cotacoes SET cliente_id = v_principal_id WHERE cliente_id = ANY(v_dup_ids);
    UPDATE public.servicos SET cliente_id = v_principal_id WHERE cliente_id = ANY(v_dup_ids);
    UPDATE public.avaliacoes SET cliente_id = v_principal_id WHERE cliente_id = ANY(v_dup_ids);
    DELETE FROM public.clientes_rfm_cache WHERE cliente_id = ANY(v_dup_ids);

    -- Excluir os duplicados
    DELETE FROM public.clientes WHERE id = ANY(v_dup_ids);
  END LOOP;
END $$;

-- 4. Normalizar telefones já existentes para o novo padrão
UPDATE public.clientes
SET telefone = public.normalizar_telefone_br(telefone)
WHERE telefone IS DISTINCT FROM public.normalizar_telefone_br(telefone);

-- 5. Atualizar criar_cotacao_whatsapp_atomic para usar a normalização padronizada
CREATE OR REPLACE FUNCTION public.criar_cotacao_whatsapp_atomic(p_empresa_id uuid, p_cliente_nome text, p_cliente_telefone text, p_cliente_endereco text DEFAULT NULL::text, p_cliente_bairro text DEFAULT NULL::text, p_cliente_cep text DEFAULT NULL::text, p_tipo_servico text[] DEFAULT NULL::text[], p_descricao text DEFAULT NULL::text, p_valor_estimado numeric DEFAULT NULL::numeric, p_data_servico_desejada date DEFAULT NULL::date, p_horario_inicio time without time zone DEFAULT NULL::time without time zone, p_horario_fim time without time zone DEFAULT NULL::time without time zone, p_origem_lead text DEFAULT NULL::text, p_ocasiao text DEFAULT NULL::text, p_observacoes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_telefone_limpo text;
  v_cliente_id uuid;
  v_cliente_nome text;
  v_cliente_novo boolean := false;
  v_cotacao_existente record;
  v_servico_recente record;
  v_cotacao_ativa record;
  v_cotacao_id uuid;
  v_tipos_servico text[];
  v_valor_estimado numeric;
  v_origem_lead_cotacao text;
BEGIN
  v_cliente_nome := left(trim(coalesce(p_cliente_nome, '')), 100);
  v_telefone_limpo := public.normalizar_telefone_br(p_cliente_telefone);

  IF v_cliente_nome = '' THEN
    RAISE EXCEPTION 'Campo cliente.nome é obrigatório';
  END IF;

  IF v_telefone_limpo = '' THEN
    RAISE EXCEPTION 'Campo cliente.telefone é obrigatório';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_empresa_id::text), hashtext(v_telefone_limpo));

  IF EXISTS (
    SELECT 1
    FROM public.telefones_bloqueados tb
    WHERE tb.empresa_id = p_empresa_id
      AND public.normalizar_telefone_br(tb.telefone) = v_telefone_limpo
  ) THEN
    RETURN jsonb_build_object(
      'sucesso', true,
      'bloqueado', true,
      'mensagem', 'Telefone está na lista de bloqueio. Nenhuma cotação criada.'
    );
  END IF;

  INSERT INTO public.clientes (
    empresa_id, nome, telefone, endereco_completo, bairro, cep, origem_lead, ativo
  )
  VALUES (
    p_empresa_id,
    v_cliente_nome,
    v_telefone_limpo,
    NULLIF(left(trim(coalesce(p_cliente_endereco, '')), 200), ''),
    NULLIF(left(trim(coalesce(p_cliente_bairro, '')), 100), ''),
    NULLIF(left(regexp_replace(coalesce(p_cliente_cep, ''), '\D', '', 'g'), 8), ''),
    COALESCE(NULLIF(left(trim(coalesce(p_origem_lead, '')), 50), ''), 'WhatsApp'),
    true
  )
  ON CONFLICT (empresa_id, telefone)
  DO NOTHING
  RETURNING id INTO v_cliente_id;

  IF v_cliente_id IS NULL THEN
    SELECT c.id, c.nome
    INTO v_cliente_id, v_cliente_nome
    FROM public.clientes c
    WHERE c.empresa_id = p_empresa_id
      AND c.telefone = v_telefone_limpo
    LIMIT 1;
  ELSE
    v_cliente_novo := true;
  END IF;

  SELECT c.id, c.created_at, c.status
  INTO v_cotacao_ativa
  FROM public.cotacoes c
  WHERE c.empresa_id = p_empresa_id
    AND c.cliente_id = v_cliente_id
    AND c.status IN ('pendente', 'aprovada')
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'sucesso', true,
      'cliente_id', v_cliente_id,
      'cotacao_id', v_cotacao_ativa.id,
      'cliente_novo', v_cliente_novo,
      'cotacao_existente', true,
      'mensagem', format(
        'Cliente já tem cotação ativa (status: %s, criada em %s). Nenhuma duplicata criada.',
        v_cotacao_ativa.status,
        v_cotacao_ativa.created_at
      )
    );
  END IF;

  SELECT s.id, s.status, s.updated_at
  INTO v_servico_recente
  FROM public.servicos s
  WHERE s.empresa_id = p_empresa_id
    AND s.cliente_id = v_cliente_id
    AND s.status IN ('concluido', 'aguardando_aprovacao')
    AND s.updated_at >= now() - interval '3 days'
  ORDER BY s.updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'sucesso', true,
      'cliente_id', v_cliente_id,
      'servico_recente', true,
      'cliente_novo', v_cliente_novo,
      'cotacao_existente', false,
      'mensagem', format(
        'Cliente tem serviço recente (status: %s, atualizado em %s). Nenhuma cotação criada.',
        v_servico_recente.status,
        v_servico_recente.updated_at
      )
    );
  END IF;

  SELECT c.id, c.created_at, c.status
  INTO v_cotacao_existente
  FROM public.cotacoes c
  WHERE c.empresa_id = p_empresa_id
    AND c.cliente_id = v_cliente_id
    AND c.created_at >= now() - interval '48 hours'
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'sucesso', true,
      'cliente_id', v_cliente_id,
      'cotacao_id', v_cotacao_existente.id,
      'cliente_novo', v_cliente_novo,
      'cotacao_existente', true,
      'mensagem', format(
        '✅ Cotação pendente já existe para este cliente (criada em %s). Nenhuma duplicata criada.',
        v_cotacao_existente.created_at
      )
    );
  END IF;

  v_tipos_servico := ARRAY(
    SELECT item
    FROM unnest(COALESCE(p_tipo_servico, ARRAY['A definir'])) AS item
    WHERE item IS NOT NULL AND btrim(item) <> ''
    LIMIT 10
  );

  IF COALESCE(array_length(v_tipos_servico, 1), 0) = 0 THEN
    v_tipos_servico := ARRAY['A definir'];
  END IF;

  v_tipos_servico := ARRAY(
    SELECT left(btrim(item), 50)
    FROM unnest(v_tipos_servico) AS item
  );

  v_valor_estimado := CASE
    WHEN p_valor_estimado IS NOT NULL AND p_valor_estimado > 0 THEN LEAST(p_valor_estimado, 1000000)
    ELSE NULL
  END;

  v_origem_lead_cotacao := COALESCE(NULLIF(left(trim(coalesce(p_origem_lead, '')), 50), ''), 'WhatsApp Auto');

  INSERT INTO public.cotacoes (
    empresa_id, cliente_id, tipo_servico, descricao_servico, valor_estimado,
    data_servico_desejada, horario_inicio, horario_fim, origem_lead,
    ocasiao, observacoes, status
  )
  VALUES (
    p_empresa_id,
    v_cliente_id,
    v_tipos_servico,
    NULLIF(left(trim(coalesce(p_descricao, '')), 1000), ''),
    v_valor_estimado,
    p_data_servico_desejada,
    p_horario_inicio,
    p_horario_fim,
    v_origem_lead_cotacao,
    NULLIF(left(trim(coalesce(p_ocasiao, '')), 100), ''),
    NULLIF(left(trim(coalesce(p_observacoes, '')), 500), ''),
    'pendente'
  )
  RETURNING id INTO v_cotacao_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'cliente_id', v_cliente_id,
    'cotacao_id', v_cotacao_id,
    'cliente_novo', v_cliente_novo,
    'cotacao_existente', false,
    'mensagem', format(
      '✅ Cotação criada com sucesso! %s',
      CASE WHEN v_cliente_novo THEN 'Novo cliente cadastrado.' ELSE 'Cliente já existente.' END
    )
  );
END;
$function$;

-- 6. Atualizar import_clientes_csv (versão sem empresa_id) para normalizar igual
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
  v_max_rows INTEGER := 10000;
  v_max_nome_len INTEGER := 100;
  v_max_bairro_len INTEGER := 100;
  v_max_endereco_len INTEGER := 200;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM usuarios WHERE id = auth.uid();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'User not found or no company associated';
  END IF;

  SELECT has_role(auth.uid(), 'admin'::app_role) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can import clients';
  END IF;

  IF jsonb_array_length(p_dados) > v_max_rows THEN
    RAISE EXCEPTION 'Import too large: % rows (max %)', jsonb_array_length(p_dados), v_max_rows;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_dados)
  LOOP
    v_total := v_total + 1;
    BEGIN
      v_nome := TRIM(v_item->>'nome');
      v_telefone := public.normalizar_telefone_br(v_item->>'telefone');
      v_bairro := TRIM(COALESCE(v_item->>'bairro', ''));
      v_endereco := TRIM(COALESCE(v_item->>'endereco', ''));

      IF LENGTH(v_nome) > v_max_nome_len THEN v_nome := SUBSTRING(v_nome, 1, v_max_nome_len); END IF;
      IF LENGTH(v_bairro) > v_max_bairro_len THEN v_bairro := SUBSTRING(v_bairro, 1, v_max_bairro_len); END IF;
      IF LENGTH(v_endereco) > v_max_endereco_len THEN v_endereco := SUBSTRING(v_endereco, 1, v_max_endereco_len); END IF;

      IF v_telefone IS NULL OR LENGTH(v_telefone) < 10 THEN
        v_erros := v_erros || jsonb_build_object('linha', v_total, 'erro', 'Telefone inválido: ' || COALESCE(v_item->>'telefone', 'vazio'));
        CONTINUE;
      END IF;

      IF v_nome IS NULL OR v_nome = '' THEN
        v_erros := v_erros || jsonb_build_object('linha', v_total, 'erro', 'Nome vazio');
        CONTINUE;
      END IF;

      SELECT id INTO v_cliente_existente
      FROM clientes
      WHERE empresa_id = v_empresa_id 
        AND public.normalizar_telefone_br(telefone) = v_telefone
      LIMIT 1;

      IF v_cliente_existente IS NOT NULL THEN
        UPDATE clientes
        SET nome = COALESCE(NULLIF(v_nome, ''), nome),
            bairro = COALESCE(NULLIF(v_bairro, ''), bairro),
            endereco_completo = COALESCE(NULLIF(v_endereco, ''), endereco_completo),
            updated_at = now()
        WHERE id = v_cliente_existente;
        v_atualizados := v_atualizados + 1;
      ELSE
        INSERT INTO clientes (empresa_id, nome, telefone, bairro, endereco_completo, origem_lead)
        VALUES (v_empresa_id, v_nome, v_telefone, NULLIF(v_bairro, ''), NULLIF(v_endereco, ''), 'Importação');
        v_novos := v_novos + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros || jsonb_build_object('linha', v_total, 'erro', SQLERRM);
    END;
  END LOOP;

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
