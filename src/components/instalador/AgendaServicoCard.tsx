import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, MapPin, Play, CheckCircle, Clock, User } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Cliente {
  nome: string;
  telefone: string;
  endereco_completo: string;
  bairro: string;
}

interface Servico {
  id: string;
  codigo: string;
  status: string;
  data_servico_agendada: string;
  tipo_servico: string[];
  valor_mao_obra_instalador: number;
  descricao?: string;
  clientes: Cliente;
}

interface AgendaServicoCardProps {
  servico: Servico;
  onIniciar: (id: string) => void;
  onFinalizar: (id: string) => void;
}

export function AgendaServicoCard({ servico, onIniciar, onFinalizar }: AgendaServicoCardProps) {
  const horario = format(new Date(servico.data_servico_agendada), "HH:mm");

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "solicitado":
        return { label: "Aguardando", className: "bg-yellow-100 text-yellow-800 border-yellow-200" };
      case "atribuido":
        return { label: "Pronto", className: "bg-green-100 text-green-800 border-green-200" };
      case "em_andamento":
        return { label: "Em andamento", className: "bg-blue-100 text-blue-800 border-blue-200" };
      default:
        return { label: status, className: "bg-gray-100 text-gray-800 border-gray-200" };
    }
  };

  const statusConfig = getStatusConfig(servico.status);

  const abrirWhatsApp = () => {
    const telefone = servico.clientes.telefone.replace(/\D/g, "");
    const telefoneFormatado = telefone.startsWith("55") ? telefone : `55${telefone}`;
    window.open(`https://wa.me/${telefoneFormatado}`, "_blank");
  };

  const abrirMapa = () => {
    window.open(`https://maps.google.com/?q=${encodeURIComponent(servico.clientes.endereco_completo)}`, "_blank");
  };

  const ligar = () => {
    window.location.href = `tel:${servico.clientes.telefone}`;
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <div className="p-2 rounded-lg border cursor-pointer hover:shadow-md transition-shadow bg-card">
          {/* Horário e Status */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-foreground">{horario}</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusConfig.className}`}>
              {statusConfig.label}
            </Badge>
          </div>

          {/* Cliente */}
          <p className="text-xs font-medium text-foreground truncate">
            {servico.clientes.nome}
          </p>

          {/* Bairro */}
          <p className="text-[10px] text-muted-foreground truncate">
            📍 {servico.clientes.bairro}
          </p>

          {/* Valor */}
          <p className="text-xs font-bold text-green-600 mt-1">
            R$ {servico.valor_mao_obra_instalador?.toFixed(2)}
          </p>
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
              <span>
                {format(new Date(servico.data_servico_agendada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{servico.clientes.nome}</span>
            </div>

            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span>{servico.clientes.endereco_completo}</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{servico.clientes.telefone}</span>
            </div>

            <div className="text-sm">
              <span className="font-medium">Serviço: </span>
              {servico.tipo_servico?.join(", ")}
            </div>

            {servico.descricao && (
              <div className="text-sm">
                <span className="font-medium">Descrição: </span>
                {servico.descricao}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">Sua parte:</span>
              <span className="text-xl font-bold text-green-600">
                R$ {servico.valor_mao_obra_instalador?.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={abrirWhatsApp} className="gap-2">
              💬 WhatsApp
            </Button>
            <Button variant="outline" onClick={abrirMapa} className="gap-2">
              🗺️ Mapa
            </Button>
            <Button variant="outline" onClick={ligar} className="gap-2 col-span-2">
              📞 Ligar
            </Button>
          </div>

          {/* Botões de Status */}
          {servico.status === "solicitado" && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded text-sm text-center">
              ⏳ Aguardando aprovação do administrador
            </div>
          )}

          {servico.status === "atribuido" && (
            <Button 
              onClick={() => onIniciar(servico.id)} 
              className="w-full bg-green-600 hover:bg-green-700 gap-2"
            >
              <Play className="h-4 w-4" />
              Iniciar Serviço
            </Button>
          )}

          {servico.status === "em_andamento" && (
            <Button 
              onClick={() => onFinalizar(servico.id)} 
              className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Finalizar Serviço
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
