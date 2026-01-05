import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageCircle, MapPin, Play, CheckCircle, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Cliente {
  nome: string;
  telefone: string;
  endereco_completo?: string;
  bairro?: string | null;
}

interface MobileServicoCardProps {
  servico: {
    id: string;
    codigo: string;
    data_servico_agendada: string;
    tipo_servico: string[];
    valor_mao_obra_instalador: number | null;
    descricao?: string | null;
    endereco_completo?: string;
    status?: string;
    clientes: Cliente;
  };
  onIniciar?: (id: string) => void;
  onFinalizar?: (id: string) => void;
  onSolicitar?: (id: string) => void;
  isLoading?: boolean;
  temCertificacao?: boolean;
  variant?: "agenda" | "disponivel";
}

export function MobileServicoCard({
  servico,
  onIniciar,
  onFinalizar,
  onSolicitar,
  isLoading,
  temCertificacao = true,
  variant = "agenda",
}: MobileServicoCardProps) {
  const dataFormatada = format(
    new Date(servico.data_servico_agendada),
    "dd/MM 'às' HH:mm",
    { locale: ptBR }
  );

  const endereco = servico.clientes?.endereco_completo || servico.endereco_completo || "";
  const bairro = servico.clientes?.bairro;

  // Extrair rua do endereço (parte antes do número)
  const formatarEndereco = () => {
    if (!endereco) return bairro || "N/A";
    const partes = endereco.split(",");
    if (partes.length > 0) {
      let rua = partes[0].trim().replace(/\s*\d+\s*$/, "").trim();
      if (bairro) return `${bairro} - ${rua}`;
      return rua;
    }
    return bairro || endereco;
  };

  const handleWhatsApp = () => {
    const telefone = servico.clientes.telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${telefone}`, '_blank');
  };

  const handleMapa = () => {
    window.open(`https://maps.google.com/?q=${encodeURIComponent(endereco)}`);
  };

  const getStatusBadge = () => {
    switch (servico.status) {
      case "solicitado":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
            <Clock className="w-3 h-3 mr-1" /> Aguardando
          </Badge>
        );
      case "em_andamento":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
            <Play className="w-3 h-3 mr-1" /> Em andamento
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header com valor e data */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-blue-50 border-b">
        <div className="flex items-center gap-3">
          <div className="bg-green-500 text-white font-bold px-3 py-1.5 rounded-lg text-lg">
            R$ {servico.valor_mao_obra_instalador?.toFixed(0) || "0"}
          </div>
          {getStatusBadge()}
        </div>
        <div className="text-right text-sm text-gray-600 font-medium">
          {dataFormatada}
        </div>
      </div>

      {/* Corpo */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-gray-900">{servico.codigo}</h3>
            <p className="text-gray-600">👤 {servico.clientes.nome}</p>
          </div>
        </div>

        <div className="text-sm text-gray-600 space-y-1">
          <p className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
            <span>{formatarEndereco()}</span>
          </p>
          <p>🔧 {servico.tipo_servico?.join(", ") || "N/A"}</p>
        </div>

        {servico.descricao && (
          <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
            {servico.descricao}
          </p>
        )}
      </div>

      {/* Ações */}
      <div className="p-4 pt-0 space-y-3">
      {/* Botões WhatsApp e Mapa - WhatsApp apenas quando não for serviço disponível */}
        {variant !== "disponivel" ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={handleWhatsApp}
              className="h-12 text-base font-medium text-green-600 border-green-200 hover:bg-green-50"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={handleMapa}
              className="h-12 text-base font-medium"
            >
              <MapPin className="w-5 h-5 mr-2" />
              Mapa
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={handleMapa}
            className="w-full h-12 text-base font-medium"
          >
            <MapPin className="w-5 h-5 mr-2" />
            Ver no Mapa
          </Button>
        )}

        {/* Ação principal */}
        {variant === "agenda" && (
          <>
            {servico.status === "atribuido" && onIniciar && (
              <Button
                onClick={() => onIniciar(servico.id)}
                className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700"
              >
                <Play className="w-6 h-6 mr-2" />
                Iniciar Serviço
              </Button>
            )}
            {servico.status === "em_andamento" && onFinalizar && (
              <Button
                onClick={() => onFinalizar(servico.id)}
                className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="w-6 h-6 mr-2" />
                Finalizar
              </Button>
            )}
          </>
        )}

        {variant === "disponivel" && (
          <>
            {temCertificacao ? (
              <Button
                onClick={() => onSolicitar?.(servico.id)}
                disabled={isLoading}
                className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Solicitando...
                  </>
                ) : (
                  "🎯 Solicitar Serviço"
                )}
              </Button>
            ) : (
              <Button
                disabled
                variant="outline"
                className="w-full h-14 text-base border-orange-300 text-orange-600"
              >
                <Lock className="w-5 h-5 mr-2" />
                Certificação Necessária
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
