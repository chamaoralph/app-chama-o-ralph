import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  Cloud, 
  HardDrive, 
  FileImage, 
  FileText, 
  Receipt,
  Loader2,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Archive
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import JSZip from 'jszip';

interface ArquivoBucket {
  nome: string;
  tamanho: number;
  url: string;
  criado_em: string;
}

interface BucketInfo {
  total_arquivos: number;
  tamanho_bytes: number;
  arquivos: ArquivoBucket[];
}

interface BackupData {
  sucesso: boolean;
  buckets: Record<string, BucketInfo>;
  resumo: {
    total_arquivos: number;
    tamanho_total_mb: number;
  };
  gerado_em: string;
  validade_urls: string;
}

const formatarTamanho = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getBucketIcon = (bucket: string) => {
  switch (bucket) {
    case 'fotos-servicos': return <FileImage className="h-4 w-4" />;
    case 'notas-fiscais': return <FileText className="h-4 w-4" />;
    case 'comprovantes': return <Receipt className="h-4 w-4" />;
    default: return <HardDrive className="h-4 w-4" />;
  }
};

const getBucketLabel = (bucket: string) => {
  switch (bucket) {
    case 'fotos-servicos': return 'Fotos de Serviços';
    case 'notas-fiscais': return 'Notas Fiscais';
    case 'comprovantes': return 'Comprovantes';
    default: return bucket;
  }
};

