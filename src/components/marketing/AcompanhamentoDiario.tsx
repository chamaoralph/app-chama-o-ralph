import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { formatarBRL } from "@/lib/orcamento"
import { DollarSign, TrendingUp, Briefcase, Percent, Settings, AlertTriangle, CheckCircle, Package } from "lucide-react"

// ─── Constants ───────────────────────────────────────────────────────────────
const TZ = "America/Sao_Paulo"
const STORAGE_KEY = "chama-ralph-metas-tracking"
// Mesmo set do Caixa.tsx — categorias que são acerto de caixa com o
// instalador, não receita/despesa nova. "Recebimento Instalador" precisa
// ficar de fora de Receitas senão dobra a contagem (ver fix 2026-08-18 no
// Caixa — este componente tinha ficado pra trás, causando Lucro Líquido
// diferente entre Acompanhamento e Caixa).
const CATEGORIAS_INSTALADORES = new Set(["Pagamento Instalador", "Reembolso Materiais", "Recebimento Instalador"])
const DIAS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

interface Metas {
  lucroLiquidoMes: number
  investimentoAdsMes: number
}

interface DiaTabela {
  dia: number
  diaSemana: string
  isDomingo: boolean
  google: number
  organico: number
  total: number
  jobsRayana: number
  receita: number
  despesa: number
  despesaInstalador: number
  lucroDia: number
  lucroAcumulado: number
  percentMeta: number
}

// ─── Helpers de timezone ──────────────────────────────────────────────────────
function toTZDateStr(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput
  return d.toLocaleDateString("en-CA", { timeZone: TZ })
}

function todayTZ(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ })
}

function isSunday(year: number, month: number, day: number): boolean {
  return new Date(year, month - 1, day).getDay() === 0
}

function diasUteisMes(year: number, month: number): number {
  const days = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= days; d++) if (!isSunday(year, month, d)) count++
  return count
}

function diasDecoridosUteis(year: number, month: number, todayStr: string): number {
  const today = new Date(todayStr)
  const [ty, tm] = [today.getFullYear(), today.getMonth() + 1]
  if (ty !== year || tm !== month) {
    // mês passado → todos os dias úteis
    return diasUteisMes(year, month)
  }
  const dayToday = today.getDate()
  let count = 0
  for (let d = 1; d <= dayToday; d++) if (!isSunday(year, month, d)) count++
  return count
}

function defaultMes(): string {
  const n = new Date()
  return n.toLocaleDateString("en-CA", { timeZone: TZ }).slice(0, 7)
}

function carregarMetas(): Metas {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...{ lucroLiquidoMes: 20000, investimentoAdsMes: 5605 }, ...JSON.parse(raw) }
  } catch {}
  return { lucroLiquidoMes: 20000, investimentoAdsMes: 5605 }
}

// ─── Semáforo ─────────────────────────────────────────────────────────────────
function semaforoCls(pct: number): string {
  if (pct >= 95) return "text-green-600 font-semibold"
  if (pct >= 80) return "text-yellow-600 font-semibold"
  if (pct >= 60) return "text-orange-600 font-semibold"
  return "text-red-600 font-semibold"
}

