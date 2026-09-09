import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";

interface InstaladorOpcao {
  id: string;
  nome: string;
}

interface TransferirServicoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicoId: string;
  /** id do instalador atualmente responsável — é excluído da lista de destino */
  instaladorAtualId: string;
  onSuccess?: () => void;
}

// Modal de transferência de serviço entre instaladores. O destino só pode
// ser um instalador ativo da mesma empresa (a função transferir_servico()
// valida tudo de novo no banco — este componente só evita chamadas óbvias
// que já sabemos que vão falhar).
export function TransferirServicoModal({
  open,
  onOpenChange,
  servicoId,
  instaladorAtualId,
  onSuccess,
}: TransferirServicoModalProps) {
  const [instaladores, setInstaladores] = useState<InstaladorOpcao[]>([]);
  const [carregandoInstaladores, setCarregandoInstaladores] = useState(false);
  const [paraInstaladorId, setParaInstaladorId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [transferindo, setTransferindo] = useState(false);

  useEffect(() => {
    if (!open) return;
    setParaInstaladorId("");
    setMotivo("");
    carregarInstaladores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, instaladorAtualId]);

  async function carregarInstaladores() {
    try {
      setCarregandoInstaladores(true);
      const { data, error } = await supabase.rpc("listar_instaladores_para_transferencia", {
        p_excluir_instalador_id: instaladorAtualId,
      });
      if (error) throw error;
      setInstaladores(data || []);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "desconhecido";
      toast.error("Erro ao carregar instaladores: " + mensagem);
    } finally {
      setCarregandoInstaladores(false);
    }
  }

  async function confirmarTransferencia() {
    if (!paraInstaladorId) {
      toast.error("Selecione o instalador de destino");
      return;
    }
    if (!motivo.trim()) {
      toast.error("Informe o motivo da transferência");
      return;
    }
    try {
      setTransferindo(true);
      const { error } = await supabase.rpc("transferir_servico", {
        p_servico_id: servicoId,
        p_para_instalador_id: paraInstaladorId,
        p_motivo: motivo.trim(),
      });
      // Erros de validação da função (empresa, permissão, status, destinatário)
      // chegam aqui com mensagem descritiva — repassa direto pro toast.
      if (error) throw error;

      toast.success("Serviço transferido com sucesso!");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao transferir serviço";
      toast.error(mensagem);
    } finally {
      setTransferindo(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !transferindo && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Transferir Serviço
          </DialogTitle>
          <DialogDescription>
            O novo instalador passa a ser o responsável pelo serviço — inclusive pela comissão,
            prestação de contas e responsabilidade técnica. Esta transferência fica registrada
            no histórico de auditoria e não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Novo instalador responsável</Label>
            <Select value={paraInstaladorId} onValueChange={setParaInstaladorId} disabled={carregandoInstaladores}>
              <SelectTrigger>
                <SelectValue placeholder={carregandoInstaladores ? "Carregando..." : "Selecione um instalador"} />
              </SelectTrigger>
              <SelectContent>
                {instaladores.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!carregandoInstaladores && instaladores.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum outro instalador ativo disponível na empresa.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Motivo da transferência</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: instalador ficou indisponível, remanejamento de rota, solicitação do cliente..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={transferindo}>
            Cancelar
          </Button>
          <Button onClick={confirmarTransferencia} disabled={transferindo || !paraInstaladorId || !motivo.trim()}>
            {transferindo ? "Transferindo..." : "Confirmar Transferência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
