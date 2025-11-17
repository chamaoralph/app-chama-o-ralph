import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Award } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CertificadoBadgeProps {
  tipoServico: string;
  ativo: boolean;
  dataObtencao: Date;
  validade?: Date | null;
}

export function CertificadoBadge({ tipoServico, ativo, dataObtencao, validade }: CertificadoBadgeProps) {
  const estaExpirado = validade && new Date(validade) < new Date();
  const status = !ativo || estaExpirado ? 'expirado' : 'ativo';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={status === 'ativo' ? 'default' : 'secondary'}
            className="gap-1"
          >
            <Award className="h-3 w-3" />
            {tipoServico}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <p className="font-semibold">Certificado em: {format(new Date(dataObtencao), "dd/MM/yyyy", { locale: ptBR })}</p>
            {validade && (
              <p>Válido até: {format(new Date(validade), "dd/MM/yyyy", { locale: ptBR })}</p>
            )}
            {status === 'expirado' && <p className="text-destructive">Expirado</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