function semaforo(pct: number): string {
  if (pct >= 95) return "🟢"
  if (pct >= 80) return "🟡"
  if (pct >= 60) return "🟠"
  return "🔴"
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AcompanhamentoDiario() {
  const { toast } = useToast()
  const [mesAno, setMesAno] = useState(defaultMes)
  const [metas, setMetas] = useState<Metas>(carregarMetas)
  const [editMetas, setEditMetas] = useState<Metas>(metas)
  const [modalAberto, setModalAberto] = useState(false)
  const [loading, setLoading] = useState(true)

  // ─── Acessórios (mesmo mês/período da aba, via React Query) ─────────────────
  const [anoAcessorios, mesNumAcessorios] = mesAno.split("-").map(Number)
  const diasNoMesAcessorios = new Date(anoAcessorios, mesNumAcessorios, 0).getDate()
  const dataInicioAcessorios = `${mesAno}-01`
  const dataFimAcessorios = `${mesAno}-${String(diasNoMesAcessorios).padStart(2, "0")}`

  const { data: empresaIdAcessorios } = useQuery({
    queryKey: ["empresa-id-acessorios"],
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

  const { data: metricasAcessorios, isLoading: loadingMetricasAcessorios } = useQuery({
    queryKey: ["metricas-acessorios", empresaIdAcessorios, dataInicioAcessorios, dataFimAcessorios],
    enabled: !!empresaIdAcessorios,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("metricas_acessorios", {
        p_empresa_id: empresaIdAcessorios!,
        p_data_inicio: dataInicioAcessorios,
        p_data_fim: dataFimAcessorios,
      })
      if (error) {
        toast({ title: "Erro ao carregar métricas de acessórios", description: error.message, variant: "destructive" })
        throw error
      }
      return data?.[0] ?? null
    },
  })

  const { data: rankingAcessoriosInstalador, isLoading: loadingRankingAcessorios } = useQuery({
    queryKey: ["metricas-acessorios-instalador", empresaIdAcessorios, dataInicioAcessorios, dataFimAcessorios],
    enabled: !!empresaIdAcessorios,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("metricas_acessorios_por_instalador", {
        p_empresa_id: empresaIdAcessorios!,
        p_data_inicio: dataInicioAcessorios,
        p_data_fim: dataFimAcessorios,
      })
      if (error) {
        toast({ title: "Erro ao carregar ranking de acessórios por instalador", description: error.message, variant: "destructive" })
        throw error
      }
      return data ?? []
    },
  })

  const [servicos, setServicos] = useState<any[]>([])
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [recibos, setRecibos] = useState<any[]>([])
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [agendadosPendentes, setAgendadosPendentes] = useState<any[]>([])

  useEffect(() => { carregarDados() }, [mesAno])

  async function carregarDados() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: userData } = await supabase.from("usuarios").select("empresa_id").eq("id", user.id).single()
      if (!userData) return

      const [year, month] = mesAno.split("-").map(Number)
      const daysInMonth = new Date(year, month, 0).getDate()
      const startDate = `${mesAno}-01`
      const endDate = `${mesAno}-${String(daysInMonth).padStart(2, "0")}`

      const [res1, res2, res3, res4, res5] = await Promise.all([
        // 1. Serviços concluídos no mês
        supabase
          .from("servicos")
          .select(`
            id,
            data_servico_agendada,
            clientes!servicos_cliente_id_fkey(nome, origem_lead),
            instaladores!servicos_instalador_id_fkey(usuarios!instaladores_id_fkey(nome))
          `)
          .eq("empresa_id", userData.empresa_id)
          .eq("status", "concluido")
          .gte("data_servico_agendada", startDate)
          .lte("data_servico_agendada", endDate + "T23:59:59"),

        // 2. Lançamentos de caixa do mês
        supabase
          .from("lancamentos_caixa")
          .select("id, tipo, categoria, valor, data_lancamento")
          .eq("empresa_id", userData.empresa_id)
          .gte("data_lancamento", startDate)
          .lte("data_lancamento", endDate),

        // 3. Recibos diários pagos no mês
        supabase
          .from("servicos")
          .select("valor_mao_obra_instalador, data_conclusao")
          .eq("empresa_id", userData.empresa_id)
          .eq("status", "concluido")
          .gte("data_conclusao", startDate)
          .lte("data_conclusao", endDate + "T23:59:59"),

        // 4. Cotações criadas no mês
        supabase
          .from("cotacoes")
          .select("id, status, created_at")
          .eq("empresa_id", userData.empresa_id)
          .gte("created_at", startDate + "T00:00:00")
          .lte("created_at", endDate + "T23:59:59"),

        // 5. Serviços agendados no mês que ainda não foram concluídos nem
        // cancelados — previsão do que ainda vai virar receita (mesma lógica
        // do card PROJEÇÃO do Caixa.tsx: mão de obra*2, ou valor_total como
        // fallback pra serviços sem mão de obra rastreada).
        supabase
          .from("servicos")
          .select("valor_total, valor_mao_obra_instalador")
          .eq("empresa_id", userData.empresa_id)
          .not("status", "in", "(concluido,cancelado)")
          .gte("data_servico_agendada", startDate)
          .lte("data_servico_agendada", endDate + "T23:59:59"),
      ])

      setServicos(res1.data || [])
      setLancamentos(res2.data || [])
      setRecibos(res3.data || [])
      setCotacoes(res4.data || [])
      setAgendadosPendentes(res5.data || [])
    } catch (err) {
      console.error("Erro ao carregar dados de acompanhamento:", err)
    } finally {
      setLoading(false)
    }
  }

  const computed = useMemo(() => {
    const [year, month] = mesAno.split("-").map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const today = todayTZ()

    // Índices por dia
    const servicosPorDia: Record<string, any[]> = {}
    for (const s of servicos) {
      const dia = toTZDateStr(s.data_servico_agendada)
      if (!servicosPorDia[dia]) servicosPorDia[dia] = []
      servicosPorDia[dia].push(s)
    }

    const lancPorDia: Record<string, { receita: number; despesa: number }> = {}
    for (const l of lancamentos) {
      const dia = l.data_lancamento.slice(0, 10)
      if (!lancPorDia[dia]) lancPorDia[dia] = { receita: 0, despesa: 0 }
      if (l.tipo === "receita") {
        if (!CATEGORIAS_INSTALADORES.has(l.categoria)) lancPorDia[dia].receita += Number(l.valor)
      } else {
        if (!CATEGORIAS_INSTALADORES.has(l.categoria)) lancPorDia[dia].despesa += Number(l.valor)
      }
    }

    // Mão de obra dos instaladores por dia de conclusão do serviço — igual à
    // fonte do card "Instaladores" do resumo (recibos), só que bucketado por
    // dia. Antes ficava de fora da tabela diária (só entrava no total do
    // mês), fazendo a soma dos dias não bater com o Lucro Líquido do topo.
    const instaladorPorDia: Record<string, number> = {}
    for (const r of recibos) {
      if (!r.data_conclusao) continue
      const dia = toTZDateStr(r.data_conclusao)
      instaladorPorDia[dia] = (instaladorPorDia[dia] ?? 0) + Number(r.valor_mao_obra_instalador || 0)
    }

    // Resumo global
    const totalReceitas = lancamentos
      .filter((l) => l.tipo === "receita" && !CATEGORIAS_INSTALADORES.has(l.categoria))
      .reduce((s, l) => s + Number(l.valor), 0)

    const totalDespesasGerais = lancamentos
      .filter((l) => l.tipo === "despesa" && !CATEGORIAS_INSTALADORES.has(l.categoria))
      .reduce((s, l) => s + Number(l.valor), 0)

    const totalInstaladores = recibos.reduce((s, r) => s + Number(r.valor_mao_obra_instalador || 0), 0)

    const lucroLiquido = totalReceitas - totalDespesasGerais - totalInstaladores

    // Projeção
    const diasUteis = diasUteisMes(year, month)
    const diasDecorridos = diasDecoridosUteis(year, month, today)
    const lucroProjetado =
      diasDecorridos >= 3
        ? (lucroLiquido / diasDecorridos) * diasUteis
        : null

    // Taxa de conversão
    const taxaConversao = cotacoes.length > 0 ? (servicos.length / cotacoes.length) * 100 : 0

    // Previsão — serviços agendados no mês que ainda não foram concluídos
    // nem cancelados. Empresa opera 50/50 com o instalador: metade do valor
    // agendado é a fatia prevista dele, a outra metade é o que sobra pra
    // empresa (antes de descontar despesas gerais do mês).
    const valorAgendado = agendadosPendentes.reduce((s, a) => {
      const maoObra = Number(a.valor_mao_obra_instalador || 0)
      return s + (maoObra === 0 ? Number(a.valor_total || 0) : maoObra * 2)
    }, 0)
    const metadeInstaladoresPrevista = valorAgendado / 2
    const lucroPrevistoEmpresa = valorAgendado - metadeInstaladoresPrevista

    // Tabela diária
    const dias: DiaTabela[] = []
    let lucroAcum = 0

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${mesAno}-${String(d).padStart(2, "0")}`
      const dow = new Date(year, month - 1, d).getDay()
      const isDom = dow === 0

      const svsHoje = isDom ? [] : (servicosPorDia[dStr] || [])
      const google = svsHoje.filter((s) => {
        const origem = (s.clientes as any)?.origem_lead || ""
        return origem.toLowerCase().includes("google")
      }).length
      const organico = svsHoje.length - google
      const rayana = svsHoje.filter((s) => {
        const nome = (s.instaladores as any)?.usuarios?.nome || ""
        return nome.toLowerCase().includes("rayana")
      }).length

      const lanc = isDom ? { receita: 0, despesa: 0 } : (lancPorDia[dStr] || { receita: 0, despesa: 0 })
      const despesaInstalador = isDom ? 0 : (instaladorPorDia[dStr] || 0)
      const lucroDia = lanc.receita - lanc.despesa - despesaInstalador
      if (!isDom) lucroAcum += lucroDia

      const pct = metas.lucroLiquidoMes > 0 ? (lucroAcum / metas.lucroLiquidoMes) * 100 : 0

      dias.push({
        dia: d,
        diaSemana: DIAS_PT[dow],
        isDomingo: isDom,
        google,
        organico,
        total: svsHoje.length,
        jobsRayana: rayana,
        receita: lanc.receita,
        despesa: lanc.despesa,
        despesaInstalador,
        lucroDia,
        lucroAcumulado: lucroAcum,
        percentMeta: pct,
      })
    }

    // Jobs Rayana hoje
    const todayServicos = servicosPorDia[today] || []
    const rayanasHoje = todayServicos.filter((s) => {
      const nome = (s.instaladores as any)?.usuarios?.nome || ""
      return nome.toLowerCase().includes("rayana")
    }).length

    const pctMeta = metas.lucroLiquidoMes > 0 ? (lucroLiquido / metas.lucroLiquidoMes) * 100 : 0
    const pctProj = lucroProjetado != null && metas.lucroLiquidoMes > 0
      ? (lucroProjetado / metas.lucroLiquidoMes) * 100 : null

    return {
      totalReceitas,
      totalDespesasGerais,
      totalInstaladores,
      lucroLiquido,
      lucroProjetado,
      taxaConversao,
      totalJobs: servicos.length,
      dias,
      rayanasHoje,
      pctMeta,
      pctProj,
      valorAgendado,
      metadeInstaladoresPrevista,
      lucroPrevistoEmpresa,
    }
  }, [servicos, lancamentos, recibos, cotacoes, agendadosPendentes, mesAno, metas])

  function salvarMetas() {
    const novas: Metas = {
      lucroLiquidoMes: Number(editMetas.lucroLiquidoMes) || 0,
      investimentoAdsMes: Number(editMetas.investimentoAdsMes) || 0,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novas))
    setMetas(novas)
    setModalAberto(false)
  }

  // ─── Alertas ────────────────────────────────────────────────────────────────
  const alertas: { tipo: "erro" | "aviso" | "ok"; msg: string }[] = []
  const { pctProj, lucroProjetado, taxaConversao, rayanasHoje } = computed

  if (pctProj != null) {
    if (pctProj < 80)
      alertas.push({ tipo: "erro", msg: `Projeção crítica: ${pctProj.toFixed(1)}% da meta (abaixo de 80%)` })
    else if (pctProj < 95)
      alertas.push({ tipo: "aviso", msg: `Projeção em alerta: ${pctProj.toFixed(1)}% da meta (80–94%)` })
  }
  if (lucroProjetado != null && lucroProjetado < 15000)
    alertas.push({ tipo: "aviso", msg: `Lucro projetado abaixo de R$ 15.000 (R$ ${fmt(lucroProjetado)})` })
  if (taxaConversao < 50 && cotacoes.length > 0)
    alertas.push({ tipo: "erro", msg: `Taxa de conversão baixa: ${taxaConversao.toFixed(1)}%` })
  if (rayanasHoje > 1)
    alertas.push({ tipo: "ok", msg: `Rayana tem ${rayanasHoje} jobs hoje` })

  return (
    <div className="space-y-6">
      {/* Header: seletor de mês + botão metas */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Mês:</Label>
          <Input
            type="month"
            value={mesAno}
            onChange={(e) => setMesAno(e.target.value)}
            className="w-40"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setEditMetas(metas); setModalAberto(true) }}
        >
          <Settings className="w-4 h-4 mr-2" />
          Ajustar Metas
        </Button>
      </div>

      {/* Alertas */}
      {!loading && alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                a.tipo === "erro"
                  ? "bg-red-50 text-red-800 border border-red-200"
                  : a.tipo === "aviso"
                  ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                  : "bg-green-50 text-green-800 border border-green-200"
              }`}
            >
              {a.tipo === "ok" ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* 4 Cards de topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lucro Líquido */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Lucro Líquido
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <p className="text-2xl font-bold">R$ {fmt(computed.lucroLiquido)}</p>
                <p className={`text-sm mt-1 ${semaforoCls(computed.pctMeta)}`}>
                  {semaforo(computed.pctMeta)} {computed.pctMeta.toFixed(1)}% da meta
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Lucro Projetado */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Lucro Projetado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : computed.lucroProjetado != null ? (
              <>
                <p className="text-2xl font-bold">R$ {fmt(computed.lucroProjetado)}</p>
                {pctProj != null && (
                  <p className={`text-sm mt-1 ${semaforoCls(pctProj)}`}>
                    {semaforo(pctProj)} {pctProj.toFixed(1)}% da meta
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                {loading ? "" : "Dados insuficientes (carência 3 dias)"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Total Jobs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Total Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <p className="text-2xl font-bold">{computed.totalJobs}</p>
                <p className="text-sm text-muted-foreground mt-1">serviços concluídos</p>
                {computed.totalJobs > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Ticket médio: R$ {fmt(computed.totalReceitas / computed.totalJobs)}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Taxa de Conversão */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-2xl font-bold">{computed.taxaConversao.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {computed.totalJobs} / {cotacoes.length} cotações
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumo financeiro */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <p className="text-green-700 font-medium">Receitas</p>
            <p className="text-green-900 font-bold text-lg">R$ {fmt(computed.totalReceitas)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 border border-red-100">
            <p className="text-red-700 font-medium">Despesas Gerais</p>
            <p className="text-red-900 font-bold text-lg">R$ {fmt(computed.totalDespesasGerais)}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
            <p className="text-orange-700 font-medium">Instaladores</p>
            <p className="text-orange-900 font-bold text-lg">R$ {fmt(computed.totalInstaladores)}</p>
          </div>
        </div>
      )}

      {/* Previsão — serviços agendados no mês, ainda não concluídos nem cancelados */}
      {!loading && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Previsão — serviços agendados no mês que ainda não foram concluídos (empresa fica com 50%)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <p className="text-blue-700 font-medium">Agendado</p>
              <p className="text-blue-900 font-bold text-lg">R$ {fmt(computed.valorAgendado)}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <p className="text-amber-700 font-medium">50% Instaladores (previsto)</p>
              <p className="text-amber-900 font-bold text-lg">R$ {fmt(computed.metadeInstaladoresPrevista)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <p className="text-blue-700 font-medium">Lucro Previsto (empresa)</p>
              <p className="text-blue-900 font-bold text-lg">R$ {fmt(computed.lucroPrevistoEmpresa)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabela diária */}
      {/* Mobile: cards, sem tabela de 900px pra rolar de lado */}
      <div className="md:hidden bg-card rounded-lg shadow-sm border divide-y divide-border">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-3">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          : computed.dias.map((row) => {
              const isFuture = `${mesAno}-${String(row.dia).padStart(2, "0")}` > todayTZ()

              if (row.isDomingo) {
                return (
                  <div key={row.dia} className="px-3 py-2 flex items-center justify-between text-sm text-gray-400 bg-gray-50">
                    <span>{String(row.dia).padStart(2, "0")} · {row.diaSemana}</span>
                    <span>–</span>
                  </div>
                )
              }

              return (
                <div key={row.dia} className={`p-3 ${isFuture ? "text-muted-foreground" : ""}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-sm">
                      {String(row.dia).padStart(2, "0")} · {row.diaSemana}
                    </span>
                    <span className={`text-sm ${semaforoCls(row.percentMeta)}`}>
                      {semaforo(row.percentMeta)} {row.percentMeta.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mb-2">
                    <span className={row.google > 0 ? "text-blue-600" : ""}>Google: {row.google}</span>
                    <span>Orgânico: {row.organico}</span>
                    <span className="font-medium text-foreground">Total: {row.total}</span>
                    {row.jobsRayana > 0 && (
                      <span className="text-purple-600 font-medium">Rayana: {row.jobsRayana}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                    <span className="text-green-700">Receita: R$ {fmt(row.receita)}</span>
                    <span className="text-red-600">Despesa: R$ {fmt(row.despesa)}</span>
                    <span className="text-orange-600">Instaladores: R$ {fmt(row.despesaInstalador)}</span>
                  </div>
                  <div className={`mt-2 rounded-md px-3 py-2 flex items-center justify-between ${
                    row.lucroDia >= 0 ? "bg-green-50" : "bg-red-50"
                  }`}>
                    <div>
                      <p className="text-xs text-muted-foreground">Lucro do dia</p>
                      <p className={`text-xl font-bold ${row.lucroDia >= 0 ? "text-green-700" : "text-red-600"}`}>
                        R$ {fmt(row.lucroDia)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Acumulado</p>
                      <p className="text-sm font-medium">R$ {fmt(row.lucroAcumulado)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
      </div>

      {/* Desktop: tabela completa */}
      <div className="hidden md:block bg-card rounded-lg shadow-sm border overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Dia</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Semana</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Google</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Orgânico</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Rayana</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Receita</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Despesa</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Instaladores</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Lucro Dia</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Acumulado</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">% Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 12 }).map((_, j) => (
                      <td key={j} className="px-3 py-2">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : computed.dias.map((row) => {
                  const isFuture =
                    `${mesAno}-${String(row.dia).padStart(2, "0")}` > todayTZ()
                  const rowCls = row.isDomingo
                    ? "bg-gray-50 text-gray-400"
                    : isFuture
                    ? "text-muted-foreground"
                    : ""

                  return (
                    <tr key={row.dia} className={`${rowCls} hover:bg-muted/30 transition-colors`}>
                      <td className="px-3 py-2 font-medium">{String(row.dia).padStart(2, "0")}</td>
                      <td className="px-3 py-2">{row.diaSemana}</td>
                      <td className="px-3 py-2 text-right">
                        {row.isDomingo ? "–" : row.google > 0 ? (
                          <span className="text-blue-600">{row.google}</span>
                        ) : "0"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.isDomingo ? "–" : row.organico}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {row.isDomingo ? "–" : row.total}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.isDomingo ? "–" : row.jobsRayana > 0 ? (
                          <span className="text-purple-600 font-medium">{row.jobsRayana}</span>
                        ) : "0"}
                      </td>
                      <td className="px-3 py-2 text-right text-green-700">
                        {row.isDomingo ? "–" : `R$ ${fmt(row.receita)}`}
                      </td>
                      <td className="px-3 py-2 text-right text-red-600">
                        {row.isDomingo ? "–" : `R$ ${fmt(row.despesa)}`}
                      </td>
                      <td className="px-3 py-2 text-right text-orange-600">
                        {row.isDomingo ? "–" : `R$ ${fmt(row.despesaInstalador)}`}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${
                        !row.isDomingo && row.lucroDia >= 0 ? "text-green-700" : !row.isDomingo ? "text-red-600" : ""
                      }`}>
                        {row.isDomingo ? "–" : `R$ ${fmt(row.lucroDia)}`}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {row.isDomingo ? "–" : `R$ ${fmt(row.lucroAcumulado)}`}
                      </td>
                      <td className={`px-3 py-2 text-right ${row.isDomingo ? "" : semaforoCls(row.percentMeta)}`}>
                        {row.isDomingo ? "–" : `${row.percentMeta.toFixed(1)}%`}
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>

      {/* Acessórios extras vendidos no período */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Package className="w-5 h-5" />
          Acessórios
        </h3>

        {!loadingMetricasAcessorios && metricasAcessorios && metricasAcessorios.total_servicos > 0 && metricasAcessorios.total_linhas === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum acessório vendido no período</p>
        ) : (
          <>
            {/* 4 Cards de acessórios */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    Taxa de Anexo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingMetricasAcessorios ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className="text-2xl font-bold">
                      {(metricasAcessorios?.taxa_anexo_pct ?? 0).toFixed(1)}%
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Lucro de Acessórios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingMetricasAcessorios ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                    <>
                      <p className="text-2xl font-bold">
                        {formatarBRL(
                          (metricasAcessorios?.lucro_acessorios_empresa ?? 0) +
                            (metricasAcessorios?.lucro_acessorios_instalador ?? 0)
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatarBRL(metricasAcessorios?.lucro_acessorios_empresa ?? 0)} empresa ·{" "}
                        {formatarBRL(metricasAcessorios?.lucro_acessorios_instalador ?? 0)} instalador
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Itens por Serviço
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingMetricasAcessorios ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">
                      {(metricasAcessorios?.itens_por_servico_anexado ?? 0).toFixed(2)}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    % Fornecido pela Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingMetricasAcessorios ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className="text-2xl font-bold">
                      {(metricasAcessorios?.pct_fornecido_empresa ?? 0).toFixed(1)}%
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Ranking por instalador */}
            {/* Mobile: cards, sem tabela de 600px pra rolar de lado */}
            <div className="md:hidden bg-card rounded-lg shadow-sm border divide-y divide-border">
              {loadingRankingAcessorios ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3">
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))
              ) : !rankingAcessoriosInstalador || rankingAcessoriosInstalador.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum instalador com serviços concluídos no período
                </div>
              ) : (
                rankingAcessoriosInstalador.map((row) => (
                  <div key={row.instalador_id} className="p-3">
                    <p className="font-medium text-sm mb-1">{row.instalador_nome}</p>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{row.servicos_concluidos} serviços · {row.itens_vendidos} itens</span>
                      <span className="text-green-700 font-medium">
                        {formatarBRL(row.lucro_gerado_empresa ?? 0)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop: tabela completa */}
            <div className="hidden md:block bg-card rounded-lg shadow-sm border overflow-x-auto">
              <table className="min-w-[600px] w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Instalador</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Serviços Concluídos</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Itens Vendidos</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Lucro Gerado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingRankingAcessorios
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 4 }).map((_, j) => (
                            <td key={j} className="px-3 py-2">
                              <Skeleton className="h-4 w-full" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : !rankingAcessoriosInstalador || rankingAcessoriosInstalador.length === 0
                    ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                          Nenhum instalador com serviços concluídos no período
                        </td>
                      </tr>
                    )
                    : rankingAcessoriosInstalador.map((row) => (
                        <tr key={row.instalador_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2 font-medium">{row.instalador_nome}</td>
                          <td className="px-3 py-2 text-right">{row.servicos_concluidos}</td>
                          <td className="px-3 py-2 text-right">{row.itens_vendidos}</td>
                          <td className="px-3 py-2 text-right text-green-700">
                            {formatarBRL(row.lucro_gerado_empresa ?? 0)}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Dialog: Ajustar Metas */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Metas do Mês</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Meta de Lucro Líquido (R$)</Label>
              <Input
                type="number"
                value={editMetas.lucroLiquidoMes}
                onChange={(e) =>
                  setEditMetas((m) => ({ ...m, lucroLiquidoMes: Number(e.target.value) }))
                }
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Investimento em Ads / mês (R$)</Label>
              <Input
                type="number"
                value={editMetas.investimentoAdsMes}
                onChange={(e) =>
                  setEditMetas((m) => ({ ...m, investimentoAdsMes: Number(e.target.value) }))
                }
                min={0}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarMetas}>Salvar Metas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
