-- ============================================================
-- Prioridade de instaladores — Etapa 1: estrutura
-- Mudança 100% aditiva: nada existente é alterado ou removido.
-- ============================================================

-- 1) Marcação manual de reclamação no serviço (admin)
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS cliente_reclamou boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reclamacao_obs   text,
  ADD COLUMN IF NOT EXISTS reclamacao_em    timestamptz;

COMMENT ON COLUMN public.servicos.cliente_reclamou IS
  'Marcado pelo admin quando o cliente reclamou. Vale -1 no ranking do instalador.';

-- 2) Fila da cascata de avisos de serviço novo
CREATE TABLE IF NOT EXISTS public.cascata_notificacoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL,
  servico_id       uuid NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  instalador_id    uuid NOT NULL,
  posicao          smallint NOT NULL,          -- 1 = melhor do ranking
  pontuacao        integer,                    -- foto da pontuação no momento
  agendado_para    timestamptz NOT NULL,       -- posição 1 = agora, 2 = +5min, 3 = +10min...
  status           text NOT NULL DEFAULT 'agendado'
                   CHECK (status IN ('agendado', 'enviado', 'cancelado', 'falhou')),
  enviado_em       timestamptz,
  cancelado_motivo text,                       -- ex.: 'servico_pego', 'servico_cancelado'
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (servico_id, instalador_id)
);

-- Índice para o N8N achar rápido os envios vencidos
CREATE INDEX IF NOT EXISTS idx_cascata_pendentes
  ON public.cascata_notificacoes (agendado_para)
  WHERE status = 'agendado';

CREATE INDEX IF NOT EXISTS idx_cascata_servico
  ON public.cascata_notificacoes (servico_id);

-- 3) RLS — leitura pelo app; escrita só via service-role (Edge Functions)
ALTER TABLE public.cascata_notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin le cascata da empresa"
  ON public.cascata_notificacoes FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  );

CREATE POLICY "Instalador le a propria cascata"
  ON public.cascata_notificacoes FOR SELECT
  USING (instalador_id = auth.uid());
