CREATE OR REPLACE FUNCTION public.criar_cotacao_whatsapp_atomic(
  p_empresa_id uuid,
  p_cliente_nome text,
  p_cliente_telefone text,
  p_cliente_endereco text DEFAULT NULL,
  p_cliente_bairro text DEFAULT NULL,
  p_cliente_cep text DEFAULT NULL,
  p_tipo_servico text[] DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_valor_estimado numeric DEFAULT NULL,
  p_data_servico_desejada date DEFAULT NULL,
  p_horario_inicio time DEFAULT NULL,
  p_horario_fim time DEFAULT NULL,
  p_origem_lead text DEFAULT NULL,
  p_ocasiao text DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
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
  v_cotacao_id uuid;
  v_tipos_servico text[];
  v_valor_estimado numeric;
  v_origem_lead_cliente text;
  v_origem_lead_cotacao text;
BEGIN
  v_cliente_nome := left(trim(coalesce(p_cliente_nome, '')), 100);
  v_telefone_limpo := regexp_replace(coalesce(p_cliente_telefone, ''), '\D', '', 'g');

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
      AND tb.telefone = v_telefone_limpo
  ) THEN
    RETURN jsonb_build_object(
      'sucesso', true,
      'bloqueado', true,
      'mensagem', 'Telefone está na lista de bloqueio. Nenhuma cotação criada.'
    );
  END IF;

  INSERT INTO public.clientes (
    empresa_id,
    nome,
    telefone,
    endereco_completo,
    bairro,
    cep,
    origem_lead,
    ativo
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
    empresa_id,
    cliente_id,
    tipo_servico,
    descricao_servico,
    valor_estimado,
    data_servico_desejada,
    horario_inicio,
    horario_fim,
    origem_lead,
    ocasiao,
    observacoes,
    status
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