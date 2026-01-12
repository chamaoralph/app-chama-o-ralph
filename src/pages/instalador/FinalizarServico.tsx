import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { InstaladorLayout } from "@/components/layout/InstaladorLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Função para comprimir imagens antes do upload
async function comprimirImagem(file: File, qualidade = 0.7): Promise<File> {
  return new Promise((resolve, reject) => {
    // Se não for imagem, retorna o arquivo original
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Redimensionar se muito grande (máx 1920px)
      const maxSize = 1920;
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const nomeArquivo = file.name.replace(/\.[^/.]+$/, '.jpg');
            resolve(new File([blob], nomeArquivo, { type: 'image/jpeg' }));
          } else {
            reject(new Error('Falha ao comprimir imagem'));
          }
        },
        'image/jpeg',
        qualidade
      );
    };

    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = URL.createObjectURL(file);
  });
}

// Formata tamanho em bytes para exibição legível
function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

export default function FinalizarServico() {
  const { id: servicoId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [servico, setServico] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [fotos, setFotos] = useState<File[]>([]);
  const [temReembolso, setTemReembolso] = useState(false);
  const [notaFiscal, setNotaFiscal] = useState<File | null>(null);
  const [valorReembolso, setValorReembolso] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [comprimindo, setComprimindo] = useState(false);

  useEffect(() => {
    console.log("servicoId da URL:", servicoId);
    if (servicoId) {
      carregarServico();
    }
  }, [servicoId]);

  async function carregarServico() {
    try {
      console.log("Buscando serviço com ID:", servicoId);
      
      const { data, error } = await supabase
        .from("servicos")
        .select("*, clientes(*)")
        .eq("id", servicoId)
        .maybeSingle();

      console.log("Resposta da query:", { data, error });

      if (error) {
        console.error("Erro na query:", error);
        throw error;
      }
      
      if (!data) {
        console.error("Nenhum serviço encontrado com ID:", servicoId);
        throw new Error("Serviço não encontrado");
      }
      
      setServico(data);
    } catch (error: any) {
      console.error("Erro ao carregar serviço:", error);
      toast({
        title: "❌ Erro ao carregar serviço",
        description: error.message || 'Desconhecido',
        variant: "destructive",
      });
      navigate("/instalador/minha-agenda");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (fotos.length < 3) {
      toast({
        title: "❌ Fotos insuficientes",
        description: "Envie pelo menos 3 fotos!",
        variant: "destructive",
      });
      return;
    }

    if (fotos.length > 10) {
      toast({
        title: "❌ Limite excedido",
        description: "Máximo de 10 fotos!",
        variant: "destructive",
      });
      return;
    }

    if (temReembolso && !notaFiscal) {
      toast({
        title: "❌ Nota fiscal obrigatória",
        description: "Anexe a nota fiscal para reembolso!",
        variant: "destructive",
      });
      return;
    }

    setEnviando(true);

    try {
      // Comprimir e fazer upload das fotos
      const fotosPaths: string[] = [];
      for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i];
        
        // Comprimir imagem antes do upload
        const fotoComprimida = await comprimirImagem(foto, 0.7);
        const fileName = `${servicoId}/${Date.now()}_${i}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("fotos-servicos")
          .upload(fileName, fotoComprimida);

        if (uploadError) {
          if (uploadError.message?.includes('payload too large') || uploadError.message?.includes('file size')) {
            throw new Error(`Foto ${i + 1} muito grande. Máximo: 5MB`);
          }
          throw uploadError;
        }

        fotosPaths.push(fileName);
      }

      let notaFiscalPath = null;
      if (notaFiscal && temReembolso) {
        const nfFileName = `${servicoId}/nota_fiscal_${Date.now()}.pdf`;

        const { error: uploadError } = await supabase.storage.from("notas-fiscais").upload(nfFileName, notaFiscal);

        if (uploadError) throw uploadError;

        // Salva apenas o path, não a URL pública
        notaFiscalPath = nfFileName;
      }

      // Buscar o usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error: updateError } = await supabase
        .from("servicos")
        .update({
          status: "aguardando_aprovacao",
          fotos_conclusao: fotosPaths,
          nota_fiscal_url: notaFiscalPath,
          valor_reembolso_despesas: temReembolso ? parseFloat(valorReembolso) : servico.valor_reembolso_despesas,
          observacoes_instalador: observacoes,
        })
        .eq("id", servicoId)
        .eq("instalador_id", user.id)
        .in("status", ["atribuido", "em_andamento"]);

      if (updateError) throw updateError;

      toast({
        title: "✅ Serviço finalizado!",
        description: "Aguardando aprovação do gestor.",
      });
      navigate("/instalador/minha-agenda");
    } catch (error: any) {
      console.error("Erro:", error);
      toast({
        title: "❌ Erro ao finalizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setEnviando(false);
    }
  }

  if (loading) {
    return (
      <InstaladorLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Carregando...</div>
        </div>
      </InstaladorLayout>
    );
  }

  if (!servico) {
    return (
      <InstaladorLayout>
        <div className="text-center">
          <p className="text-red-600">Serviço não encontrado</p>
        </div>
      </InstaladorLayout>
    );
  }

  return (
    <InstaladorLayout>
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold mb-6">Finalizar Serviço</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">{servico.codigo}</h2>
          <p className="text-gray-600">Cliente: {servico.clientes.nome}</p>
          <p className="text-gray-600">Serviço: {servico.tipo_servico?.join(", ")}</p>
          <p className="text-green-600 font-bold">Valor: R$ {servico.valor_mao_obra_instalador?.toFixed(2)}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">📸 Fotos do Serviço Concluído (3-10 fotos) *</label>
            <input
              type="file"
              multiple
              accept="image/*"
              required
              onChange={async (e) => {
                const arquivos = Array.from(e.target.files || []);
                setFotos(arquivos);
              }}
              className="w-full px-3 py-2 border rounded-md"
            />
            <div className="flex flex-wrap gap-2 mt-1">
              <p className="text-sm text-muted-foreground">
                {fotos.length} foto(s) selecionada(s)
              </p>
              {fotos.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  • Total: {formatarTamanho(fotos.reduce((acc, f) => acc + f.size, 0))}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              💡 As fotos serão comprimidas automaticamente antes do envio (máx 5MB cada)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Houve despesas a reembolsar?</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="reembolso"
                  checked={!temReembolso}
                  onChange={() => setTemReembolso(false)}
                  className="mr-2"
                />
                Não
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="reembolso"
                  checked={temReembolso}
                  onChange={() => setTemReembolso(true)}
                  className="mr-2"
                />
                Sim
              </label>
            </div>
          </div>

          {temReembolso && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">📄 Nota Fiscal (PDF ou Foto) *</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  required={temReembolso}
                  onChange={(e) => setNotaFiscal(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">💰 Valor do Reembolso (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required={temReembolso}
                  value={valorReembolso}
                  onChange={(e) => setValorReembolso(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="45.00"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">📝 Observações (opcional)</label>
            <textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Ex: Cliente pediu ajuste adicional..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate("/instalador/minha-agenda")}
              className="px-6 py-2 border rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {enviando ? "📤 Enviando..." : "✅ Finalizar Serviço"}
            </button>
          </div>
        </form>
      </div>
    </InstaladorLayout>
  );
}
