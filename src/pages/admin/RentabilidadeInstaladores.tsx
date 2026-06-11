import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { DollarSign, TrendingUp, Users, Briefcase, Percent, AlertTriangle } from "lucide-react"

// ─── Timezone ─────────────────────────────────────────────────────────────────
const TZ = "America/Sao_Paulo"

function todayTZ(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ })
}

function mesAtualRange(): { start: string; end: string } {
  const now = new Date()
  const y = now.toLocaleDateString("en-CA", { timeZone: TZ }).slice(0, 4)
  const m = now.toLocaleDateString("en-CA", { timeZone: TZ }).slice(5, 7)
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate()
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${String(lastDay).padStart(2, "0")}` }
}

function subtractDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toLocaleDateString("en-CA", { timeZone: TZ })
}

// ─── Helpers de formatação ────────────────────────────────────────────────────
function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Periodo = "7d" | "30d" | "mes_atual" | "custom"

interface FiltroperiodState {
  tipo: Periodo
  inicio: string
  fim: string
}

interface LinhaInstalador {
  instaladorId: string
  nome: string
  nServicos: number
  receita: number
  repasse: number
  // Receita = repasse (valor_mao_obra_instalador) * 2, ou valor_total quando repasse = 0.
  // Lucro = Receita − Repasse.
  reembolso: number
  custoSuporte: number
  lucro: number
  margem: number         // %
  retrabalhosAbertos: number  // serviços atualmente em 'correcao_solicitada'
  capacidadeMes: number  // serviços / mês (extrapolado para o período)
}

// ─── Helper: período em meses (mínimo 1) ─────────────────────────────────────
function periodoEmMeses(inicio: string, fim: string): number {
  const a = new Date(inicio)
  const b = new Date(fim)
  const diffMs = b.getTime() - a.getTime()
  const diffMeses = diffMs / (1000 * 60 * 60 * 24 * 30.44)
  return Math.max(diffMeses, 1 / 30.44) // nunca dividir por zero
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function RentabilidadeInstaladores() {
  const { toast } = useToast()
  const today = todayTZ()

  const [periodo, setPeriodo] = useState<FiltroperiodState>(() => {
    const { start, end } = mesAtualRange()
    return { tipo: "mes_atual", inicio: start, fim: end }
  })

  function aplicarPeriodo(tipo: Periodo) {
    if (tipo === "7d")
      return setPeriodo({ tipo, inicio: subtractDays(7), fim: today })
    if (tipo === "30d")
      return setPeriodo({ tipo, inicio: subtractDays(30), fim: today })
    if (tipo === "mes_atual") {
      const { start, end } = mesAtualRange()
      return setPeriodo({ tipo, inicio: start, fim: end })
    }
  }

  // ─── empresa_id ──────────────────────────────────────────────────────────────
  const { data: empresaId } = useQuery({
    queryKey: ["empresa-id-rentab"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Não autenticado")
      const { data, error } = await supabase
        .from("usuarios")
        .select("empresa_id")
        .eq("id", user.id)
        .single()
      if (error) throw error
      return data.empresa_id as string
    },
  })

  // ─── Serviços concluídos no período ─────────────────────────────────────────
  // Filtra por data_conclusao (data real de conclusão do serviço).
  // data_conclusao pode ser null em registros antigos — esses não entram no período.
  const { data: servicos, isLoading: loadingServicos } = useQuery({
    queryKey: ["rentab-servicos", empresaId, periodo.inicio, periodo.fim],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos")
        .select(
          "id, instalador_id, valor_total, valor_mao_obra_instalador, valor_reembolso_despesas, custo_suporte, data_conclusao"
        )
        .eq("empresa_id", empresaId!)
        .eq("status", "concluido")
        .gte("data_conclusao", periodo.inicio)
        .lte("data_conclusao", periodo.fim + "T23:59:59")
      if (error) {
        toast({ title: "Erro ao buscar serviços", description: error.message, variant: "destructive" })
        throw error
      }
      return data ?? []
    },
  })

  // ─── Serviços em correção aberta (retrabalho proxy) ──────────────────────────
  // NOTA: o schema não possui tabela de histórico de status. Por isso,
  // "retrabalho" aqui representa apenas serviços ATUALMENTE em 'correcao_solicitada'
  // agendados no período — não conta serviços já concluídos que passaram por correção.
  // Para rastrear retrabalho histórico seria necessário uma tabela de auditoria de status.
  const { data: correcoes } = useQuery({
    queryKey: ["rentab-correcoes", empresaId, periodo.inicio, periodo.fim],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos")
        .select("id, instalador_id")
        .eq("empresa_id", empresaId!)
        .eq("status", "correcao_solicitada")
        .gte("data_servico_agendada", periodo.inicio)
        .lte("data_servico_agendada", periodo.fim)
      if (error) throw error
      return data ?? []
    },
  })

  // ─── Nomes dos instaladores ───────────────────────────────────────────────────
  // Busca diretamente em usuarios (não via tabela instaladores, que pode não ter
  // registros para todos — ver investigação de FK em Aprovacoes.tsx).
  const instaladorIds = useMemo(
    () => Array.from(new Set([
      ...(servicos ?? []).map((s) => s.instalador_id),
      ...(correcoes ?? []).map((c) => c.instalador_id),
    ].filter(Boolean))),
    [servicos, correcoes]
  )

  const { data: usuarios } = useQuery({
    queryKey: ["rentab-usuarios", instaladorIds.join(",")],
    enabled: instaladorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome, tipo")
        .in("id", instaladorIds)
      if (error) throw error
      return data ?? []
    },
  })

  // ─── Agregação por instalador ─────────────────────────────────────────────────
  const { linhas, totais } = useMemo(() => {
    if (!servicos || !usuarios) return { linhas: [], totais: null }

    const nomeMap: Record<string, string> = {}
    for (const u of usuarios) nomeMap[u.id] = u.nome

    const correcoesPorInstalador: Record<string, number> = {}
    for (const c of correcoes ?? []) {
      if (c.instalador_id)
        correcoesPorInstalador[c.instalador_id] = (correcoesPorInstalador[c.instalador_id] ?? 0) + 1
    }

    const meses = periodoEmMeses(periodo.inicio, periodo.fim)

    const mapa: Record<string, LinhaInstalador> = {}
    for (const s of servicos) {
      const id = s.instalador_id ?? "__sem_instalador__"
      if (!mapa[id]) {
        mapa[id] = {
          instaladorId: id,
          nome: nomeMap[id] ?? (id === "__sem_instalador__" ? "Sem instalador" : id.slice(0, 8)),
          nServicos: 0,
          receita: 0,
          repasse: 0,
          reembolso: 0,
          custoSuporte: 0,
          lucro: 0,
          margem: 0,
          retrabalhosAbertos: correcoesPorInstalador[id] ?? 0,
          capacidadeMes: 0,
        }
      }
      const linha = mapa[id]
      linha.nServicos += 1
      const repasseServico = Number(s.valor_mao_obra_instalador ?? 0)
      const receitaServico = repasseServico === 0 ? Number(s.valor_total ?? 0) : repasseServico * 2
      linha.receita += receitaServico
      linha.repasse += repasseServico
      linha.reembolso += Number(s.valor_reembolso_despesas ?? 0)
      linha.custoSuporte += Number(s.custo_suporte ?? 0)
    }

    const linhas: LinhaInstalador[] = Object.values(mapa).map((l) => {
      l.lucro = l.receita - l.repasse
      l.margem = l.receita > 0 ? (l.lucro / l.receita) * 100 : 0
      l.capacidadeMes = l.nServicos / meses
      return l
    })

    linhas.sort((a, b) => b.lucro - a.lucro)

    const totReceita = linhas.reduce((s, l) => s + l.receita, 0)
    const totRepasse = linhas.reduce((s, l) => s + l.repasse, 0)
    const totLucro = linhas.reduce((s, l) => s + l.lucro, 0)
    const totServicos = linhas.reduce((s, l) => s + l.nServicos, 0)
    const totMargem = totReceita > 0 ? (totLucro / totReceita) * 100 : 0

    return {
      linhas,
      totais: { totReceita, totRepasse, totLucro, totServicos, totMargem },
    }
  }, [servicos, correcoes, usuarios, periodo])

  const loading = loadingServicos || !empresaId

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rentabilidade por Instalador</h1>
          <p className="text-muted-foreground mt-1">
            Receita, repasse e lucro gerado por cada instalador no período.
          </p>
        </div>

        {/* Filtro de período */}
        <div className="flex flex-wrap items-end gap-3 bg-card border rounded-lg p-4">
          <div className="flex gap-2">
            {([
              { key: "7d", label: "7 dias" },
              { key: "30d", label: "30 dias" },
              { key: "mes_atual", label: "Mês atual" },
            ] as const).map(({ key, label }) => (
              <Button
                key={key}
                variant={periodo.tipo === key ? "default" : "outline"}
                size="sm"
                onClick={() => aplicarPeriodo(key)}
              >
                {label}
              </Button>
            ))}
            <Button
              variant={periodo.tipo === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodo((p) => ({ ...p, tipo: "custom" }))}
            >
              Personalizado
            </Button>
          </div>

          {periodo.tipo === "custom" && (
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <Input
                  type="date"
                  className="w-36 h-8 text-sm"
                  value={periodo.inicio}
                  onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <Input
                  type="date"
                  className="w-36 h-8 text-sm"
                  value={periodo.fim}
                  onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))}
                />
              </div>
            </div>
          )}

          <span className="text-xs text-muted-foreground">
            {periodo.inicio} → {periodo.fim}
          </span>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              icon: Briefcase,
              title: "Serviços",
              value: loading ? null : String(totais?.totServicos ?? 0),
              sub: "concluídos no período",
            },
            {
              icon: DollarSign,
              title: "Receita Total",
              value: loading ? null : fmtBRL(totais?.totReceita ?? 0),
              sub: "soma valor_total",
            },
            {
              icon: Users,
              title: "Repasse Total",
              value: loading ? null : fmtBRL(totais?.totRepasse ?? 0),
              sub: "mão de obra instaladores",
            },
            {
              icon: TrendingUp,
              title: "Lucro Empresa",
              value: loading ? null : fmtBRL(totais?.totLucro ?? 0),
              sub: "receita − repasse − custos",
            },
            {
              icon: Percent,
              title: "Margem Geral",
              value: loading ? null : fmtPct(totais?.totMargem ?? 0),
              sub: "lucro / receita",
            },
          ].map((card) => (
            <Card key={card.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <card.icon className="w-4 h-4" />
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {card.value === null ? (
                  <Skeleton className="h-8 w-28" />
                ) : (
                  <>
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Aviso sobre retrabalho */}
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Retrabalho (coluna):</strong> mostra serviços <em>atualmente</em> em
            "correção solicitada" no período — o schema não possui histórico de transições
            de status, portanto serviços concluídos que passaram por correção não são
            contabilizados aqui.
          </span>
        </div>

        {/* Tabela */}
        <div className="bg-card rounded-lg border shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Instalador</TableHead>
                <TableHead className="text-right font-semibold">Serviços</TableHead>
                <TableHead className="text-right font-semibold">Receita</TableHead>
                <TableHead className="text-right font-semibold">Repasse</TableHead>
                <TableHead className="text-right font-semibold">Lucro Empresa</TableHead>
                <TableHead className="text-right font-semibold">Margem %</TableHead>
                <TableHead className="text-right font-semibold" title="Serviços atualmente em 'correcao_solicitada'">Retrabalho ⚠</TableHead>
                <TableHead className="text-right font-semibold" title="Serviços por mês extrapolado do período">Svç/mês</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : linhas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    Nenhum serviço concluído no período selecionado.
                  </TableCell>
                </TableRow>
              ) : (
                linhas.map((l) => (
                  <TableRow key={l.instaladorId} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{l.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.nServicos}</TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {fmtBRL(l.receita)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-amber-700">
                      {fmtBRL(l.repasse)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      <span className={l.lucro >= 0 ? "text-green-700" : "text-red-600"}>
                        {fmtBRL(l.lucro)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MargemBadge pct={l.margem} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.retrabalhosAbertos > 0 ? (
                        <Badge variant="destructive" className="text-xs">
                          {l.retrabalhosAbertos}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {l.capacidadeMes.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))
              )}

              {/* Linha de totais */}
              {!loading && linhas.length > 0 && totais && (
                <TableRow className="border-t-2 bg-muted/20 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{totais.totServicos}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtBRL(totais.totReceita)}</TableCell>
                  <TableCell className="text-right tabular-nums text-amber-700">
                    {fmtBRL(totais.totRepasse)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={totais.totLucro >= 0 ? "text-green-700" : "text-red-600"}>
                      {fmtBRL(totais.totLucro)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <MargemBadge pct={totais.totMargem} />
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Notas técnicas */}
        <p className="text-xs text-muted-foreground">
          Receita = <code>valor_mao_obra_instalador</code> × 2, ou <code>valor_total</code> quando o repasse é 0.
          Lucro empresa = Receita − Repasse. Período filtrado por{" "}
          <code>data_conclusao</code>. Donos aparecem com repasse = R$ 0,00 (
          <code>valor_mao_obra_instalador</code> salvo como 0 nos seus serviços).
        </p>
      </div>
    </AdminLayout>
  )
}

// ─── Sub-componente: badge colorido de margem ─────────────────────────────────
function MargemBadge({ pct }: { pct: number }) {
  const cls =
    pct >= 50
      ? "bg-green-100 text-green-800"
      : pct >= 30
      ? "bg-yellow-100 text-yellow-800"
      : pct >= 0
      ? "bg-orange-100 text-orange-800"
      : "bg-red-100 text-red-800"
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {fmtPct(pct)}
    </span>
  )
}
