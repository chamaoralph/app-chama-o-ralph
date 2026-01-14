import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import {
  Crown,
  Users,
  AlertTriangle,
  UserX,
  Ghost,
  RefreshCw,
  Download,
  Phone,
  Upload,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { ImportarClientesModal } from "@/components/admin/ImportarClientesModal";
import { useIsMobile } from "@/hooks/use-mobile";

type Segmento = "VIP" | "Ativo" | "Em Risco" | "Inativo" | "Perdido";

interface RFMData {
  id: string;
  cliente_id: string;
  empresa_id: string;
  recency_days: number;
  frequency_count: number;
  monetary_value: number;
  recency_score: number;
  frequency_score: number;
  monetary_score: number;
  rfm_score: string;
  segmento: Segmento;
  periodo_analise: number;
  ultima_atualizacao: string;
  clientes?: {
    id: string;
    nome: string;
    telefone: string;
    bairro: string | null;
  };
}

const segmentoConfig: Record<
  Segmento,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  VIP: {
    icon: Crown,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 border-yellow-200",
    label: "VIP",
  },
  Ativo: {
    icon: Users,
    color: "text-green-600",
    bgColor: "bg-green-50 border-green-200",
    label: "Ativo",
  },
  "Em Risco": {
    icon: AlertTriangle,
    color: "text-orange-600",
    bgColor: "bg-orange-50 border-orange-200",
    label: "Em Risco",
  },
  Inativo: {
    icon: UserX,
    color: "text-gray-600",
    bgColor: "bg-gray-50 border-gray-200",
    label: "Inativo",
  },
  Perdido: {
    icon: Ghost,
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
    label: "Perdido",
  },
};

const periodos = [
  { label: "3 meses", value: 90 },
  { label: "6 meses", value: 180 },
  { label: "12 meses", value: 365 },
];

