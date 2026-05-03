import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  HardDrive, 
  FileImage, 
  FileText, 
  Receipt,
  Loader2,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Archive,
  ChevronDown,
  ChevronRight
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

interface BucketSummary {
  total_arquivos: number;
  tamanho_bytes: number;
}

interface SummaryData {
  buckets: Record<string, BucketSummary>;
  resumo: {
    total_arquivos: number;
    tamanho_total_mb: number;
  };
  gerado_em: string;
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

const comprimirImagem = async (blob: Blob, nomeArquivo: string, maxSizeBytes = 1024 * 1024): Promise<Blob> => {
  const extensao = nomeArquivo.toLowerCase().split('.').pop();
  const isImagem = ['jpg', 'jpeg', 'png', 'webp'].includes(extensao || '');
  
  if (!isImagem || blob.size <= maxSizeBytes) return blob;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const maxDimension = 1920;
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(blob); return; }
      ctx.drawImage(img, 0, 0, width, height);
      
      const tentarComprimir = (qualidade: number): void => {
        canvas.toBlob(
          (novoBlob) => {
            if (!novoBlob) { resolve(blob); return; }
            if (novoBlob.size > maxSizeBytes && qualidade > 0.3) {
              tentarComprimir(qualidade - 0.1);
            } else {
              resolve(novoBlob);
            }
          },
          'image/jpeg',
          qualidade
        );
      };
      tentarComprimir(0.7);
    };
    
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });
};

async function getAuthToken() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Você precisa estar logado');
  return session.session.access_token;
}

