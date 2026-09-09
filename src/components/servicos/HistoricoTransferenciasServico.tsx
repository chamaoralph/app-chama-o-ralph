import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, History } from "lucide-react";
import { formatarDataHoraBR } from "@/lib/utils";

interface TransferenciaHistorico {
  id: string;
  de_instalador_id: string;
  de_instalador_nome: string;
  para_instalador_id: string;
  para_instalador_nome: string;
  motivo: string | null;
  transferido_por: string;
  transferido_por_nome: string;
  created_at: string;
}

interface HistoricoTransferenciasServicoProps {
  servicoId: string;
  /** incrementar pra forçar recarregar depois de uma nova transferência */
  refreshKey?: number;
}

// Trilha de auditoria de transferências do serviço — quem recebeu os dados
// do cliente, quando e por quê. Não é editável nem removível pela UI: só
// reflete o que já está gravado em servicos_transferencias.
export function HistoricoTransferenciasServico({ servicoId, refreshKey }: HistoricoTransferenciasServicoProps) {
  const [transferencias, setTransferencias] = useState<TransferenciaHistorico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicoId, refreshKey]);

  async function carregarHistorico() {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("historico_transferencias_servico", {
        p_servico_id: servicoId,
      });
      if (error) throw error;
      setTransferencias(data || []);
    } catch (error) {
      console.error("Erro ao carregar histórico de transferências:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || transferencias.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Histórico de Transferências
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {transferencias.map((t) => (
          <div key={t.id} className="rounded-md border p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>{t.de_instalador_nome}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>{t.para_instalador_nome}</span>
            </div>
            {t.motivo && <p className="text-sm text-muted-foreground">{t.motivo}</p>}
            <p className="text-xs text-muted-foreground">
              {formatarDataHoraBR(t.created_at)} · por {t.transferido_por_nome}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
