-- Novo tamanho de TV: 98" a 100"
-- Amplia o CHECK constraint de tamanho_tv e cria as linhas (parede x cobertura)
-- para todas as empresas existentes, sem preço definido (ND até o admin
-- preencher em Configurações > Tabela de Preços — mesmo comportamento de
-- "combinação indisponível" já usado pras demais faixas).

ALTER TABLE public.precos_instalacao_tv
  DROP CONSTRAINT precos_tv_tamanho_check;

ALTER TABLE public.precos_instalacao_tv
  ADD CONSTRAINT precos_tv_tamanho_check
  CHECK (tamanho_tv IN ('ate_39', '40_55', '58_65', '70_75', '85', '98_100'));

DO $$
DECLARE
  v_empresa RECORD;
  v_parede TEXT;
  v_cobertura TEXT;
BEGIN
  FOR v_empresa IN SELECT id FROM public.empresas LOOP
    FOREACH v_parede IN ARRAY ARRAY['painel_madeira', 'alvenaria', 'drywall', 'teto'] LOOP
      FOREACH v_cobertura IN ARRAY ARRAY['parcial', 'total'] LOOP
        INSERT INTO public.precos_instalacao_tv (
          empresa_id, tamanho_tv, tipo_parede, cobertura,
          valor_mao_obra, valor_parafusos, valor_suporte, tipo_suporte, disponivel
        ) VALUES (
          v_empresa.id, '98_100', v_parede, v_cobertura,
          NULL, 0, 0, 'nao_fornecemos',
          NOT (v_parede = 'teto' AND v_cobertura = 'parcial')
        )
        ON CONFLICT (empresa_id, tamanho_tv, tipo_parede, cobertura) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
