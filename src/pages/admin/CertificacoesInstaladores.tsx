import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Award, TrendingUp, Users, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CertificadoBadge } from '@/components/CertificadoBadge';

export default function CertificacoesInstaladores() {
  const [instaladorFiltro, setInstaladorFiltro] = useState('todos');
  const [statusFiltro, setStatusFiltro] = useState('todos');

  const { data: certificacoes } = useQuery({
    queryKey: ['admin-certificacoes', instaladorFiltro, statusFiltro],
    queryFn: async () => {
      let query = supabase
        .from('certificacoes')
        .select(`
          *,
          instalador:usuarios!inner (
            nome,
            id
          ),
          questionario:questionarios (
            titulo
          ),
          tentativa:tentativas (
            nota_obtida
          )
        `)
        .order('created_at', { ascending: false });

      if (instaladorFiltro !== 'todos') {
        query = query.eq('instalador_id', instaladorFiltro);
      }

      if (statusFiltro === 'ativo') {
        query = query.eq('ativa', true);
      } else if (statusFiltro === 'expirado') {
        query = query.eq('ativa', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: instaladores } = useQuery({
    queryKey: ['instaladores-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('tipo', 'instalador')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const totalCertificacoes = certificacoes?.length || 0;
  const certificacoesAtivas = certificacoes?.filter((c) => {
    const estaAtiva = c.ativa;
    const naoExpirou = !c.validade_ate || new Date(c.validade_ate) >= new Date();
    return estaAtiva && naoExpirou;
  }).length || 0;

  const totalInstaladores = new Set(certificacoes?.map((c) => c.instalador_id)).size;
  
  const mediaNotas = certificacoes?.length
    ? (certificacoes.reduce((sum, c) => sum + c.tentativa.nota_obtida, 0) / certificacoes.length).toFixed(1)
    : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Certificações de Instaladores</h1>
          <p className="text-muted-foreground">
            Acompanhe as certificações e qualificações da equipe
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Certificações</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCertificacoes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Certificações Ativas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{certificacoesAtivas}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Instaladores Certificados</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalInstaladores}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média de Notas</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mediaNotas}%</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Todas as Certificações</CardTitle>
              <div className="flex gap-2">
                <Select value={instaladorFiltro} onValueChange={setInstaladorFiltro}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtrar por instalador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Instaladores</SelectItem>
                    {instaladores?.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="ativo">Ativas</SelectItem>
                    <SelectItem value="expirado">Expiradas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!certificacoes || certificacoes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma certificação encontrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instalador</TableHead>
                    <TableHead>Questionário</TableHead>
                    <TableHead>Tipos de Serviço</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificacoes.map((cert) => {
                    const estaExpirada =
                      !cert.ativa || (cert.validade_ate && new Date(cert.validade_ate) < new Date());

                    return (
                      <TableRow key={cert.id}>
                        <TableCell className="font-medium">{cert.instalador.nome}</TableCell>
                        <TableCell>{cert.questionario.titulo}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
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
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-primary">
                            {cert.tentativa.nota_obtida.toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          {format(new Date(cert.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {cert.validade_ate
                            ? format(new Date(cert.validade_ate), "dd/MM/yyyy", { locale: ptBR })
                            : 'Sem validade'}
                        </TableCell>
                        <TableCell>
                          {estaExpirada ? (
                            <Badge variant="secondary">Expirado</Badge>
                          ) : (
                            <Badge variant="default">Ativo</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
