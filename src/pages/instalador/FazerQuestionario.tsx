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
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

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

  const [questionario, setQuestionario] = useState<Questionario | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [tentativasRealizadas, setTentativasRealizadas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finalizando, setFinalizando] = useState(false);
  const [iniciadoEm] = useState(new Date());

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
