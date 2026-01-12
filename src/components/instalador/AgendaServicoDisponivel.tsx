import { MapPin, Lock, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Função para formatar data sem conversão de timezone
function formatarDataServico(dataString: string): string {
  const match = dataString.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) {
    const [, ano, mes, dia, hora, minuto] = match;
    return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
  }
  return dataString;
}

function formatarHorario(dataString: string): string {
  const match = dataString.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) {
    const [, , , , hora, minuto] = match;
    return `${hora}:${minuto}`;
  }
  return "--:--";
}

interface Cliente {
  nome: string;
  telefone: string;
  bairro: string | null;
}

interface Servico {
  id: string;
  codigo: string;
  tipo_servico: string[];
  data_servico_agendada: string;
  endereco_completo: string;
  valor_mao_obra_instalador: number;
  descricao: string;
  clientes: Cliente;
}

interface AgendaServicoDisponivelProps {
  servico: Servico;
  temCertificacao: boolean;
  onSolicitar: (id: string) => void;
  isLoading?: boolean;
}

export function AgendaServicoDisponivel({ 
  servico, 
  temCertificacao, 
  onSolicitar,
  isLoading 
}: AgendaServicoDisponivelProps) {
  const horario = formatarHorario(servico.data_servico_agendada);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <div className={`p-2 rounded-lg border cursor-pointer hover:shadow-md transition-shadow bg-card ${!temCertificacao ? 'opacity-60' : ''}`}>
          {/* Horário e Certificação */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-foreground">{horario}</span>
            {!temCertificacao && (
              <Lock className="h-3 w-3 text-orange-500" />
            )}
          </div>

          {/* Tipo de serviço */}
          <p className="text-xs font-medium text-foreground truncate">
            {servico.tipo_servico?.join(", ") || "Serviço"}
          </p>

          {/* Bairro */}
          <p className="text-[10px] text-muted-foreground truncate">
            📍 {servico.clientes?.bairro || "Local não informado"}
          </p>

          {/* Valor */}
          <div className="mt-1">
            <p className="text-xs font-bold text-green-600">
              R$ {servico.valor_mao_obra_instalador?.toFixed(2) || "0.00"}*
            </p>
          </div>

          {/* Descrição resumida */}
          {servico.descricao && (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
              📝 {servico.descricao}
            </p>
          )}
        </div>
      </SheetTrigger>

      <SheetContent side="bottom" className="h-auto max-h-[80vh]">
        <SheetHeader>
          <SheetTitle className="text-left">{servico.codigo}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Informações do Serviço */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatarDataServico(servico.data_servico_agendada)}</span>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span>{servico.clientes?.bairro || servico.endereco_completo || "Endereço não informado"}</span>
            </div>

            <div className="text-sm">
              <span className="font-medium">Serviço: </span>
              {servico.tipo_servico?.join(", ") || "N/A"}
            </div>

            {servico.descricao && (
              <div className="text-sm">
                <span className="font-medium">Descrição: </span>
                {servico.descricao}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">Seu ganho estimado*:</span>
              <span className="text-xl font-bold text-green-600">
                R$ {servico.valor_mao_obra_instalador?.toFixed(2) || "0.00"}
              </span>
            </div>
          </div>

          {/* Botão de Ação */}
          {temCertificacao ? (
            <Button 
              onClick={() => onSolicitar(servico.id)} 
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Solicitando...
                </>
              ) : (
                "🎯 Solicitar Serviço"
              )}
            </Button>
          ) : (
            <div className="bg-orange-50 border border-orange-200 text-orange-700 px-3 py-2 rounded text-sm text-center flex items-center justify-center gap-2">
              <Lock className="h-4 w-4" />
              Certificação necessária para este tipo de serviço
            </div>
          )}
          
          <p className="text-[10px] text-muted-foreground text-center">
            * O valor final será calculado de acordo com seu percentual configurado.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
