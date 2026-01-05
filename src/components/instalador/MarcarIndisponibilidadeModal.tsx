import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MarcarIndisponibilidadeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  indisponibilidadeParaEditar?: {
    id: string;
    data_inicio: string;
    data_fim: string;
    hora_inicio?: string | null;
    hora_fim?: string | null;
    motivo?: string | null;
  };
}

export function MarcarIndisponibilidadeModal({
  open,
  onOpenChange,
  onSuccess,
  indisponibilidadeParaEditar,
}: MarcarIndisponibilidadeModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [dataInicio, setDataInicio] = useState<Date | undefined>(
    indisponibilidadeParaEditar ? new Date(indisponibilidadeParaEditar.data_inicio) : undefined
  );
  const [dataFim, setDataFim] = useState<Date | undefined>(
    indisponibilidadeParaEditar ? new Date(indisponibilidadeParaEditar.data_fim) : undefined
  );
  const [diaInteiro, setDiaInteiro] = useState(
    !indisponibilidadeParaEditar?.hora_inicio
  );
  const [horaInicio, setHoraInicio] = useState(
    indisponibilidadeParaEditar?.hora_inicio?.slice(0, 5) || "08:00"
  );
  const [horaFim, setHoraFim] = useState(
    indisponibilidadeParaEditar?.hora_fim?.slice(0, 5) || "18:00"
  );
  const [motivo, setMotivo] = useState(indisponibilidadeParaEditar?.motivo || "");

  const resetForm = () => {
    setDataInicio(undefined);
    setDataFim(undefined);
    setDiaInteiro(true);
    setHoraInicio("08:00");
    setHoraFim("18:00");
    setMotivo("");
  };

  const handleSalvar = async () => {
    if (!dataInicio) {
      toast({
        title: "Data obrigatória",
        description: "Selecione ao menos a data de início",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: usuario } = await supabase
        .from("usuarios")
        .select("empresa_id")
        .eq("id", user.id)
        .single();

      if (!usuario) throw new Error("Usuário não encontrado");

      const dados = {
        instalador_id: user.id,
        empresa_id: usuario.empresa_id,
        data_inicio: format(dataInicio, "yyyy-MM-dd"),
        data_fim: format(dataFim || dataInicio, "yyyy-MM-dd"),
        hora_inicio: diaInteiro ? null : horaInicio,
        hora_fim: diaInteiro ? null : horaFim,
        motivo: motivo || null,
      };

      if (indisponibilidadeParaEditar) {
        const { error } = await supabase
          .from("indisponibilidades_instaladores")
          .update(dados)
          .eq("id", indisponibilidadeParaEditar.id);

        if (error) throw error;
        toast({
          title: "✅ Indisponibilidade atualizada!",
        });
      } else {
        const { error } = await supabase
          .from("indisponibilidades_instaladores")
          .insert(dados);

        if (error) throw error;
        toast({
          title: "✅ Indisponibilidade registrada!",
          description: "Sua indisponibilidade foi salva com sucesso.",
        });
      }

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "❌ Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5" />
            {indisponibilidadeParaEditar ? "Editar" : "Marcar"} Indisponibilidade
          </DialogTitle>
          <DialogDescription>
            Informe o período em que você não estará disponível para serviços.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Data Início */}
          <div className="space-y-2">
            <Label>Data de Início *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataInicio && "text-muted-foreground"
                  )}
                >
                  {dataInicio ? (
                    format(dataInicio, "PPP", { locale: ptBR })
                  ) : (
                    "Selecione a data"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={setDataInicio}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Data Fim */}
          <div className="space-y-2">
            <Label>Data de Fim (opcional - para períodos)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataFim && "text-muted-foreground"
                  )}
                >
                  {dataFim ? (
                    format(dataFim, "PPP", { locale: ptBR })
                  ) : (
                    "Mesmo dia (um único dia)"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataFim}
                  onSelect={setDataFim}
                  disabled={(date) => dataInicio ? date < dataInicio : date < new Date()}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            {dataFim && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDataFim(undefined)}
                className="text-xs h-auto p-1"
              >
                <X className="h-3 w-3 mr-1" /> Limpar data fim
              </Button>
            )}
          </div>

          {/* Dia inteiro toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="dia-inteiro">Dia inteiro</Label>
            <Switch
              id="dia-inteiro"
              checked={diaInteiro}
              onCheckedChange={setDiaInteiro}
            />
          </div>

          {/* Horários (se não for dia inteiro) */}
          {!diaInteiro && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora Início</Label>
                <Input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora Fim</Label>
                <Input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                />
              </div>
            </div>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={loading || !dataInicio}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
