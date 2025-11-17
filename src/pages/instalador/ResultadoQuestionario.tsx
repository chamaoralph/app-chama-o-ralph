import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { InstaladorLayout } from '@/components/layout/InstaladorLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Award, Clock, RotateCcw, BookOpen } from 'lucide-react';
import { CertificadoBadge } from '@/components/CertificadoBadge';

interface Tentativa {
  id: string;
  questionario_id: string;
  nota_obtida: number;
  total_perguntas: number;
  acertos: number;
  aprovado: boolean;
  tempo_gasto_minutos: number;
  questionario: {
    id: string;
    titulo: string;
    nota_minima: number;
    tentativas_maximas: number | null;
    tipos_servico_liberados: string[];
  };
}

interface Certificacao {
  tipos_servico_liberados: string[];
  created_at: string;
  validade_ate: string | null;
  ativa: boolean;
}

export default function ResultadoQuestionario() {
  const { tentativaId } = useParams<{ tentativaId: string }>();
  const navigate = useNavigate();

  const [tentativa, setTentativa] = useState<Tentativa | null>(null);
  const [certificacao, setCertificacao] = useState<Certificacao | null>(null);
  const [tentativasRealizadas, setTentativasRealizadas] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarResultado();
  }, [tentativaId]);

  async function carregarResultado() {
    if (!tentativaId) return;

    try {
      // Buscar tentativa com dados do questionário
      const { data: tent, error: tentError } = await supabase
        .from('tentativas')
        .select(`
          *,
          questionario:questionarios (
            id,
            titulo,
            nota_minima,
            tentativas_maximas,
            tipos_servico_liberados
          )
        `)
        .eq('id', tentativaId)
        .single();

      if (tentError) throw tentError;
      setTentativa(tent);

      // Se aprovado, buscar certificação
      if (tent.aprovado) {
        const { data: cert } = await supabase
          .from('certificacoes')
          .select('*')
          .eq('tentativa_id', tentativaId)
          .single();

        if (cert) setCertificacao(cert);
      }

      // Contar tentativas do questionário
      const { count } = await supabase
        .from('tentativas')
        .select('*', { count: 'exact', head: true })
        .eq('questionario_id', tent.questionario_id)
        .eq('instalador_id', tent.instalador_id);

      setTentativasRealizadas(count || 0);
    } catch (error) {
      console.error('Erro ao carregar resultado:', error);
    } finally {
      setLoading(false);
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

  if (!tentativa) {
    return (
      <InstaladorLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Resultado não encontrado</p>
        </div>
      </InstaladorLayout>
    );
  }

  const podeRefazer =
    !tentativa.questionario.tentativas_maximas ||
    tentativasRealizadas < tentativa.questionario.tentativas_maximas;

  return (
    <InstaladorLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className={tentativa.aprovado ? 'border-green-500' : 'border-destructive'}>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {tentativa.aprovado ? (
                <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
              ) : (
                <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-12 w-12 text-destructive" />
                </div>
              )}
            </div>
            <CardTitle className="text-2xl">
              {tentativa.aprovado ? '🎉 APROVADO!' : '😔 REPROVADO'}
            </CardTitle>
            <CardDescription>{tentativa.questionario.titulo}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-3xl font-bold text-primary">
                  {tentativa.nota_obtida.toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground">Nota Obtida</div>
                <div className="text-xs text-muted-foreground mt-1">
                  (Mínimo: {tentativa.questionario.nota_minima}%)
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <div className="text-3xl font-bold text-primary">
                  {tentativa.acertos}/{tentativa.total_perguntas}
                </div>
                <div className="text-sm text-muted-foreground">Acertos</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Tempo gasto: {tentativa.tempo_gasto_minutos} minutos</span>
            </div>

            {tentativa.aprovado && certificacao && (
              <div className="space-y-4 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-900">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Award className="h-5 w-5" />
                  <span className="font-semibold">Você está certificado para:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {certificacao.tipos_servico_liberados.map((tipo) => (
                    <CertificadoBadge
                      key={tipo}
                      tipoServico={tipo}
                      ativo={certificacao.ativa}
                      dataObtencao={new Date(certificacao.created_at)}
                      validade={certificacao.validade_ate ? new Date(certificacao.validade_ate) : null}
                    />
                  ))}
                </div>
              </div>
            )}

            {!tentativa.aprovado && (
              <div className="space-y-2 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm text-center">
                  Não foi dessa vez. Revise o conteúdo e tente novamente!
                </p>
                {tentativa.questionario.tentativas_maximas && (
                  <p className="text-xs text-center text-muted-foreground">
                    Tentativas: {tentativasRealizadas}/{tentativa.questionario.tentativas_maximas}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {tentativa.aprovado ? (
                <>
                  <Button onClick={() => navigate('/instalador/meus-certificados')}>
                    <Award className="mr-2 h-4 w-4" />
                    Ver Meus Certificados
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/instalador/servicos-disponiveis')}
                  >
                    Ver Serviços Disponíveis
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/instalador/conhecimento')}
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Revisar Conteúdo
                  </Button>
                  {podeRefazer && (
                    <Button onClick={() => navigate(`/instalador/fazer-questionario/${tentativa.questionario_id}`)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Tentar Novamente
                    </Button>
                  )}
                </>
              )}
              
              <Button
                variant="ghost"
                onClick={() => navigate('/instalador/conhecimento')}
              >
                Voltar para Base de Conhecimento
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </InstaladorLayout>
  );
}
