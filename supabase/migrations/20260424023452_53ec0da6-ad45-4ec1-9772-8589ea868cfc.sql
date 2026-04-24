-- Criar tabela de preços de instalação de TV
CREATE TABLE public.precos_instalacao_tv (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tamanho_tv TEXT NOT NULL,
  tipo_parede TEXT NOT NULL,
  cobertura TEXT NOT NULL,
  valor_mao_obra NUMERIC,
  valor_parafusos NUMERIC DEFAULT 0,
  valor_suporte NUMERIC DEFAULT 0,
  tipo_suporte TEXT NOT NULL DEFAULT 'nao_fornecemos',
  disponivel BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT precos_tv_unique UNIQUE (empresa_id, tamanho_tv, tipo_parede, cobertura),
  CONSTRAINT precos_tv_tamanho_check CHECK (tamanho_tv IN ('ate_39', '40_55', '58_65', '70_75', '85')),
  CONSTRAINT precos_tv_parede_check CHECK (tipo_parede IN ('painel_madeira', 'alvenaria', 'drywall', 'teto')),
  CONSTRAINT precos_tv_cobertura_check CHECK (cobertura IN ('parcial', 'total')),
  CONSTRAINT precos_tv_tipo_suporte_check CHECK (tipo_suporte IN ('incluso', 'valor', 'nao_fornecemos'))
);

ALTER TABLE public.precos_instalacao_tv ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam precos_instalacao_tv da empresa"
ON public.precos_instalacao_tv FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_empresa_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND empresa_id = get_empresa_id(auth.uid()));

CREATE POLICY "Usuarios veem precos_instalacao_tv da empresa"
ON public.precos_instalacao_tv FOR SELECT
USING (empresa_id = get_empresa_id(auth.uid()));

CREATE TRIGGER update_precos_tv_updated_at
BEFORE UPDATE ON public.precos_instalacao_tv
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed inicial para todas as empresas existentes
DO $$
DECLARE
  v_empresa RECORD;
  v_data jsonb := '[
    {"t":"ate_39","p":"painel_madeira","c":"parcial","mo":120,"par":0,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"ate_39","p":"painel_madeira","c":"total","mo":160,"par":0,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"ate_39","p":"alvenaria","c":"parcial","mo":140,"par":15,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"ate_39","p":"alvenaria","c":"total","mo":180,"par":15,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"ate_39","p":"drywall","c":"parcial","mo":140,"par":25,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"ate_39","p":"drywall","c":"total","mo":180,"par":25,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"ate_39","p":"teto","c":"parcial","mo":0,"par":0,"sup":0,"ts":"nao_fornecemos","disp":false},
    {"t":"ate_39","p":"teto","c":"total","mo":250,"par":25,"sup":0,"ts":"nao_fornecemos","disp":true},

    {"t":"40_55","p":"painel_madeira","c":"parcial","mo":140,"par":0,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"40_55","p":"painel_madeira","c":"total","mo":180,"par":0,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"40_55","p":"alvenaria","c":"parcial","mo":160,"par":15,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"40_55","p":"alvenaria","c":"total","mo":200,"par":15,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"40_55","p":"drywall","c":"parcial","mo":160,"par":25,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"40_55","p":"drywall","c":"total","mo":200,"par":25,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"40_55","p":"teto","c":"parcial","mo":0,"par":0,"sup":0,"ts":"nao_fornecemos","disp":false},
    {"t":"40_55","p":"teto","c":"total","mo":280,"par":25,"sup":0,"ts":"nao_fornecemos","disp":true},

    {"t":"58_65","p":"painel_madeira","c":"parcial","mo":160,"par":0,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"58_65","p":"painel_madeira","c":"total","mo":200,"par":0,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"58_65","p":"alvenaria","c":"parcial","mo":180,"par":15,"sup":79,"ts":"valor","disp":true},
    {"t":"58_65","p":"alvenaria","c":"total","mo":220,"par":15,"sup":79,"ts":"valor","disp":true},
    {"t":"58_65","p":"drywall","c":"parcial","mo":180,"par":25,"sup":79,"ts":"valor","disp":true},
    {"t":"58_65","p":"drywall","c":"total","mo":220,"par":25,"sup":79,"ts":"valor","disp":true},
    {"t":"58_65","p":"teto","c":"parcial","mo":0,"par":0,"sup":0,"ts":"nao_fornecemos","disp":false},
    {"t":"58_65","p":"teto","c":"total","mo":320,"par":25,"sup":450,"ts":"valor","disp":true},

    {"t":"70_75","p":"painel_madeira","c":"parcial","mo":180,"par":0,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"70_75","p":"painel_madeira","c":"total","mo":220,"par":0,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"70_75","p":"alvenaria","c":"parcial","mo":200,"par":15,"sup":79,"ts":"valor","disp":true},
    {"t":"70_75","p":"alvenaria","c":"total","mo":240,"par":15,"sup":79,"ts":"valor","disp":true},
    {"t":"70_75","p":"drywall","c":"parcial","mo":200,"par":25,"sup":79,"ts":"valor","disp":true},
    {"t":"70_75","p":"drywall","c":"total","mo":240,"par":25,"sup":79,"ts":"valor","disp":true},
    {"t":"70_75","p":"teto","c":"parcial","mo":0,"par":0,"sup":0,"ts":"nao_fornecemos","disp":false},
    {"t":"70_75","p":"teto","c":"total","mo":380,"par":25,"sup":450,"ts":"valor","disp":true},

    {"t":"85","p":"painel_madeira","c":"parcial","mo":220,"par":0,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"85","p":"painel_madeira","c":"total","mo":260,"par":0,"sup":0,"ts":"nao_fornecemos","disp":true},
    {"t":"85","p":"alvenaria","c":"parcial","mo":240,"par":15,"sup":150,"ts":"valor","disp":true},
    {"t":"85","p":"alvenaria","c":"total","mo":280,"par":15,"sup":150,"ts":"valor","disp":true},
    {"t":"85","p":"drywall","c":"parcial","mo":240,"par":25,"sup":150,"ts":"valor","disp":true},
    {"t":"85","p":"drywall","c":"total","mo":280,"par":25,"sup":150,"ts":"valor","disp":true},
    {"t":"85","p":"teto","c":"parcial","mo":0,"par":0,"sup":0,"ts":"nao_fornecemos","disp":false},
    {"t":"85","p":"teto","c":"total","mo":450,"par":25,"sup":600,"ts":"valor","disp":true}
  ]'::jsonb;
  v_item jsonb;
BEGIN
  FOR v_empresa IN SELECT id FROM public.empresas LOOP
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_data) LOOP
      INSERT INTO public.precos_instalacao_tv (
        empresa_id, tamanho_tv, tipo_parede, cobertura,
        valor_mao_obra, valor_parafusos, valor_suporte, tipo_suporte, disponivel
      ) VALUES (
        v_empresa.id,
        v_item->>'t',
        v_item->>'p',
        v_item->>'c',
        (v_item->>'mo')::numeric,
        (v_item->>'par')::numeric,
        (v_item->>'sup')::numeric,
        v_item->>'ts',
        (v_item->>'disp')::boolean
      )
      ON CONFLICT (empresa_id, tamanho_tv, tipo_parede, cobertura) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;