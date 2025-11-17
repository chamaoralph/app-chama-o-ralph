import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { InstaladorLayout } from '@/components/layout/InstaladorLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Award, Calendar, Search, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CertificadoBadge } from '@/components/CertificadoBadge';

interface Certificacao {
  id: string;
  tipos_servico_liberados: string[];
  created_at: string;
  validade_ate: string | null;
  ativa: boolean;
  questionario: {
    titulo: string;
  };
  tentativa: {
    nota_obtida: number;
  };
}

export default function MeusCertificados() {
  const { user } = useAuth();
  const [certificacoes, setCertificacoes] = useState<Certificacao[]>([]);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarCertificacoes();
  }, [user]);

  async function carregarCertificacoes() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('certificacoes')
        .select(`
          *,
          questionario:questionarios (titulo),
          tentativa:tentativas (nota_obtida)
        `)
        .eq('instalador_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCertificacoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar certificações:', error);
    } finally {
      setLoading(false);
    }
  }

  const certificacoesFiltradas = certificacoes.filter((cert) =>
    cert.tipos_servico_liberados.some((tipo) =>
      tipo.toLowerCase().includes(filtro.toLowerCase())
    ) || cert.questionario.titulo.toLowerCase().includes(filtro.toLowerCase())
  );

  const certificacoesAtivas = certificacoes.filter((c) => {
    const estaAtiva = c.ativa;
    const naoExpirou = !c.validade_ate || new Date(c.validade_ate) >= new Date();
    return estaAtiva && naoExpirou;
  });

  if (loading) {
    return (
      <InstaladorLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </InstaladorLayout>
    );
  }

  return (
    <InstaladorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Minhas Certificações</h1>
          <p className="text-muted-foreground">
            Gerencie e visualize suas certificações profissionais
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Certificações</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{certificacoes.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Certificações Ativas</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{certificacoesAtivas.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tipos de Serviço</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(certificacoesAtivas.flatMap((c) => c.tipos_servico_liberados)).size}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por tipo de serviço ou título..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="pl-10"
          />
        </div>

        {certificacoesFiltradas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {filtro
                  ? 'Nenhuma certificação encontrada com esse filtro'
                  : 'Você ainda não possui certificações'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {certificacoesFiltradas.map((cert) => {
              const estaExpirada =
                !cert.ativa || (cert.validade_ate && new Date(cert.validade_ate) < new Date());

              return (
                <Card key={cert.id} className={estaExpirada ? 'opacity-60' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{cert.questionario.titulo}</CardTitle>
                        <CardDescription>
                          <div className="flex items-center gap-2 text-xs">
                            <Calendar className="h-3 w-3" />
                            Obtido em {format(new Date(cert.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        </CardDescription>
                      </div>
                      {estaExpirada ? (
                        <Badge variant="secondary">Expirado</Badge>
                      ) : (
                        <Badge variant="default">Ativo</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Tipos de Serviço Liberados:</p>
                      <div className="flex flex-wrap gap-2">
                        {cert.tipos_servico_liberados.map((tipo) => (
                          <CertificadoBadge
                            key={tipo}
                            tipoServico={tipo}
                            ativo={cert.ativa}
                            dataObtencao={new Date(cert.created_at)}
                            validade={cert.validade_ate ? new Date(cert.validade_ate) : null}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm border-t pt-3">
                      <span className="text-muted-foreground">Nota Obtida:</span>
                      <span className="font-bold text-primary">
                        {cert.tentativa.nota_obtida.toFixed(0)}%
                      </span>
                    </div>

                    {cert.validade_ate && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Válido até:</span>
                        <span>
                          {format(new Date(cert.validade_ate), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </InstaladorLayout>
  );
}