export function BackupStorageCard() {
  const [loading, setLoading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0 });
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);

  const gerarListaBackup = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error('Você precisa estar logado');
        return;
      }

      const response = await supabase.functions.invoke('backup-storage', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setBackupData(response.data);
      toast.success('Lista de backup gerada com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar backup:', error);
      toast.error('Erro ao gerar lista de backup');
    } finally {
      setLoading(false);
    }
  };

  const copiarUrl = async (url: string, nome: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(nome);
    toast.success('URL copiada!');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const exportarComoJson = () => {
    if (!backupData) return;
    
    const dataStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-storage-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo JSON exportado!');
  };

  const baixarTudoZip = async () => {
    // Primeiro, garantir que temos a lista de arquivos
    let dados = backupData;
    
    if (!dados) {
      setLoading(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          toast.error('Você precisa estar logado');
          setLoading(false);
          return;
        }

        const response = await supabase.functions.invoke('backup-storage', {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        dados = response.data;
        setBackupData(dados);
      } catch (error) {
        console.error('Erro ao gerar lista:', error);
        toast.error('Erro ao obter lista de arquivos');
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    if (!dados) return;

    setDownloadingZip(true);
    
    try {
      const zip = new JSZip();
      const dataAtual = new Date().toISOString().split('T')[0];
      
      // Coletar todos os arquivos de todos os buckets
      const todosArquivos: { bucket: string; arquivo: ArquivoBucket }[] = [];
      
      for (const [bucket, info] of Object.entries(dados.buckets)) {
        for (const arquivo of info.arquivos) {
          todosArquivos.push({ bucket, arquivo });
        }
      }

      const total = todosArquivos.length;
      setZipProgress({ current: 0, total });

      if (total === 0) {
        toast.warning('Nenhum arquivo para baixar');
        setDownloadingZip(false);
        return;
      }

      toast.info(`Baixando ${total} arquivos... Isso pode levar alguns minutos.`);

      // Baixar arquivos em lotes de 5 para não sobrecarregar
      const batchSize = 5;
      for (let i = 0; i < todosArquivos.length; i += batchSize) {
        const batch = todosArquivos.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async ({ bucket, arquivo }) => {
            try {
              const response = await fetch(arquivo.url);
              if (!response.ok) {
                console.error(`Erro ao baixar ${arquivo.nome}`);
                return;
              }
              
              const blob = await response.blob();
              const caminho = `backup-${dataAtual}/${bucket}/${arquivo.nome}`;
              zip.file(caminho, blob);
            } catch (err) {
              console.error(`Erro ao baixar ${arquivo.nome}:`, err);
            }
          })
        );

        setZipProgress({ current: Math.min(i + batchSize, total), total });
      }

      // Gerar o ZIP
      toast.info('Gerando arquivo ZIP...');
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Baixar o ZIP
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${dataAtual}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Backup ZIP baixado com sucesso! (${total} arquivos)`);
    } catch (error) {
      console.error('Erro ao gerar ZIP:', error);
      toast.error('Erro ao gerar backup ZIP');
    } finally {
      setDownloadingZip(false);
      setZipProgress({ current: 0, total: 0 });
    }
  };

  // Limite de storage (estimativa baseada no plano)
  const limiteStorageMb = 1024; // 1GB
  const usadoMb = backupData?.resumo.tamanho_total_mb || 0;
  const percentualUsado = Math.min((usadoMb / limiteStorageMb) * 100, 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Backup e Storage
        </CardTitle>
        <CardDescription>
          Gerencie backups e visualize o uso de armazenamento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Estatísticas de Storage */}
        {backupData && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Espaço utilizado</span>
              <span className="font-medium">{usadoMb.toFixed(2)} MB / {limiteStorageMb} MB</span>
            </div>
            <Progress value={percentualUsado} className="h-2" />
            
            <div className="grid grid-cols-3 gap-3 pt-2">
              {Object.entries(backupData.buckets).map(([bucket, info]) => (
                <div key={bucket} className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="flex justify-center mb-1">
                    {getBucketIcon(bucket)}
                  </div>
                  <p className="text-lg font-semibold">{info.total_arquivos}</p>
                  <p className="text-xs text-muted-foreground">{getBucketLabel(bucket)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Ações de Backup */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download Manual
          </h4>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={gerarListaBackup} 
              disabled={loading || downloadingZip}
              variant="outline"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {backupData ? 'Atualizar Lista' : 'Gerar Lista'}
            </Button>

            <Button 
              onClick={baixarTudoZip} 
              disabled={downloadingZip || loading}
              variant="default"
            >
              {downloadingZip ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              {downloadingZip 
                ? `Baixando... ${zipProgress.current}/${zipProgress.total}` 
                : 'Baixar Tudo (ZIP)'}
            </Button>
            
            {backupData && (
              <Button onClick={exportarComoJson} variant="secondary">
                <Download className="h-4 w-4 mr-2" />
                JSON
              </Button>
            )}
          </div>

          {backupData && (
            <div className="text-xs text-muted-foreground">
              Gerado em: {new Date(backupData.gerado_em).toLocaleString('pt-BR')}
              <br />
              URLs válidas por: {backupData.validade_urls}
            </div>
          )}
        </div>

        {/* Lista de Arquivos por Bucket */}
        {backupData && (
          <div className="space-y-3">
            {Object.entries(backupData.buckets).map(([bucket, info]) => (
              <div key={bucket} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedBucket(expandedBucket === bucket ? null : bucket)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {getBucketIcon(bucket)}
                    <span className="font-medium">{getBucketLabel(bucket)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{info.total_arquivos} arquivos</Badge>
                    <Badge variant="outline">{formatarTamanho(info.tamanho_bytes)}</Badge>
                  </div>
                </button>
                
                {expandedBucket === bucket && info.arquivos.length > 0 && (
                  <ScrollArea className="h-48 border-t">
                    <div className="p-2 space-y-1">
                      {info.arquivos.map((arquivo) => (
                        <div 
                          key={arquivo.nome}
                          className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm"
                        >
                          <div className="flex-1 truncate pr-2">
                            <span className="font-mono text-xs">{arquivo.nome}</span>
                            <span className="text-muted-foreground ml-2">
                              ({formatarTamanho(arquivo.tamanho)})
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => copiarUrl(arquivo.url, arquivo.nome)}
                            >
                              {copiedUrl === arquivo.nome ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              asChild
                            >
                              <a href={arquivo.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                
                {expandedBucket === bucket && info.arquivos.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground text-sm border-t">
                    Nenhum arquivo neste bucket
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Google Drive (Fase 2 - Placeholder) */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Google Drive
          </h4>
          
          <div className="bg-muted/30 border border-dashed rounded-lg p-4 text-center">
            <Cloud className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Sincronize seus arquivos automaticamente com o Google Drive
            </p>
            <Button variant="outline" disabled>
              Em breve
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
