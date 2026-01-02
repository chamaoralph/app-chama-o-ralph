import { Crown, Users, AlertTriangle, UserX, Ghost } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Segmento = "VIP" | "Ativo" | "Em Risco" | "Inativo" | "Perdido";

interface RFMBadgeProps {
  segmento: Segmento;
  recencyDays?: number;
  frequencyCount?: number;
  monetaryValue?: number;
  showTooltip?: boolean;
  size?: "sm" | "md";
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

export function RFMBadge({
  segmento,
  recencyDays,
  frequencyCount,
  monetaryValue,
  showTooltip = true,
  size = "md",
}: RFMBadgeProps) {
  const config = segmentoConfig[segmento];
  const Icon = config.icon;

  const badge = (
    <Badge
      className={`${config.bgColor} ${config.color} border ${
        size === "sm" ? "text-xs px-1.5 py-0.5" : ""
      }`}
    >
      <Icon className={`${size === "sm" ? "h-3 w-3" : "h-4 w-4"} mr-1`} />
      {config.label}
    </Badge>
  );

  if (!showTooltip || (recencyDays === undefined && frequencyCount === undefined && monetaryValue === undefined)) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <div className="text-sm space-y-1">
            {recencyDays !== undefined && (
              <p>Último serviço: {recencyDays > 9000 ? "Nunca" : `${recencyDays} dias atrás`}</p>
            )}
            {frequencyCount !== undefined && (
              <p>Serviços realizados: {frequencyCount}</p>
            )}
            {monetaryValue !== undefined && (
              <p>Valor total: R$ {monetaryValue.toFixed(2)}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
