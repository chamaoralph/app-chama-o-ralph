import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tv } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TAMANHOS_TV,
  TIPOS_PAREDE,
  COBERTURAS,
  TIPOS_SUPORTE,
  type PrecoTV,
} from "@/lib/precosTV";

export function TabelaPrecosTVCard() {
  const { toast } = useToast();
  const [precos, setPrecos] = useState<PrecoTV[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  useEffect(() => {
    fetchPrecos();
  }, []);

  async function fetchPrecos() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("usuarios")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!userData) return;
      setEmpresaId(userData.empresa_id);

      const { data } = await supabase
        .from("precos_instalacao_tv" as any)
        .select("*")
        .eq("empresa_id", userData.empresa_id);

      setPrecos((data as any) ?? []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function getPreco(tamanho: string, parede: string, cobertura: string): PrecoTV | undefined {
    return precos.find(
      (p) => p.tamanho_tv === tamanho && p.tipo_parede === parede && p.cobertura === cobertura,
    );
  }

  async function salvarCelula(preco: PrecoTV, updates: Partial<PrecoTV>) {
    setSavingId(preco.id);
    try {
      const { error } = await supabase
        .from("precos_instalacao_tv" as any)
        .update(updates)
        .eq("id", preco.id);
      if (error) throw error;
      setPrecos((prev) => prev.map((p) => (p.id === preco.id ? { ...p, ...updates } : p)));
      toast({ title: "✅ Salvo" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Tv className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Tabela de Preços — Instalação de TV</CardTitle>
            <CardDescription>
              Defina o valor de mão de obra, parafusos e suporte por tamanho da TV, tipo de parede e
              cobertura. Esses valores preenchem automaticamente novas cotações.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : (
          <div className="space-y-8">
            {TAMANHOS_TV.map((tam) => (
              <div key={tam.value} className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">TV {tam.label}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Parede / Cobertura</th>
                        <th className="text-left p-2 font-medium w-24">Disponível</th>
                        <th className="text-left p-2 font-medium w-32">Mão de obra (R$)</th>
                        <th className="text-left p-2 font-medium w-28">Parafusos (R$)</th>
                        <th className="text-left p-2 font-medium w-40">Suporte</th>
                        <th className="text-left p-2 font-medium w-28">Valor Suporte (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TIPOS_PAREDE.flatMap((par) =>
                        COBERTURAS.map((cob) => {
                          const preco = getPreco(tam.value, par.value, cob.value);
                          if (!preco) return null;
                          const saving = savingId === preco.id;
                          return (
                            <tr key={preco.id} className="border-b hover:bg-muted/30">
                              <td className="p-2">
                                <span className="font-medium">{par.label}</span>
                                <span className="text-muted-foreground"> · {cob.label}</span>
                              </td>
                              <td className="p-2">
                                <Switch
                                  checked={preco.disponivel}
                                  disabled={saving}
                                  onCheckedChange={(v) =>
                                    salvarCelula(preco, { disponivel: v })
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  defaultValue={preco.valor_mao_obra ?? ""}
                                  disabled={!preco.disponivel || saving}
                                  onBlur={(e) => {
                                    const v = e.target.value === "" ? null : parseFloat(e.target.value);
                                    if (v !== preco.valor_mao_obra)
                                      salvarCelula(preco, { valor_mao_obra: v });
                                  }}
                                  className="h-9"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  defaultValue={preco.valor_parafusos ?? 0}
                                  disabled={saving}
                                  onBlur={(e) => {
                                    const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                    if (v !== preco.valor_parafusos)
                                      salvarCelula(preco, { valor_parafusos: v });
                                  }}
                                  className="h-9"
                                />
                              </td>
                              <td className="p-2">
                                <Select
                                  value={preco.tipo_suporte}
                                  disabled={saving}
                                  onValueChange={(v) => salvarCelula(preco, { tipo_suporte: v })}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIPOS_SUPORTE.map((t) => (
                                      <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  defaultValue={preco.valor_suporte ?? 0}
                                  disabled={saving || preco.tipo_suporte !== "valor"}
                                  onBlur={(e) => {
                                    const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                    if (v !== preco.valor_suporte)
                                      salvarCelula(preco, { valor_suporte: v });
                                  }}
                                  className="h-9"
                                />
                              </td>
                            </tr>
                          );
                        }),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              💡 Combinações marcadas como indisponíveis aparecem como "ND" no formulário de cotação e
              bloqueiam o salvamento.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