export function RFMAnaliseContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [periodoSelecionado, setPeriodoSelecionado] = useState(365);
  const [segmentoFiltro, setSegmentoFiltro] = useState<Segmento | "todos">("todos");
  const [importModalOpen, setImportModalOpen] = useState(false);

  const { data: empresaId } = useQuery({
    queryKey: ["empresa-id", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("empresa_id")
        .eq("id", user?.id)
        .single();

      if (error) throw error;
      return data.empresa_id;
    },
    enabled: !!user?.id,
  });

  const { data: rfmData, isLoading, refetch } = useQuery({
    queryKey: ["rfm-data", empresaId, periodoSelecionado],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes_rfm_cache")
        .select(`
          *,
          clientes (
            id,
            nome,
            telefone,
            bairro
          )
        `)
        .eq("empresa_id", empresaId)
        .eq("periodo_analise", periodoSelecionado)
        .order("monetary_value", { ascending: false });

      if (error) throw error;
      return data as RFMData[];
    },
    enabled: !!empresaId,
  });

  const recalcularMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("calculate_rfm", {
        p_periodo_dias: periodoSelecionado,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "RFM Recalculado",
        description: `${(data as { clientes_processados: number })?.clientes_processados || 0} clientes processados com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ["rfm-data"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao recalcular",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const totaisPorSegmento = rfmData?.reduce(
    (acc, item) => {
      acc[item.segmento] = (acc[item.segmento] || 0) + 1;
      return acc;
    },
    {} as Record<Segmento, number>
  ) || {};

  const total = rfmData?.length || 0;

  const dadosFiltrados =
    segmentoFiltro === "todos"
      ? rfmData
      : rfmData?.filter((item) => item.segmento === segmentoFiltro);

  const exportarCSV = () => {
    if (!dadosFiltrados?.length) return;

    const headers = ["Nome", "Telefone", "Bairro", "Recency (dias)", "Frequency", "Monetary (R$)", "Score", "Segmento"];
    const rows = dadosFiltrados.map((item) => [
      item.clientes?.nome || "",
      item.clientes?.telefone || "",
      item.clientes?.bairro || "",
      item.recency_days,
      item.frequency_count,
      item.monetary_value.toFixed(2),
      item.rfm_score,
      item.segmento,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `clientes-rfm-${segmentoFiltro}-${periodoSelecionado}dias.csv`;
    link.click();

    toast({
      title: "Exportado",
      description: `${dadosFiltrados.length} clientes exportados.`,
    });
  };

  const formatWhatsAppLink = (telefone: string) => {
    const numero = telefone.replace(/\D/g, "");
    const numeroCompleto = numero.startsWith("55") ? numero : `55${numero}`;
    return `https://wa.me/${numeroCompleto}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-wrap gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => setImportModalOpen(true)}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          Importar
        </Button>
        <Button
          variant="outline"
          onClick={exportarCSV}
          disabled={!dadosFiltrados?.length}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Exportar
        </Button>
        <Button
          onClick={() => recalcularMutation.mutate()}
          disabled={recalcularMutation.isPending || !empresaId}
          className="gap-2"
        >
          {recalcularMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Recalcular
        </Button>
      </div>

      {/* Filtro de Período */}
      <div className="flex gap-2 flex-wrap">
        {periodos.map((periodo) => (
          <Button
            key={periodo.value}
            variant={periodoSelecionado === periodo.value ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodoSelecionado(periodo.value)}
          >
            {periodo.label}
          </Button>
        ))}
      </div>

      {/* Cards de Segmentos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.keys(segmentoConfig) as Segmento[]).map((segmento) => {
          const config = segmentoConfig[segmento];
          const Icon = config.icon;
          const count = totaisPorSegmento[segmento] || 0;
          const percentual = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
          const isSelected = segmentoFiltro === segmento;

          return (
            <Card
              key={segmento}
              className={`cursor-pointer transition-all border-2 ${
                isSelected ? "ring-2 ring-primary" : ""
              } ${config.bgColor}`}
              onClick={() =>
                setSegmentoFiltro(isSelected ? "todos" : segmento)
              }
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-5 w-5 ${config.color}`} />
                  <span className={`font-medium text-sm ${config.color}`}>
                    {config.label}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className="text-xs text-gray-500">{percentual}%</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabela de Clientes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>
              Clientes{" "}
              {segmentoFiltro !== "todos" && (
                <Badge variant="secondary" className="ml-2">
                  {segmentoFiltro}
                </Badge>
              )}
            </span>
            <span className="text-sm font-normal text-gray-500">
              {dadosFiltrados?.length || 0} clientes
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !dadosFiltrados?.length ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Nenhum cliente encontrado.</p>
              <p className="text-sm mt-2">
                Clique em "Recalcular" para processar os dados RFM.
              </p>
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {dadosFiltrados.map((item) => {
                const segConfig = segmentoConfig[item.segmento];
                const Icon = segConfig.icon;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border ${segConfig.bgColor}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-gray-900">
                          {item.clientes?.nome || "N/A"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.clientes?.telefone}
                        </div>
                      </div>
                      <Badge className={`${segConfig.color} bg-white`}>
                        <Icon className="h-3 w-3 mr-1" />
                        {item.segmento}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                      <div>
                        <div className="text-gray-500">Recência</div>
                        <div className="font-medium">{item.recency_days}d</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Frequência</div>
                        <div className="font-medium">{item.frequency_count}x</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Valor</div>
                        <div className="font-medium">
                          R$ {item.monetary_value.toFixed(0)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <a
                        href={`tel:${item.clientes?.telefone}`}
                        className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Phone className="h-4 w-4" />
                        Ligar
                      </a>
                      <a
                        href={formatWhatsAppLink(item.clientes?.telefone || "")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-center">Recência</TableHead>
                    <TableHead className="text-center">Frequência</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Segmento</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dadosFiltrados.map((item) => {
                    const segConfig = segmentoConfig[item.segmento];
                    const Icon = segConfig.icon;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.clientes?.nome || "N/A"}
                        </TableCell>
                        <TableCell>{item.clientes?.telefone}</TableCell>
                        <TableCell className="text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline">
                                  R{item.recency_score}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {item.recency_days} dias desde o último serviço
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline">
                                  F{item.frequency_score}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {item.frequency_count} serviços no período
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="font-medium">
                                  R$ {item.monetary_value.toFixed(0)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Score M{item.monetary_score}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{item.rfm_score}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${segConfig.bgColor} ${segConfig.color} border`}>
                            <Icon className="h-3 w-3 mr-1" />
                            {item.segmento}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={`tel:${item.clientes?.telefone}`}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                  >
                                    <Phone className="h-4 w-4 text-gray-600" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>Ligar</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={formatWhatsAppLink(item.clientes?.telefone || "")}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                                  >
                                    <MessageCircle className="h-4 w-4 text-green-600" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>WhatsApp</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ImportarClientesModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        empresaId={empresaId || ""}
        onSuccess={() => {
          refetch();
          recalcularMutation.mutate();
        }}
      />
    </div>
  );
}
