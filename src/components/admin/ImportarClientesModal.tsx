import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2, CheckCircle, AlertTriangle, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

interface ImportarClientesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  onSuccess?: () => void;
}

interface PreviewRow {
  [key: string]: string | number | undefined;
}

interface ColumnMapping {
  nome: string;
  telefone: string;
  bairro: string;
  endereco: string;
}

export function ImportarClientesModal({
  open,
  onOpenChange,
  empresaId,
  onSuccess,
}: ImportarClientesModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    nome: "",
    telefone: "",
    bairro: "",
    endereco: "",
  });
  const [step, setStep] = useState<"upload" | "mapping" | "result">("upload");
  const [result, setResult] = useState<{
    novos: number;
    atualizados: number;
    erros: { linha: number; erro: string }[];
  } | null>(null);

  const resetState = () => {
    setFile(null);
    setPreviewData([]);
    setColumns([]);
    setMapping({ nome: "", telefone: "", bairro: "", endereco: "" });
    setStep("upload");
    setResult(null);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (!selectedFile) return;

      setFile(selectedFile);

      try {
        const data = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

        if (rawData.length < 2) {
          toast({
            title: "Arquivo vazio",
            description: "O arquivo não contém dados suficientes.",
            variant: "destructive",
          });
          return;
        }

        // Primeira linha são os cabeçalhos
        const headerRow = rawData[0] as (string | number)[];
        const headers = headerRow.map(String);
        const rows = rawData.slice(1, 11).map((row) => {
          const rowArray = row as (string | number | undefined)[];
          const rowData: PreviewRow = {};
          headers.forEach((header, index) => {
            rowData[header] = rowArray[index];
          });
          return rowData;
        });

        setColumns(headers);
        setPreviewData(rows);

        // Tentar detectar colunas automaticamente
        const autoMapping: ColumnMapping = {
          nome: "",
          telefone: "",
          bairro: "",
          endereco: "",
        };

        headers.forEach((header) => {
          const lower = header.toLowerCase();
          if (lower.includes("nome") || lower.includes("name") || lower.includes("cliente")) {
            autoMapping.nome = header;
          }
          if (lower.includes("telefone") || lower.includes("phone") || lower.includes("celular") || lower.includes("whatsapp")) {
            autoMapping.telefone = header;
          }
          if (lower.includes("bairro") || lower.includes("neighborhood")) {
            autoMapping.bairro = header;
          }
          if (lower.includes("endereco") || lower.includes("endereço") || lower.includes("address")) {
            autoMapping.endereco = header;
          }
        });

        setMapping(autoMapping);
        setStep("mapping");
      } catch (error) {
        console.error("Erro ao ler arquivo:", error);
        toast({
          title: "Erro ao ler arquivo",
          description: "Não foi possível processar o arquivo. Verifique o formato.",
          variant: "destructive",
        });
      }
    },
    []
  );

  const importMutation = useMutation({
    mutationFn: async () => {
      const selectedFile = file;
      if (!selectedFile) throw new Error("Nenhum arquivo selecionado");

      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<PreviewRow>(sheet);

      // Mapear dados para o formato esperado
      const dadosMapeados = jsonData.map((row) => ({
        nome: String(row[mapping.nome] || "").trim(),
        telefone: String(row[mapping.telefone] || "").trim(),
        bairro: mapping.bairro ? String(row[mapping.bairro] || "").trim() : "",
        endereco: mapping.endereco ? String(row[mapping.endereco] || "").trim() : "",
      }));

      // Note: p_empresa_id is now determined server-side from auth.uid()
      const { data: result, error } = await supabase.rpc("import_clientes_csv" as any, {
        p_dados: dadosMapeados,
        p_arquivo_nome: selectedFile.name,
      });

      if (error) throw error;
      return result as {
        success: boolean;
        novos_clientes: number;
        clientes_atualizados: number;
        erros: { linha: number; erro: string }[];
      };
    },
    onSuccess: (data) => {
      setResult({
        novos: data.novos_clientes,
        atualizados: data.clientes_atualizados,
        erros: data.erros || [],
      });
      setStep("result");
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canImport = mapping.nome && mapping.telefone;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Clientes
          </DialogTitle>
          <DialogDescription>
            Importe clientes de uma planilha CSV ou Excel
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 font-medium">
                  Clique para selecionar um arquivo
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Formatos aceitos: CSV, XLSX, XLS
                </p>
              </label>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Formato esperado:</strong> O arquivo deve conter colunas para
                Nome e Telefone (obrigatórios). Colunas para Bairro e Endereço são
                opcionais.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Mapeamento de Colunas</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={mapping.nome}
                    onValueChange={(value) =>
                      setMapping({ ...mapping, nome: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={mapping.telefone}
                    onValueChange={(value) =>
                      setMapping({ ...mapping, telefone: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bairro (opcional)
                  </label>
                  <Select
                    value={mapping.bairro}
                    onValueChange={(value) =>
                      setMapping({ ...mapping, bairro: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endereço (opcional)
                  </label>
                  <Select
                    value={mapping.endereco}
                    onValueChange={(value) =>
                      setMapping({ ...mapping, endereco: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">
                Preview (primeiros 10 registros)
              </h4>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Bairro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{String(row[mapping.nome] || "-")}</TableCell>
                        <TableCell>{String(row[mapping.telefone] || "-")}</TableCell>
                        <TableCell>
                          {mapping.bairro ? String(row[mapping.bairro] || "-") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-6">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>

            <div className="text-center space-y-2">
              <h4 className="text-xl font-semibold text-gray-900">
                Importação Concluída!
              </h4>
              <div className="flex justify-center gap-6 text-lg">
                <div>
                  <span className="font-bold text-green-600">{result.novos}</span>
                  <span className="text-gray-600"> novos</span>
                </div>
                <div>
                  <span className="font-bold text-blue-600">{result.atualizados}</span>
                  <span className="text-gray-600"> atualizados</span>
                </div>
                {result.erros.length > 0 && (
                  <div>
                    <span className="font-bold text-red-600">{result.erros.length}</span>
                    <span className="text-gray-600"> erros</span>
                  </div>
                )}
              </div>
            </div>

            {result.erros.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Erros encontrados:</p>
                  <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                    {result.erros.slice(0, 10).map((erro, index) => (
                      <li key={index}>
                        Linha {erro.linha}: {erro.erro}
                      </li>
                    ))}
                    {result.erros.length > 10 && (
                      <li>... e mais {result.erros.length - 10} erros</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}

          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={!canImport || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  "Importar"
                )}
              </Button>
            </>
          )}

          {step === "result" && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
