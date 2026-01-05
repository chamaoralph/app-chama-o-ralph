import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Ban, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Indisponibilidade {
  id: string;
  data_inicio: string;
  data_fim: string;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  motivo?: string | null;
}

interface IndisponibilidadeCardProps {
  indisponibilidade: Indisponibilidade;
  diaAtual: Date;
  onEditar: (indisponibilidade: Indisponibilidade) => void;
  onExcluir: (id: string) => void;
  compact?: boolean;
}

export function IndisponibilidadeCard({
  indisponibilidade,
  diaAtual,
  onEditar,
  onExcluir,
  compact = false,
}: IndisponibilidadeCardProps) {
  const dataInicio = new Date(indisponibilidade.data_inicio);
  const dataFim = new Date(indisponibilidade.data_fim);
  const mesmaData = isSameDay(dataInicio, dataFim);
  const diaInteiro = !indisponibilidade.hora_inicio;

  // Determinar o texto do período
  let periodoTexto = "";
  if (diaInteiro) {
    if (mesmaData) {
      periodoTexto = "Dia inteiro";
    } else {
      periodoTexto = `${format(dataInicio, "dd/MM")} - ${format(dataFim, "dd/MM")}`;
    }
  } else {
    periodoTexto = `${indisponibilidade.hora_inicio?.slice(0, 5)} - ${indisponibilidade.hora_fim?.slice(0, 5)}`;
  }

  if (compact) {
    return (
      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2 text-sm">
        <div className="flex items-center gap-2">
          <Ban className="h-4 w-4 text-destructive" />
          <span className="font-medium text-destructive">Indisponível</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {periodoTexto}
          {indisponibilidade.motivo && ` • ${indisponibilidade.motivo}`}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Ban className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Indisponível</p>
            <p className="text-sm text-muted-foreground">
              {periodoTexto}
            </p>
            {indisponibilidade.motivo && (
              <p className="text-sm text-foreground mt-1">
                {indisponibilidade.motivo}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEditar(indisponibilidade)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onExcluir(indisponibilidade.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