async function fetchBackupApi(params: Record<string, string>) {
  const token = await getAuthToken();
  const queryString = new URLSearchParams(params).toString();
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/backup-storage?${queryString}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Erro ${response.status}`);
  }
  return response.json();
}

export function BackupStorageCard() {
  const [loading, setLoading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0, bucket: '' });
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);
  const [bucketFiles, setBucketFiles] = useState<Record<string, ArquivoBucket[]>>({});
  const [loadingBucket, setLoadingBucket] = useState<string | null>(null);

  const gerarResumo = async () => {
    setLoading(true);
    try {
      const data = await fetchBackupApi({ mode: 'summary' });
      setSummaryData(data);
      toast.success('Resumo de backup gerado!');
    } catch (error: any) {
      console.error('Erro ao gerar resumo:', error);
      toast.error('Erro ao gerar resumo de backup');
    } finally {
      setLoading(false);
    }
  };

  const carregarArquivosBucket = async (bucket: string) => {
    if (expandedBucket === bucket) {
      setExpandedBucket(null);
      return;
    }
    
    setExpandedBucket(bucket);
    if (bucketFiles[bucket]) return; // already loaded
    
    setLoadingBucket(bucket);
    try {
      const allFiles: ArquivoBucket[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const data = await fetchBackupApi({ mode: 'files', bucket, page: String(page), per_page: '50' });
        allFiles.push(...(data.arquivos || []));
        hasMore = data.has_more;
        page++;
      }
      
      setBucketFiles(prev => ({ ...prev, [bucket]: allFiles }));
    } catch (error: any) {
      console.error('Erro ao carregar arquivos:', error);
      toast.error(`Erro ao carregar arquivos de ${getBucketLabel(bucket)}`);
    } finally {
      setLoadingBucket(null);
    }
  };

  const copiarUrl = async (url: string, nome: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(nome);
    toast.success('URL copiada!');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const exportarComoJson = () => {
    if (!summaryData) return;
    const dataStr = JSON.stringify({ ...summaryData, arquivos_por_bucket: bucketFiles }, null, 2);
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
    // Ensure we have summary first
    let dados = summaryData;
    if (!dados) {
      setLoading(true);
      try {
        dados = await fetchBackupApi({ mode: 'summary' });
        setSummaryData(dados);
      } catch (error) {
        toast.error('Erro ao obter lista de arquivos');
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    if (!dados) return;

    setDownloadingZip(true);
    const totalFiles = dados.resumo.total_arquivos;
    setZipProgress({ current: 0, total: totalFiles, bucket: '' });

    try {
      const zip = new JSZip();
      const dataAtual = new Date().toISOString().split('T')[0];
      let downloadedCount = 0;
      let mapaServicos: Record<string, string> = {};

      for (const [bucket, info] of Object.entries(dados.buckets)) {
        if (info.total_arquivos === 0) continue;
        
        setZipProgress({ current: downloadedCount, total: totalFiles, bucket: getBucketLabel(bucket) });

        // Fetch files page by page
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const pageData = await fetchBackupApi({ mode: 'files', bucket, page: String(page), per_page: '50' });
          
          if (page === 1 && pageData.mapa_servicos) {
            mapaServicos = { ...mapaServicos, ...pageData.mapa_servicos };
          }

          const arquivos: ArquivoBucket[] = pageData.arquivos || [];
          hasMore = pageData.has_more;

          // Download in batches of 5
          for (let i = 0; i < arquivos.length; i += 5) {
            const batch = arquivos.slice(i, i + 5);
            
            await Promise.all(
              batch.map(async (arquivo) => {
                try {
                  const response = await fetch(arquivo.url);
                  if (!response.ok) return;
                  
                  let blob = await response.blob();
                  
                  if (bucket === 'fotos-servicos') {
                    blob = await comprimirImagem(blob, arquivo.nome);
                  }
                  
                  let nomeArquivo = arquivo.nome;
                  const extensao = nomeArquivo.toLowerCase().split('.').pop();
                  if (['png', 'webp'].includes(extensao || '') && blob.type === 'image/jpeg') {
                    nomeArquivo = nomeArquivo.replace(/\.(png|webp)$/i, '.jpg');
                  }
                  
                  const partes = nomeArquivo.split('/');
                  if (partes.length > 1 && mapaServicos[partes[0]]) {
                    partes[0] = mapaServicos[partes[0]];
                    nomeArquivo = partes.join('/');
                  }
                  
                  zip.file(`backup-${dataAtual}/${bucket}/${nomeArquivo}`, blob);
                } catch (err) {
                  console.error(`Erro ao baixar ${arquivo.nome}:`, err);
                }
              })
            );
            
            downloadedCount += batch.length;
            setZipProgress({ current: downloadedCount, total: totalFiles, bucket: getBucketLabel(bucket) });
          }

          page++;
        }
      }

      toast.info('Gerando arquivo ZIP...');
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${dataAtual}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Backup ZIP baixado! (${totalFiles} arquivos)`);
    } catch (error) {
      console.error('Erro ao gerar ZIP:', error);
      toast.error('Erro ao gerar backup ZIP');
    } finally {
      setDownloadingZip(false);
      setZipProgress({ current: 0, total: 0, bucket: '' });
    }
  };

  const limiteStorageMb = 1024;
  const usadoMb = summaryData?.resumo.tamanho_total_mb || 0;
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
        {summaryData && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Espaço utilizado</span>
              <span className="font-medium">{usadoMb.toFixed(2)} MB / {limiteStorageMb} MB</span>
            </div>
            <Progress value={percentualUsado} className="h-2" />
            
            <div className="grid grid-cols-3 gap-3 pt-2">
              {Object.entries(summaryData.buckets).map(([bucket, info]) => (
                <div key={bucket} className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="flex justify-center mb-1">{getBucketIcon(bucket)}</div>
                  <p className="text-lg font-semibold">{info.total_arquivos}</p>
                  <p className="text-xs text-muted-foreground">{getBucketLabel(bucket)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download Manual
          </h4>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={gerarResumo} 
              disabled={loading || downloadingZip}
              variant="outline"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {summaryData ? 'Atualizar Lista' : 'Gerar Lista'}
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
                ? `${zipProgress.bucket || 'Preparando'}... ${zipProgress.current}/${zipProgress.total}` 
                : 'Baixar Tudo (ZIP)'}
            </Button>
            
            {summaryData && (
              <Button onClick={exportarComoJson} variant="secondary">
                <Download className="h-4 w-4 mr-2" />
                JSON
              </Button>
            )}
          </div>

          {summaryData && (
            <div className="text-xs text-muted-foreground">
              Gerado em: {new Date(summaryData.gerado_em).toLocaleString('pt-BR')}
            </div>
          )}
        </div>

        {/* Lista de Arquivos por Bucket */}
        {summaryData && (
          <div className="space-y-3">
            {Object.entries(summaryData.buckets).map(([bucket, info]) => (
              <div key={bucket} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => carregarArquivosBucket(bucket)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedBucket === bucket ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {getBucketIcon(bucket)}
                    <span className="font-medium">{getBucketLabel(bucket)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{info.total_arquivos} arquivos</Badge>
                    <Badge variant="outline">{formatarTamanho(info.tamanho_bytes)}</Badge>
                  </div>
                </button>
                
                {expandedBucket === bucket && (
                  <div className="border-t">
                    {loadingBucket === bucket ? (
                      <div className="p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando arquivos...
                      </div>
                    ) : bucketFiles[bucket]?.length > 0 ? (
                      <ScrollArea className="h-48">
                        <div className="p-2 space-y-1">
                          {bucketFiles[bucket].map((arquivo) => (
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
                    ) : (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        Nenhum arquivo neste bucket
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
