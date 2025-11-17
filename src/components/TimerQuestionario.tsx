import { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TimerQuestionarioProps {
  tempoLimiteMinutos: number;
  onTempoEsgotado: () => void;
  iniciado: boolean;
}

export function TimerQuestionario({ tempoLimiteMinutos, onTempoEsgotado, iniciado }: TimerQuestionarioProps) {
  const [tempoRestante, setTempoRestante] = useState(tempoLimiteMinutos * 60); // em segundos
  const [alertaMostrado, setAlertaMostrado] = useState(false);

  useEffect(() => {
    if (!iniciado) return;

    const intervalo = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev <= 1) {
          clearInterval(intervalo);
          onTempoEsgotado();
          return 0;
        }
        
        // Alerta quando faltar 5 minutos
        if (prev === 300 && !alertaMostrado) {
          setAlertaMostrado(true);
        }
        
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalo);
  }, [iniciado, onTempoEsgotado, alertaMostrado]);

  const minutos = Math.floor(tempoRestante / 60);
  const segundos = tempoRestante % 60;
  const estaProximoDoFim = tempoRestante <= 300; // 5 minutos

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 p-3 rounded-lg ${
        estaProximoDoFim ? 'bg-destructive/10 text-destructive' : 'bg-muted'
      }`}>
        <Clock className="h-4 w-4" />
        <span className="font-mono text-lg font-semibold">
          {String(minutos).padStart(2, '0')}:{String(segundos).padStart(2, '0')}
        </span>
      </div>
      
      {estaProximoDoFim && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Atenção! Restam apenas {minutos} minutos!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
