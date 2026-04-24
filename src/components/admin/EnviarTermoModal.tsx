import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { TIPOS_TV, gerarToken, colaborativaIndisponivelLista } from "@/lib/termoTexto";
import { buscarPrecoTV } from "@/lib/precosTV";
import { Send, AlertTriangle } from "lucide-react";
import type { TVItem } from "@/components/admin/SelectorPrecoTV";

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
  tvsItens?: TVItem[];
  onEnviado?: () => void;
}

const TAMANHO_PARA_POLEGADAS: Record<string, string> = {
  ate_39: "39",
  "40_55": "55",
  "58_65": "65",
  "70_75": "75",
  "85": "85",
};

interface TVFormItem {
  // vem do item original
  tamanho: string;
  parede: string;
  // preenchido pelo admin
  polegadas: string;
  tipo: string;
  marca_modelo: string;
}

export function EnviarTermoModal({ open, onClose, cotacao, tvsItens, onEnviado }: Props) {
  const [itens, setItens] = useState<TVFormItem[]>([]);
  const [modalidadesEnvio, setModalidadesEnvio] = useState<"ambas" | "completa" | "colaborativa">("ambas");
  const [valorCompleta, setValorCompleta] = useState("");
  const [valorColaborativa, setValorColaborativa] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Montar 1 item por TV da cotação (ou 1 único se não houver tvsItens)
    const base = tvsItens && tvsItens.length > 0 ? tvsItens : [{ tamanho: "", parede: "" } as TVItem];
    setItens(
      base.map((t) => ({
        tamanho: t.tamanho || "",
        parede: t.parede || "",
        polegadas: t.tamanho ? TAMANHO_PARA_POLEGADAS[t.tamanho] || "" : "",
        tipo: "LED",
        marca_modelo: "",
      })),
    );
    setValorCompleta("");
    setValorColaborativa("");
    setModalidadesEnvio("ambas");

    // Pré-preenche valores somando Completa e Colaborativa por item
    (async () => {
      let totalCompleta = 0;
      let totalColab = 0;
      let temColab = true;
      for (const t of base) {
        if (!t.tamanho || !t.parede) {
          temColab = false;
          continue;
        }
        const [total, parcial] = await Promise.all([
          buscarPrecoTV(cotacao.empresa_id, t.tamanho, t.parede, "total"),
          buscarPrecoTV(cotacao.empresa_id, t.tamanho, t.parede, "parcial"),
        ]);
        if (total?.disponivel && total.valor_mao_obra) totalCompleta += Number(total.valor_mao_obra);
        if (parcial?.disponivel && parcial.valor_mao_obra) {
          totalColab += Number(parcial.valor_mao_obra);
        } else {
          temColab = false;
        }
      }
      if (totalCompleta > 0) setValorCompleta(String(totalCompleta));
      if (temColab && totalColab > 0) setValorColaborativa(String(totalColab));
    })();
  }, [open, tvsItens, cotacao.empresa_id]);

  function updateItem(idx: number, patch: Partial<TVFormItem>) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  const colabInfo = colaborativaIndisponivelLista(
    itens.map((i) => ({ tipo: i.tipo, polegadas: i.polegadas })),
  );

  async function enviarTermo() {
    if (!valorCompleta || parseFloat(valorCompleta) <= 0) {
      toast.error("Informe o valor da Modalidade Completa");
      return;
    }
    setEnviando(true);
    try {
      const token = gerarToken();

      // Montar array tvs_itens para persistir (combina dados da cotação + dados preenchidos aqui)
      const tvsParaSalvar = itens.map((it, idx) => {
        const original = tvsItens?.[idx];
        return {
          ...(original || {}),
          tamanho: it.tamanho,
          parede: it.parede,
          polegadas: it.polegadas,
          tipo: it.tipo,
          marca_modelo: it.marca_modelo,
        };
      });

      const primeiro = itens[0];
      const { error } = await supabase.from("termos_aceite" as any).insert({
        empresa_id: cotacao.empresa_id,
        cotacao_id: cotacao.id,
        cliente_nome: cotacao.cliente_nome,
        cliente_telefone: cotacao.cliente_telefone,
        cliente_endereco: cotacao.cliente_endereco,
        tv_marca_modelo: primeiro?.marca_modelo || null,
        tv_polegadas: primeiro?.polegadas || null,
        tv_tipo: primeiro?.tipo || null,
        tvs_itens: tvsParaSalvar,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" /> Enviar Termo de Aceite
          </DialogTitle>
          <DialogDescription>
            Confirme os dados dos equipamentos e os valores das modalidades. Será gerado um link para o cliente assinar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {itens.map((it, idx) => (
            <div key={idx} className="rounded-md border p-3 space-y-3">
              <div className="text-sm font-semibold">TV {idx + 1}</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Polegadas</Label>
                  <Input
                    value={it.polegadas}
                    onChange={(e) => updateItem(idx, { polegadas: e.target.value })}
                    placeholder="55"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de TV</Label>
                  <Select value={it.tipo} onValueChange={(v) => updateItem(idx, { tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_TV.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Marca / Modelo (opcional)</Label>
                <Input
                  value={it.marca_modelo}
                  onChange={(e) => updateItem(idx, { marca_modelo: e.target.value })}
                  placeholder="Ex: Samsung 55 QLED Q60"
                />
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor Completa (R$) — total</Label>
              <Input type="number" step="0.01" value={valorCompleta} onChange={(e) => setValorCompleta(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Valor Colaborativa (R$) — total</Label>
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
          <Button onClick={enviarTermo} disabled={enviando} className="bg-emerald-600 hover:bg-emerald-700">
            {enviando ? "Enviando..." : "Gerar Link e Abrir WhatsApp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
