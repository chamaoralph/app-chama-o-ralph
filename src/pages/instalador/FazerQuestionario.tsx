import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { InstaladorLayout } from '@/components/layout/InstaladorLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { TimerQuestionario } from '@/components/TimerQuestionario';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

interface Questionario {
  id: string;
  titulo: string;
  nota_minima: number;
  tempo_limite_minutos: number | null;
  tentativas_maximas: number | null;
  tipos_servico_liberados: string[];
}

interface Pergunta {
  id: string;
  ordem: number;
  enunciado: string;
  pontos: number;
  alternativas: Alternativa[];
}

interface Alternativa {
  id: string;
  texto: string;
  ordem: number;
  correta: boolean;
}

export default function FazerQuestionario() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [questionario, setQuestionario] = useState<Questionario | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [tentativasRealizadas, setTentativasRealizadas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finalizando, setFinalizando] = useState(false);
  const [iniciadoEm] = useState(new Date());
  const [perguntaAtual, setPerguntaAtual] = useState(0);

  useEffect(() => {
    carregarQuestionario();
  }, [id, user]);

  async function carregarQuestionario() {
    if (!id || !user) return;

    try {
      // Buscar questionário
      const { data: quest, error: questError } = await supabase
        .from('questionarios')
        .select('*')
        .eq('id', id)
        .single();

      if (questError) throw questError;
      setQuestionario(quest);

      // Buscar perguntas e alternativas
      const { data: pergs, error: pergsError } = await supabase
        .from('perguntas')
        .select(`
          id,
          ordem,
          enunciado,
          pontos,
          alternativas (
            id,
            texto,
            ordem,
            correta
          )
        `)
        .eq('questionario_id', id)
        .order('ordem');

      if (pergsError) throw pergsError;
      setPerguntas(pergs);

      // Contar tentativas
      const { count } = await supabase
        .from('tentativas')
        .select('*', { count: 'exact', head: true })
        .eq('questionario_id', id)
        .eq('instalador_id', user.id);

      setTentativasRealizadas(count || 0);
    } catch (error) {
      console.error('Erro ao carregar questionário:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o questionário',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function finalizarQuestionario() {
    if (!questionario || !user) return;

    const totalPerguntas = perguntas.length;
    const totalRespondidas = Object.keys(respostas).length;

    if (totalRespondidas < totalPerguntas) {
      toast({
        title: 'Atenção',
        description: `Você precisa responder todas as ${totalPerguntas} perguntas`,
        variant: 'destructive',
      });
      return;
    }

    setFinalizando(true);

    try {
      // Calcular acertos
      let acertos = 0;
      const respostasParaSalvar = [];

      for (const pergunta of perguntas) {
        const alternativaEscolhidaId = respostas[pergunta.id];
        const alternativaCorreta = pergunta.alternativas.find(
          (alt) => alt.id === alternativaEscolhidaId
        );

        if (alternativaCorreta?.correta) {
          acertos++;
        }

        respostasParaSalvar.push({
          pergunta_id: pergunta.id,
          alternativa_escolhida_id: alternativaEscolhidaId,
          correta: alternativaCorreta?.correta || false,
        });
      }

      const notaObtida = (acertos / totalPerguntas) * 100;
      const aprovado = notaObtida >= questionario.nota_minima;

      const tempoGasto = Math.floor(
        (new Date().getTime() - iniciadoEm.getTime()) / 1000 / 60
      );

      // Buscar empresa_id
      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single();

      // Criar tentativa
      const { data: tentativa, error: tentativaError } = await supabase
        .from('tentativas')
        .insert({
          questionario_id: questionario.id,
          instalador_id: user.id,
          empresa_id: userData?.empresa_id,
          nota_obtida: notaObtida,
          total_perguntas: totalPerguntas,
          acertos,
          aprovado,
          tempo_gasto_minutos: tempoGasto,
          finalizada_em: new Date().toISOString(),
        })
        .select()
        .single();

      if (tentativaError) throw tentativaError;

      // Salvar respostas
      const respostasComTentativa = respostasParaSalvar.map((r) => ({
        ...r,
        tentativa_id: tentativa.id,
      }));

      const { error: respostasError } = await supabase
        .from('respostas_tentativa')
        .insert(respostasComTentativa);

      if (respostasError) throw respostasError;

      // Redirecionar para resultado
      navigate(`/instalador/resultado-questionario/${tentativa.id}`);
    } catch (error) {
      console.error('Erro ao finalizar questionário:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível finalizar o questionário',
        variant: 'destructive',
      });
      setFinalizando(false);
    }
  }

  const proximaPergunta = () => {
    if (perguntaAtual < perguntas.length - 1) {
      setPerguntaAtual((prev) => prev + 1);
    }
  };

  const perguntaAnterior = () => {
    if (perguntaAtual > 0) {
      setPerguntaAtual((prev) => prev - 1);
    }
  };

  const irParaPergunta = (index: number) => {
    setPerguntaAtual(index);
  };

  if (loading) {
    return (
      <InstaladorLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </InstaladorLayout>
    );
  }

  if (!questionario) {
    return (
      <InstaladorLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Questionário não encontrado</AlertDescription>
        </Alert>
      </InstaladorLayout>
    );
  }

  const podeRealizar =
    !questionario.tentativas_maximas ||
    tentativasRealizadas < questionario.tentativas_maximas;

  if (!podeRealizar) {
    return (
      <InstaladorLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Você atingiu o número máximo de tentativas para este questionário
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/instalador/conhecimento')} className="mt-4">
          Voltar
        </Button>
      </InstaladorLayout>
    );
  }

  const progresso = (Object.keys(respostas).length / perguntas.length) * 100;
  const perguntaAtualData = perguntas[perguntaAtual];
  const isUltimaPergunta = perguntaAtual === perguntas.length - 1;
  const isPrimeiraPergunta = perguntaAtual === 0;

  // Renderização Mobile - Uma pergunta por vez
  if (isMobile) {
    return (
      <InstaladorLayout>
        <div className="pb-24">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{questionario.titulo}</CardTitle>
                <CardDescription className="text-xs">
                  Nota mínima: {questionario.nota_minima}%
                  {questionario.tentativas_maximas && (
                    <> | Tentativa {tentativasRealizadas + 1}/{questionario.tentativas_maximas}</>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {questionario.tempo_limite_minutos && (
                  <TimerQuestionario
                    tempoLimiteMinutos={questionario.tempo_limite_minutos}
                    onTempoEsgotado={finalizarQuestionario}
                    iniciado={true}
                  />
                )}

                {/* Indicadores de progresso por pergunta */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {perguntas.map((pergunta, index) => (
                    <button
                      key={pergunta.id}
                      onClick={() => irParaPergunta(index)}
                      className={`w-7 h-7 rounded-full text-xs font-medium transition-all ${
                        index === perguntaAtual
                          ? 'bg-primary text-primary-foreground scale-110'
                          : respostas[pergunta.id]
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  Pergunta {perguntaAtual + 1} de {perguntas.length}
                </div>
              </CardContent>
            </Card>

            {/* Pergunta atual */}
            {perguntaAtualData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {perguntaAtual + 1}. {perguntaAtualData.enunciado}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={respostas[perguntaAtualData.id]}
                    onValueChange={(value) =>
                      setRespostas((prev) => ({ ...prev, [perguntaAtualData.id]: value }))
                    }
                  >
                    {perguntaAtualData.alternativas
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((alternativa) => (
                        <div key={alternativa.id} className="flex items-center space-x-3 py-2">
                          <RadioGroupItem value={alternativa.id} id={alternativa.id} />
                          <Label htmlFor={alternativa.id} className="cursor-pointer text-sm flex-1">
                            {alternativa.texto}
                          </Label>
                        </div>
                      ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Navegação fixa no rodapé - z-index maior que a nav do layout */}
          <div className="fixed bottom-16 left-0 right-0 bg-background border-t p-4 z-[60]">
            <div className="flex gap-3 max-w-lg mx-auto">
              <Button
                variant="outline"
                onClick={perguntaAnterior}
                disabled={isPrimeiraPergunta}
                className="flex-1"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>

              {isUltimaPergunta ? (
                <Button
                  onClick={finalizarQuestionario}
                  disabled={finalizando}
                  className="flex-1"
                >
                  {finalizando ? (
                    'Finalizando...'
                  ) : (
                    <>
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Finalizar
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={proximaPergunta} className="flex-1">
                  Próxima
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </InstaladorLayout>
    );
  }

  // Renderização Desktop - Todas as perguntas visíveis
  return (
    <InstaladorLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{questionario.titulo}</CardTitle>
            <CardDescription>
              Total de perguntas: {perguntas.length} | Nota mínima: {questionario.nota_minima}%
              {questionario.tentativas_maximas && (
                <> | Tentativas: {tentativasRealizadas + 1}/{questionario.tentativas_maximas}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {questionario.tempo_limite_minutos && (
              <TimerQuestionario
                tempoLimiteMinutos={questionario.tempo_limite_minutos}
                onTempoEsgotado={finalizarQuestionario}
                iniciado={true}
              />
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progresso</span>
                <span>
                  {Object.keys(respostas).length}/{perguntas.length} perguntas
                </span>
              </div>
              <Progress value={progresso} />
            </div>
          </CardContent>
        </Card>

        {perguntas.map((pergunta, index) => (
          <Card key={pergunta.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {index + 1}. {pergunta.enunciado}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={respostas[pergunta.id]}
                onValueChange={(value) =>
                  setRespostas((prev) => ({ ...prev, [pergunta.id]: value }))
                }
              >
                {pergunta.alternativas
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((alternativa) => (
                    <div key={alternativa.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={alternativa.id} id={alternativa.id} />
                      <Label htmlFor={alternativa.id} className="cursor-pointer">
                        {alternativa.texto}
                      </Label>
                    </div>
                  ))}
              </RadioGroup>
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/instalador/conhecimento')}
            disabled={finalizando}
          >
            Cancelar
          </Button>
          <Button onClick={finalizarQuestionario} disabled={finalizando}>
            {finalizando ? (
              'Finalizando...'
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Finalizar Questionário
              </>
            )}
          </Button>
        </div>
      </div>
    </InstaladorLayout>
  );
}
