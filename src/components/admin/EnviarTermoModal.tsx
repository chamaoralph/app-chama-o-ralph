import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { TIPOS_TV, gerarToken, colaborativaIndisponivel } from "@/lib/termoTexto";
import { buscarPrecoTV } from "@/lib/precosTV";
import { Send, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  cotacao: {
    id: string;
    empresa_id: string;
    cliente_nome: string;
    cliente_telefone: string;
    cliente_endereco: string | null;
  };
  // Sugestões pré-preenchidas (vindas dos selects de TV se já configurados)
  sugestaoTamanho?: string; // ex: "55"
  sugestaoTipoParede?: string;
  onEnviado?: () => void;
}

const TAMANHO_PARA_POLEGADAS: Record<string, string> = {
  ate_39: "39",
  "40_55": "55",
  "58_65": "65",
  "70_75": "75",
  "85": "85",
};

export function EnviarTermoModal({ open, onClose, cotacao, sugestaoTamanho, sugestaoTipoParede, onEnviado }: Props) {
  const [marcaModelo, setMarcaModelo] = useState("");
  const [polegadas, setPolegadas] = useState("");
  const [tipoTV, setTipoTV] = useState<string>("LED");
  const [valorCompleta, setValorCompleta] = useState("");
  const [valorColaborativa, setValorColaborativa] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    const polSugerido = sugestaoTamanho ? TAMANHO_PARA_POLEGADAS[sugestaoTamanho] || "" : "";
    setPolegadas(polSugerido);
    setMarcaModelo("");
    setTipoTV("LED");
    setValorCompleta("");
    setValorColaborativa("");

    // Tenta pré-preencher valores via tabela de preços
    if (sugestaoTamanho && sugestaoTipoParede) {
      (async () => {
        const [total, parcial] = await Promise.all([
          buscarPrecoTV(cotacao.empresa_id, sugestaoTamanho, sugestaoTipoParede, "total"),
          buscarPrecoTV(cotacao.empresa_id, sugestaoTamanho, sugestaoTipoParede, "parcial"),
        ]);
        if (total?.disponivel && total.valor_mao_obra) setValorCompleta(String(total.valor_mao_obra));
        if (parcial?.disponivel && parcial.valor_mao_obra) setValorColaborativa(String(parcial.valor_mao_obra));
      })();
    }
  }, [open, sugestaoTamanho, sugestaoTipoParede, cotacao.empresa_id]);

  const colabInfo = colaborativaIndisponivel(tipoTV, polegadas);

  async function enviarTermo(reaproveitar = false) {
    if (!valorCompleta || parseFloat(valorCompleta) <= 0) {
      toast.error("Informe o valor da Modalidade Completa");
      return;
    }
    setEnviando(true);
    try {
      const token = gerarToken();
      const { error } = await supabase.from("termos_aceite" as any).insert({
        empresa_id: cotacao.empresa_id,
        cotacao_id: cotacao.id,
        cliente_nome: cotacao.cliente_nome,
        cliente_telefone: cotacao.cliente_telefone,
        cliente_endereco: cotacao.cliente_endereco,
        tv_marca_modelo: marcaModelo || null,
        tv_polegadas: polegadas || null,
        tv_tipo: tipoTV,
        valor_completa: parseFloat(valorCompleta),
        valor_colaborativa: valorColaborativa ? parseFloat(valorColaborativa) : null,
        token,
        status: "pendente",
      });
      if (error) throw error;

      const baseUrl = window.location.origin;
      const linkTermo = `${baseUrl}/aceite/${token}`;
      const tel = String(cotacao.cliente_telefone || "").replace(/\D/g, "");
      const telFormatado = tel.startsWith("55") ? tel : "55" + tel;
      const primeiroNome = cotacao.cliente_nome.split(" ")[0];
      const mensagem = encodeURIComponent(
        `Olá ${primeiroNome}! 😊\n\n` +
          `Segue o termo da sua instalação de TV. Por favor, leia e assine pelo link abaixo:\n\n` +
          `👉 ${linkTermo}\n\n` +
          `Após a assinatura, você receberá uma cópia de confirmação.\n\n` +
          `Qualquer dúvida, é só chamar por aqui!`,
      );

      try {
        await navigator.clipboard.writeText(linkTermo);
      } catch {}

      window.open(`https://wa.me/${telFormatado}?text=${mensagem}`, "_blank");
      toast.success("Link gerado! WhatsApp aberto e link copiado.");
      onEnviado?.();
      onClose();
    } catch (e: any) {
      toast.error("Erro ao enviar termo: " + (e.message || "desconhecido"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" /> Enviar Termo de Aceite
          </DialogTitle>
          <DialogDescription>
            Confirme os dados do equipamento e os valores das modalidades. Será gerado um link para o cliente assinar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Polegadas</Label>
              <Input value={polegadas} onChange={(e) => setPolegadas(e.target.value)} placeholder="55" inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de TV</Label>
              <Select value={tipoTV} onValueChange={setTipoTV}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_TV.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Marca / Modelo (opcional)</Label>
            <Input value={marcaModelo} onChange={(e) => setMarcaModelo(e.target.value)} placeholder="Ex: Samsung 55 QLED Q60" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor Completa (R$)</Label>
              <Input type="number" step="0.01" value={valorCompleta} onChange={(e) => setValorCompleta(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Valor Colaborativa (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={valorColaborativa}
                onChange={(e) => setValorColaborativa(e.target.value)}
                placeholder="0,00"
                disabled={colabInfo.indisponivel}
              />
            </div>
          </div>
          {colabInfo.indisponivel && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{colabInfo.motivo} A modalidade Colaborativa ficará oculta para o cliente.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button onClick={() => enviarTermo()} disabled={enviando} className="bg-emerald-600 hover:bg-emerald-700">
            {enviando ? "Enviando..." : "Gerar Link e Abrir WhatsApp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
