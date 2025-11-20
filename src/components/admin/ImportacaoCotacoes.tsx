import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

interface CotacaoImportada {
  linha: number
  cliente_nome: string
  cliente_idade?: string
  cliente_telefone: string
  cliente_bairro?: string
  tipo_servico: string
  data_servico_desejada: string
  valor_estimado: string
  ocasiao?: string
  origem_lead?: string
  status: 'valido' | 'erro'
  erros?: string[]
}

export function ImportacaoCotacoes() {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [dadosParsed, setDadosParsed] = useState<CotacaoImportada[]>([])
  const [processando, setProcessando] = useState(false)
  const { toast } = useToast()

  const baixarTemplate = () => {
    const template = [
      {
        'Nome do Cliente': 'João Silva',
        'Idade': '25',
        'Telefone': '11999999999',
        'Origem Lead': 'Instagram',
        'Ocasião': 'Aniversário',
        'Bairro': 'Centro',
        'Tipo de Serviço': 'Balões, Flores',
        'Data do Serviço (DD/MM/AAAA)': '25/12/2025',
        'Valor Estimado': '500.00',
      }
    ]

    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'template-cotacoes.xlsx')
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setArquivo(file)
    
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      const cotacoesParsed: CotacaoImportada[] = jsonData.map((row: any, index) => {
        const erros: string[] = []
        
        if (!row['Nome do Cliente']) erros.push('Nome do cliente obrigatório')
        if (!row['Telefone']) erros.push('Telefone obrigatório')
        if (!row['Tipo de Serviço']) erros.push('Tipo de serviço obrigatório')
        if (!row['Data do Serviço (DD/MM/AAAA)']) erros.push('Data obrigatória')
        if (!row['Valor Estimado']) erros.push('Valor obrigatório')

        return {
          linha: index + 2,
          cliente_nome: row['Nome do Cliente'] || '',
          cliente_idade: row['Idade'] ? String(row['Idade']) : undefined,
          cliente_telefone: String(row['Telefone'] || ''),
          cliente_bairro: row['Bairro'] || undefined,
          tipo_servico: row['Tipo de Serviço'] || '',
          data_servico_desejada: row['Data do Serviço (DD/MM/AAAA)'] || '',
          valor_estimado: String(row['Valor Estimado'] || ''),
          ocasiao: row['Ocasião'] || '',
          origem_lead: row['Origem Lead'] || 'Importação em Massa',
          status: erros.length > 0 ? 'erro' : 'valido',
          erros: erros.length > 0 ? erros : undefined,
        }
      })

      setDadosParsed(cotacoesParsed)

      const validos = cotacoesParsed.filter(c => c.status === 'valido').length
      const erros = cotacoesParsed.filter(c => c.status === 'erro').length

      toast({
        title: 'Arquivo processado',
        description: `${validos} cotações válidas, ${erros} com erros`,
      })
    } catch (error) {
      console.error('Erro ao processar arquivo:', error)
      toast({
        title: 'Erro ao processar arquivo',
        description: 'Verifique se o formato está correto',
        variant: 'destructive',
      })
    }
  }

  const converterData = (dataStr: string): string => {
    const partes = dataStr.split('/')
    if (partes.length !== 3) return new Date().toISOString().split('T')[0]
    
    const [dia, mes, ano] = partes
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
  }

  const importarCotacoes = async () => {
    const cotacoesValidas = dadosParsed.filter(c => c.status === 'valido')
    
    if (cotacoesValidas.length === 0) {
      toast({
        title: 'Nenhuma cotação válida',
        description: 'Corrija os erros antes de importar',
        variant: 'destructive',
      })
      return
    }

    setProcessando(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: userData } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()

      if (!userData) throw new Error('Dados do usuário não encontrados')

      let sucessos = 0
      let falhas = 0

      for (const cotacao of cotacoesValidas) {
        try {
          // Buscar ou criar cliente
          let clienteId: string

          const { data: clienteExistente } = await supabase
            .from('clientes')
            .select('id')
            .eq('telefone', cotacao.cliente_telefone)
            .eq('empresa_id', userData.empresa_id)
            .single()

          if (clienteExistente) {
            clienteId = clienteExistente.id
          } else {
            const { data: novoCliente, error: clienteError } = await supabase
              .from('clientes')
              .insert({
                nome: cotacao.cliente_nome,
                telefone: cotacao.cliente_telefone,
                idade: cotacao.cliente_idade ? parseInt(cotacao.cliente_idade) : null,
                bairro: cotacao.cliente_bairro,
                empresa_id: userData.empresa_id,
                origem_lead: cotacao.origem_lead || 'Importação em Massa',
              })
              .select()
              .single()

            if (clienteError) throw clienteError
            clienteId = novoCliente.id
          }

          // Criar cotação
          const tiposServico = cotacao.tipo_servico
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0)

          const { error: cotacaoError } = await supabase
            .from('cotacoes')
            .insert({
              cliente_id: clienteId,
              empresa_id: userData.empresa_id,
              tipo_servico: tiposServico,
              data_servico_desejada: converterData(cotacao.data_servico_desejada),
              valor_estimado: parseFloat(cotacao.valor_estimado),
              ocasiao: cotacao.ocasiao,
              origem_lead: cotacao.origem_lead,
              status: 'enviada',
            })

          if (cotacaoError) throw cotacaoError
          
          sucessos++
        } catch (error) {
          console.error('Erro ao importar cotação linha', cotacao.linha, error)
          falhas++
        }
      }

      toast({
        title: 'Importação concluída',
        description: `${sucessos} cotações importadas com sucesso${falhas > 0 ? `, ${falhas} falharam` : ''}`,
      })

      setArquivo(null)
      setDadosParsed([])
      
      setTimeout(() => {
        window.location.reload()
      }, 1500)

    } catch (error) {
      console.error('Erro na importação:', error)
      toast({
        title: 'Erro na importação',
        description: 'Ocorreu um erro ao importar as cotações',
        variant: 'destructive',
      })
    } finally {
      setProcessando(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Importação em Massa</CardTitle>
          <CardDescription>
            Importe múltiplas cotações de uma vez através de arquivo Excel ou CSV
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={baixarTemplate}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Baixar Template
            </Button>

            <div className="flex-1">
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-8 hover:border-primary cursor-pointer transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {arquivo ? arquivo.name : 'Clique para selecionar arquivo'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Formatos: .xlsx, .xls, .csv
                  </p>
                </div>
              </label>
            </div>
          </div>

          {dadosParsed.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex gap-4">
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {dadosParsed.filter(c => c.status === 'valido').length} válidas
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    {dadosParsed.filter(c => c.status === 'erro').length} com erros
                  </Badge>
                </div>

                <Button
                  onClick={importarCotacoes}
                  disabled={processando || dadosParsed.filter(c => c.status === 'valido').length === 0}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {processando ? 'Importando...' : 'Importar Cotações'}
                </Button>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Linha</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Idade</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Bairro</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Erros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dadosParsed.map((cotacao) => (
                      <TableRow key={cotacao.linha}>
                        <TableCell className="font-mono text-xs">{cotacao.linha}</TableCell>
                        <TableCell>
                          {cotacao.status === 'valido' ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Válido
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Erro
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{cotacao.cliente_nome}</TableCell>
                        <TableCell>{cotacao.cliente_idade || '-'}</TableCell>
                        <TableCell>{cotacao.cliente_telefone}</TableCell>
                        <TableCell>{cotacao.cliente_bairro || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{cotacao.tipo_servico}</TableCell>
                        <TableCell>{cotacao.data_servico_desejada}</TableCell>
                        <TableCell>R$ {cotacao.valor_estimado}</TableCell>
                        <TableCell>
                          {cotacao.erros && cotacao.erros.length > 0 && (
                            <div className="text-xs text-red-600">
                              {cotacao.erros.map((erro, i) => (
                                <div key={i}>• {erro}</div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            Instruções
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-blue-900">
            <li>• Baixe o template para ver o formato correto do arquivo</li>
            <li>• Preencha todas as colunas obrigatórias: Nome, Telefone, Tipo de Serviço, Data e Valor</li>
            <li>• Colunas opcionais: Idade, Bairro, Ocasião e Origem Lead</li>
            <li>• Use o formato DD/MM/AAAA para datas (exemplo: 25/12/2025)</li>
            <li>• Para múltiplos tipos de serviço, separe por vírgula (exemplo: Balões, Flores)</li>
            <li>• O sistema criará automaticamente os clientes que não existirem</li>
            <li>• Revise os dados na tabela antes de confirmar a importação</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
