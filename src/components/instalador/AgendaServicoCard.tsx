import { Phone, MapPin, Play, CheckCircle, Clock, User, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { decomporExtra, formatarBRL, type ExtraServicoItem } from "@/lib/orcamento";

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
  valor_total?: number;
  valor_mao_obra_instalador: number;
  descricao?: string;
  observacoes_instalador?: string;
  acessorios_vendidos?: ExtraServicoItem[] | null;
  clientes: Cliente;
}

interface AgendaServicoCardProps {
  servico: Servico;
  onIniciar: (id: string) => void;
  onFinalizar: (id: string) => void;
}

// Extrai horário diretamente da string para evitar conversão de timezone
function formatarHorario(dataString: string): string {
  const timePart = dataString.split('T')[1];
  return timePart ? timePart.substring(0, 5) : '00:00';
}

// Formata data e horário sem usar new Date()
function formatarDataServico(dataString: string): string {
  const [dataPart, timePart] = dataString.split('T');
  const [ano, mes, dia] = dataPart.split('-');
  const horario = timePart ? timePart.substring(0, 5) : '00:00';
  return `${dia}/${mes}/${ano} às ${horario}`;
}

export function AgendaServicoCard({ servico, onIniciar, onFinalizar }: AgendaServicoCardProps) {
  const navigate = useNavigate();
  const horario = formatarHorario(servico.data_servico_agendada);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "solicitado":
        return { label: "Aguardando", className: "bg-yellow-100 text-yellow-800 border-yellow-200" };
      case "atribuido":
        return { label: "Pronto", className: "bg-green-100 text-green-800 border-green-200" };
      case "em_andamento":
        return { label: "Em andamento", className: "bg-blue-100 text-blue-800 border-blue-200" };
      case "correcao_solicitada":
        return { label: "Correção", className: "bg-red-100 text-red-800 border-red-200" };
      default:
        return { label: status, className: "bg-gray-100 text-gray-800 border-gray-200" };
    }
  };

  const statusConfig = getStatusConfig(servico.status);

  // Quanto cobrar do cliente = mão de obra combinada no orçamento (valor_total,
  // que já sai SEM os acessórios — ver criar_servico_ao_confirmar()) + venda de
  // cada acessório (da cotação e/ou vendido na hora, ambos ficam em
  // acessorios_vendidos). É diferente da "sua parte" mostrada no card: aqui é o
  // valor cheio que o cliente paga, não o que o instalador recebe.
  const acessorios = servico.acessorios_vendidos ?? [];
  const totalAcessorios = acessorios.reduce((soma, item) => soma + (item.valor_venda ?? 0), 0);
  const valorMaoObraCliente = servico.valor_total ?? 0;
  const totalCobrarCliente = valorMaoObraCliente + totalAcessorios;

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

          {/* Alerta de correção */}
          {servico.status === "correcao_solicitada" && servico.observacoes_instalador && (
            <p className="text-[10px] text-red-600 font-medium mt-1 line-clamp-2">
              ⚠️ {servico.observacoes_instalador}
            </p>
          )}

          {/* Descrição resumida */}
          {servico.descricao && servico.status !== "correcao_solicitada" && (
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
          <Tabs defaultValue="detalhes">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
              <TabsTrigger value="cobranca">Cobrar do Cliente</TabsTrigger>
            </TabsList>

            {/* Informações do Serviço */}
            <TabsContent value="detalhes" className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {formatarDataServico(servico.data_servico_agendada)}
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
            </TabsContent>

            {/* Quanto cobrar do cliente, e o porquê */}
            <TabsContent value="cobranca" className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total a cobrar</span>
                <span className="text-2xl font-bold text-foreground">
                  {formatarBRL(totalCobrarCliente)}
                </span>
              </div>

              <div className="space-y-2">
                <div className="border rounded-md p-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Mão de obra (combinada no orçamento)</span>
                    <span className="font-semibold">{formatarBRL(valorMaoObraCliente)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    → sua parte: {formatarBRL(servico.valor_mao_obra_instalador ?? 0)}
                  </p>
                </div>

                {acessorios.map((item, idx) => {
                  const d = decomporExtra(item);
                  const pecaDaEmpresa = (item.origem_estoque ?? item.fornecedor) === "empresa";
                  const vendidoNaHora = item.origem === "finalizacao";
                  return (
                    <div key={idx} className="border rounded-md p-2.5">
                      <div className="flex items-center justify-between text-sm gap-2">
                        <span className="font-medium">
                          {item.nome}
                          {item.quantidade > 1 ? ` (x${item.quantidade})` : ""}
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            {vendidoNaHora ? "(vendido na hora)" : "(combinado no orçamento)"}
                          </span>
                        </span>
                        <span className="font-semibold shrink-0">{formatarBRL(item.valor_venda)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        → peça {pecaDaEmpresa ? "do estoque da empresa" : "do seu estoque"}; sua parte do lucro:{" "}
                        {formatarBRL(d.ganho_instalador)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground pt-1 border-t">
                ℹ️ Esse é o valor combinado no orçamento do cliente. Se vender algum acessório extra
                durante o atendimento, registre em "Orçamento na hora" pra entrar na conta.
              </p>
            </TabsContent>
          </Tabs>

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

          <Button
            variant="outline"
            className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/5"
            onClick={() => navigate(`/instalador/servico/${servico.id}/orcamento`)}
          >
            <Zap className="h-4 w-4" />
            Orçamento na hora
          </Button>

          {/* Botões de Status */}
          {servico.status === "solicitado" && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded text-sm text-center">
              ⏳ Aguardando aprovação do administrador
            </div>
          )}

          {servico.status === "correcao_solicitada" && (
            <div className="space-y-2">
              <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm">
                <p className="font-medium mb-1">⚠️ Correção solicitada pelo gestor:</p>
                <p className="text-xs">{servico.observacoes_instalador || "Verifique as fotos e informações enviadas."}</p>
              </div>
              <Button 
                onClick={() => onFinalizar(servico.id)} 
                className="w-full bg-red-600 hover:bg-red-700 gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Corrigir e Reenviar
              </Button>
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
