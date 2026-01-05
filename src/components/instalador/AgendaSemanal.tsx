import { useState } from "react";
import { format, startOfWeek, addDays, isSameDay, isToday, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgendaServicoCard } from "./AgendaServicoCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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

interface AgendaSemanalProps {
  servicos: Servico[];
  onIniciar: (id: string) => void;
  onFinalizar: (id: string) => void;
}

export function AgendaSemanal({ servicos, onIniciar, onFinalizar }: AgendaSemanalProps) {
  const [semanaBase, setSemanaBase] = useState(new Date());
  const [diaSelecionadoMobile, setDiaSelecionadoMobile] = useState<Date | null>(null);
  const isMobile = useIsMobile();

  // Gerar dias da semana (Segunda a Sábado)
  const gerarDiasSemana = (dataBase: Date) => {
    const inicio = startOfWeek(dataBase, { weekStartsOn: 1 }); // Segunda
    return Array.from({ length: 6 }, (_, i) => addDays(inicio, i)); // Segunda a Sábado
  };

  const diasSemana = gerarDiasSemana(semanaBase);

  // Agrupar serviços por dia
  const servicosPorDia = diasSemana.map(dia => ({
    data: dia,
    servicos: servicos.filter(s => 
      isSameDay(new Date(s.data_servico_agendada), dia)
    ).sort((a, b) => 
      new Date(a.data_servico_agendada).getTime() - new Date(b.data_servico_agendada).getTime()
    )
  }));

  const semanaAnterior = () => setSemanaBase(subWeeks(semanaBase, 1));
  const proximaSemana = () => setSemanaBase(addWeeks(semanaBase, 1));
  const irParaHoje = () => {
    setSemanaBase(new Date());
    setDiaSelecionadoMobile(null);
  };

  // Formatar período da semana
  const periodoSemana = `${format(diasSemana[0], "dd MMM", { locale: ptBR })} - ${format(diasSemana[5], "dd MMM yyyy", { locale: ptBR })}`;

  // Mobile: Visualização com tabs/cards
  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Header com navegação */}
        <div className="flex items-center justify-between bg-card rounded-lg p-3 shadow-sm">
          <Button variant="ghost" size="icon" onClick={semanaAnterior}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{periodoSemana}</p>
            <Button variant="link" size="sm" onClick={irParaHoje} className="h-auto p-0 text-xs">
              Ir para hoje
            </Button>
          </div>
          
          <Button variant="ghost" size="icon" onClick={proximaSemana}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Cards de dias (scroll horizontal) */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {servicosPorDia.map(({ data, servicos: servicosDia }) => (
            <button
              key={data.toISOString()}
              onClick={() => setDiaSelecionadoMobile(
                diaSelecionadoMobile && isSameDay(diaSelecionadoMobile, data) ? null : data
              )}
              className={cn(
                "flex-shrink-0 w-16 p-2 rounded-lg border text-center transition-colors",
                isToday(data) && "border-primary",
                diaSelecionadoMobile && isSameDay(diaSelecionadoMobile, data) 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-card",
                servicosDia.length > 0 && !diaSelecionadoMobile?.getTime() && "bg-green-50 border-green-200"
              )}
            >
              <p className={cn(
                "text-[10px] uppercase",
                diaSelecionadoMobile && isSameDay(diaSelecionadoMobile, data) 
                  ? "text-primary-foreground/80" 
                  : "text-muted-foreground"
              )}>
                {format(data, "EEE", { locale: ptBR })}
              </p>
              <p className={cn(
                "text-lg font-bold",
                diaSelecionadoMobile && isSameDay(diaSelecionadoMobile, data) 
                  ? "text-primary-foreground" 
                  : "text-foreground"
              )}>
                {format(data, "dd")}
              </p>
              {servicosDia.length > 0 && (
                <p className={cn(
                  "text-[10px]",
                  diaSelecionadoMobile && isSameDay(diaSelecionadoMobile, data) 
                    ? "text-primary-foreground/80" 
                    : "text-green-600"
                )}>
                  {servicosDia.length} serviço{servicosDia.length > 1 ? 's' : ''}
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Lista de serviços do dia selecionado ou todos */}
        <div className="space-y-2">
          {diaSelecionadoMobile ? (
            <>
              <h3 className="font-medium text-foreground">
                {format(diaSelecionadoMobile, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </h3>
              {servicosPorDia
                .find(d => isSameDay(d.data, diaSelecionadoMobile))
                ?.servicos.map(servico => (
                  <AgendaServicoCard
                    key={servico.id}
                    servico={servico}
                    onIniciar={onIniciar}
                    onFinalizar={onFinalizar}
                  />
                )) || (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Sem serviços neste dia</p>
                </div>
              )}
            </>
          ) : (
            // Mostrar todos os serviços da semana agrupados
            servicosPorDia.map(({ data, servicos: servicosDia }) => (
              servicosDia.length > 0 && (
                <div key={data.toISOString()} className="space-y-2">
                  <h3 className={cn(
                    "font-medium text-sm",
                    isToday(data) ? "text-primary" : "text-foreground"
                  )}>
                    {isToday(data) ? "Hoje - " : ""}{format(data, "EEEE, dd/MM", { locale: ptBR })}
                  </h3>
                  {servicosDia.map(servico => (
                    <AgendaServicoCard
                      key={servico.id}
                      servico={servico}
                      onIniciar={onIniciar}
                      onFinalizar={onFinalizar}
                    />
                  ))}
                </div>
              )
            ))
          )}
          
          {!diaSelecionadoMobile && servicos.length === 0 && (
            <div className="text-center py-8 text-muted-foreground bg-card rounded-lg">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum serviço agendado esta semana</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop: Grid de 6 colunas
  return (
    <div className="space-y-4">
      {/* Header com navegação */}
      <div className="flex items-center justify-between bg-card rounded-lg p-4 shadow-sm">
        <Button variant="outline" onClick={semanaAnterior} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{periodoSemana}</p>
          <Button variant="link" size="sm" onClick={irParaHoje}>
            Ir para hoje
          </Button>
        </div>
        
        <Button variant="outline" onClick={proximaSemana} className="gap-2">
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid de dias */}
      <div className="grid grid-cols-6 gap-4">
        {servicosPorDia.map(({ data, servicos: servicosDia }) => (
          <div 
            key={data.toISOString()}
            className={cn(
              "bg-card rounded-lg border min-h-[300px] flex flex-col",
              isToday(data) && "border-primary border-2"
            )}
          >
            {/* Header do dia */}
            <div className={cn(
              "p-3 border-b text-center",
              isToday(data) && "bg-primary/10"
            )}>
              <p className="text-xs uppercase text-muted-foreground">
                {format(data, "EEEE", { locale: ptBR })}
              </p>
              <p className={cn(
                "text-2xl font-bold",
                isToday(data) ? "text-primary" : "text-foreground"
              )}>
                {format(data, "dd")}
              </p>
            </div>

            {/* Lista de serviços */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
              {servicosDia.length > 0 ? (
                servicosDia.map(servico => (
                  <AgendaServicoCard
                    key={servico.id}
                    servico={servico}
                    onIniciar={onIniciar}
                    onFinalizar={onFinalizar}
                  />
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Sem serviços
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
