import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"

// ─── Constants ───────────────────────────────────────────────────────────────
const TZ = "America/Sao_Paulo"
// Mesmo set do Caixa.tsx — categorias que são acerto de caixa com o
// instalador (ele pagando a empresa ou vice-versa), não receita/despesa
// nova. "Recebimento Instalador" precisa ficar de fora de Receitas senão
// dobra a contagem: a receita do serviço já foi lançada inteira em
// "Receita de Serviço" na aprovação (ver fix 2026-08-18 no Caixa — esse
// componente tinha ficado pra trás, causando "Entrada" do Marketing
// diferente do Caixa).
const CATEGORIAS_INSTALADORES = new Set(["Pagamento Instalador", "Reembolso Materiais", "Recebimento Instalador"])

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toDateStr(dateInput: string): string {
  // Returns YYYY-MM-DD in SP timezone
  const d = new Date(dateInput)
  return d.toLocaleDateString("en-CA", { timeZone: TZ })
}

function diaAtualSP(): number {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: TZ })
  return parseInt(hoje.slice(8, 10))
}

function ultimos6Meses(): string[] {
  const meses: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    meses.push(`${y}-${m}`)
  }
  return meses
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`
}

function labelMes(mes: string): string {
  const [y, m] = mes.split("-")
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${nomes[parseInt(m) - 1]}/${y.slice(2)}`
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface DadosMes {
  mes: string
  totalReceitas: number
  totalDespesasGerais: number
  totalInstaladores: number
  lucroLiquido: number
  margemLucro: number        // %
  totalServicos: number
  ticketMedio: number
  jobsGoogle: number
  jobsOrganico: number
  taxaConversao: number      // %
  totalCotacoes: number
  custoPorServicoInstalador: number
  instaladoresAtivos: number
  investimentoAds: number
  cliques: number
  custoPorCotacao: number
  custoPorServicoAds: number
  roasReal: number
}

function dadosVazios(mes: string): DadosMes {
  return {
    mes, totalReceitas: 0, totalDespesasGerais: 0, totalInstaladores: 0,
    lucroLiquido: 0, margemLucro: 0, totalServicos: 0, ticketMedio: 0,
    jobsGoogle: 0, jobsOrganico: 0, taxaConversao: 0, totalCotacoes: 0,
    custoPorServicoInstalador: 0, instaladoresAtivos: 0, investimentoAds: 0,
    cliques: 0, custoPorCotacao: 0, custoPorServicoAds: 0, roasReal: 0,
  }
}

// ─── Tendência ────────────────────────────────────────────────────────────────
// isPositivo: true = mais alto é melhor (receita, lucro, jobs...)
//             false = mais baixo é melhor (despesas, custos...)
function Tendencia({ atual, anterior, isPositivo = true }: {
  atual: number; anterior: number; isPositivo?: boolean
}) {
  if (anterior === 0) return null
  const subiu = atual > anterior
  const bom = isPositivo ? subiu : !subiu
  if (atual === anterior) return <span className="text-gray-400 ml-1 text-xs">→</span>
  return (
    <span className={`ml-1 text-xs font-medium ${bom ? "text-green-600" : "text-red-500"}`}>
      {subiu ? "↑" : "↓"}
    </span>
  )
}

// ─── Definição das linhas da tabela ─────────────────────────────────────────
type Fmt = "brl" | "pct" | "int" | "brl_int"

interface Linha {
  label: string
  key: keyof DadosMes
  fmt: Fmt
  isPositivo?: boolean   // default true
  secao?: string         // nome do grupo
}

const LINHAS: Linha[] = [
  // FINANCEIRO
  { label: "Total Entrada",       key: "totalReceitas",       fmt: "brl",    secao: "FINANCEIRO" },
  { label: "Lucro Líquido",       key: "lucroLiquido",        fmt: "brl" },
  { label: "Margem de Lucro",     key: "margemLucro",         fmt: "pct" },
  { label: "Despesas Gerais",     key: "totalDespesasGerais", fmt: "brl",    isPositivo: false },
  { label: "Custo Instaladores",  key: "totalInstaladores",   fmt: "brl",    isPositivo: false },
  // OPERACIONAL
  { label: "Total Serviços",      key: "totalServicos",       fmt: "int",    secao: "OPERACIONAL" },
  { label: "Ticket Médio",        key: "ticketMedio",         fmt: "brl" },
  { label: "Jobs Google",         key: "jobsGoogle",          fmt: "int" },
  { label: "Jobs Orgânico",       key: "jobsOrganico",        fmt: "int" },
  { label: "Taxa de Conversão",   key: "taxaConversao",       fmt: "pct" },
  // INSTALADORES
  { label: "Custo por Serviço",   key: "custoPorServicoInstalador", fmt: "brl", isPositivo: false, secao: "INSTALADORES" },
  { label: "Instaladores Ativos", key: "instaladoresAtivos",  fmt: "int" },
  // ADS
  { label: "Investimento ADS",    key: "investimentoAds",     fmt: "brl",    isPositivo: false, secao: "ADS" },
  { label: "Cliques",             key: "cliques",             fmt: "int" },
  { label: "Custo por Cotação",   key: "custoPorCotacao",     fmt: "brl",    isPositivo: false },
  { label: "Custo por Serviço ADS", key: "custoPorServicoAds", fmt: "brl",  isPositivo: false },
  { label: "ROAS Real",           key: "roasReal",            fmt: "brl_int" },
]

function formatVal(v: number, fmt: Fmt): string {
  if (fmt === "brl") return `R$ ${fmtBRL(v)}`
  if (fmt === "pct") return fmtPct(v)
  if (fmt === "int") return String(Math.round(v))
  if (fmt === "brl_int") return v === 0 ? "–" : `${v.toFixed(2)}x`
  return String(v)
}

// ─── Cálculo por período (dataInicio/dataFim no formato YYYY-MM-DD) ─────────
function calcularPeriodo(
  mes: string,
  dataInicio: string,
  dataFim: string,
  dadosBrutos: { servicos: any[]; lancamentos: any[]; recibos: any[]; cotacoes: any[]; cliques: any[] }
): DadosMes {
  const { servicos, lancamentos, recibos, cotacoes, cliques } = dadosBrutos
  const d = dadosVazios(mes)

  const noPeriodo = (data: string) => data >= dataInicio && data <= dataFim
  const noPeriodoTS = (data: string) => {
    const dia = toDateStr(data)
    return dia >= dataInicio && dia <= dataFim
  }

  // Lançamentos do período
  const lancsDoPeriodo = lancamentos.filter((l) => noPeriodo(l.data_lancamento))
  d.totalReceitas = lancsDoPeriodo
    .filter((l) => l.tipo === "receita" && !CATEGORIAS_INSTALADORES.has(l.categoria))
    .reduce((s, l) => s + Number(l.valor), 0)
  d.totalDespesasGerais = lancsDoPeriodo
    .filter((l) => l.tipo === "despesa" && !CATEGORIAS_INSTALADORES.has(l.categoria))
    .reduce((s, l) => s + Number(l.valor), 0)
  d.investimentoAds = lancsDoPeriodo
    .filter((l) => l.tipo === "despesa" && l.categoria === "Marketing")
    .reduce((s, l) => s + Number(l.valor), 0)

  // Custo instaladores do período
  d.totalInstaladores = recibos
    .filter((r) => noPeriodoTS(r.data_conclusao))
    .reduce((s, r) => s + Number(r.valor_mao_obra_instalador || 0), 0)

  // Lucro
  d.lucroLiquido = d.totalReceitas - d.totalDespesasGerais - d.totalInstaladores
  d.margemLucro = d.totalReceitas > 0 ? (d.lucroLiquido / d.totalReceitas) * 100 : 0

  // Serviços do período
  const svsPeriodo = servicos.filter((s) => noPeriodoTS(s.data_servico_agendada))
  d.totalServicos = svsPeriodo.length
  d.ticketMedio = d.totalServicos > 0 ? d.totalReceitas / d.totalServicos : 0

  d.jobsGoogle = svsPeriodo.filter((s) => {
    const origem = (s.clientes as any)?.origem_lead || ""
    return origem.toLowerCase().includes("google")
  }).length
  d.jobsOrganico = d.totalServicos - d.jobsGoogle

  // Instaladores ativos
  d.instaladoresAtivos = new Set(
    svsPeriodo.map((s) => s.instalador_id).filter(Boolean)
  ).size

  // Custo por serviço (instaladores)
  d.custoPorServicoInstalador =
    d.totalServicos > 0 ? d.totalInstaladores / d.totalServicos : 0

  // Cotações do período
  const cotsPeriodo = cotacoes.filter((c) => noPeriodoTS(c.created_at))
  d.totalCotacoes = cotsPeriodo.length
  d.taxaConversao =
    d.totalCotacoes > 0 ? (d.totalServicos / d.totalCotacoes) * 100 : 0

  // ADS
  d.custoPorCotacao =
    d.totalCotacoes > 0 ? d.investimentoAds / d.totalCotacoes : 0
  d.custoPorServicoAds =
    d.jobsGoogle > 0 ? d.investimentoAds / d.jobsGoogle : 0
  d.roasReal =
    d.investimentoAds > 0 ? d.totalReceitas / d.investimentoAds : 0

  // Cliques do período
  d.cliques = cliques.filter((c) => noPeriodoTS(c.created_at)).length

  return d
}

// ─── Component ───────────────────────────────────────────────────────────────
export function ComparativoMensal() {
  const [loading, setLoading] = useState(true)
  const [dadosBrutos, setDadosBrutos] = useState<{
    servicos: any[]
    lancamentos: any[]
    recibos: any[]
    cotacoes: any[]
    cliques: any[]
  }>({ servicos: [], lancamentos: [], recibos: [], cotacoes: [], cliques: [] })

  const meses = useMemo(() => ultimos6Meses(), [])

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: userData } = await supabase
        .from("usuarios")
        .select("empresa_id")
        .eq("id", user.id)
        .single()
      if (!userData) return

      const startDate = `${meses[0]}-01`
      const lastMes = meses[meses.length - 1]
      const lastDay = new Date(
        parseInt(lastMes.slice(0, 4)),
        parseInt(lastMes.slice(5, 7)),
        0
      ).getDate()
      const endDate = `${lastMes}-${String(lastDay).padStart(2, "0")}`

      const [res1, res2, res3, res4, res5] = await Promise.all([
        // Serviços concluídos (6 meses)
        supabase
          .from("servicos")
          .select("id, data_servico_agendada, instalador_id, clientes!servicos_cliente_id_fkey(origem_lead)")
          .eq("empresa_id", userData.empresa_id)
          .eq("status", "concluido")
          .gte("data_servico_agendada", startDate)
          .lte("data_servico_agendada", endDate + "T23:59:59"),

        // Lançamentos de caixa (6 meses)
        supabase
          .from("lancamentos_caixa")
          .select("tipo, categoria, valor, data_lancamento")
          .eq("empresa_id", userData.empresa_id)
          .gte("data_lancamento", startDate)
          .lte("data_lancamento", endDate),

        // Custo instaladores - serviços concluídos (6 meses)
        supabase
          .from("servicos")
          .select("valor_mao_obra_instalador, data_conclusao")
          .eq("empresa_id", userData.empresa_id)
          .eq("status", "concluido")
          .gte("data_conclusao", startDate)
          .lte("data_conclusao", endDate + "T23:59:59"),

        // Cotações (6 meses)
        supabase
          .from("cotacoes")
          .select("id, created_at, origem_lead")
          .eq("empresa_id", userData.empresa_id)
          .gte("created_at", startDate + "T00:00:00")
          .lte("created_at", endDate + "T23:59:59"),

        // Cliques WhatsApp (6 meses, sem filtro empresa)
        supabase
          .from("cliques_whatsapp")
          .select("id, created_at")
          .gte("created_at", startDate + "T00:00:00")
          .lte("created_at", endDate + "T23:59:59"),
      ])

      setDadosBrutos({
        servicos: res1.data || [],
        lancamentos: res2.data || [],
        recibos: res3.data || [],
        cotacoes: res4.data || [],
        cliques: res5.data || [],
      })
    } catch (err) {
      console.error("Erro ao carregar comparativo mensal:", err)
    } finally {
      setLoading(false)
    }
  }

  const diaAtual = useMemo(() => diaAtualSP(), [])

  const dadosPorMes = useMemo((): { mes: string; total: DadosMes; proporcional: DadosMes }[] => {
    return meses.map((mes) => {
      const lastDay = new Date(parseInt(mes.slice(0, 4)), parseInt(mes.slice(5, 7)), 0).getDate()
      const ultimoDiaMes = `${mes}-${String(lastDay).padStart(2, "0")}`
      const diaProp = Math.min(diaAtual, lastDay)
      const dataPropFim = `${mes}-${String(diaProp).padStart(2, "0")}`

      const total = calcularPeriodo(mes, `${mes}-01`, ultimoDiaMes, dadosBrutos)
      const proporcional = calcularPeriodo(mes, `${mes}-01`, dataPropFim, dadosBrutos)

      return { mes, total, proporcional }
    })
  }, [dadosBrutos, meses, diaAtual])

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b bg-muted/50">
            <th rowSpan={2} className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-left font-semibold text-muted-foreground min-w-[190px] align-bottom">
              Métrica
            </th>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <th key={i} colSpan={2} className="px-4 py-3 text-center min-w-[180px] border-l">
                    <Skeleton className="h-4 w-16 mx-auto" />
                  </th>
                ))
              : meses.map((mes) => (
                  <th
                    key={mes}
                    colSpan={2}
                    className="px-4 py-3 text-center font-semibold min-w-[180px] text-foreground border-l"
                  >
                    {labelMes(mes)}
                  </th>
                ))}
          </tr>
          <tr className="border-b bg-muted/30">
            {loading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <th key={i} className="px-2 py-1.5 text-center min-w-[90px]">
                    <Skeleton className="h-3 w-10 mx-auto" />
                  </th>
                ))
              : meses.flatMap((mes) => [
                  <th key={`${mes}-total`} className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground min-w-[90px] border-l">
                    Total
                  </th>,
                  <th key={`${mes}-prop`} className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground min-w-[90px]">
                    Prop.
                  </th>,
                ])}
          </tr>
        </thead>
        <tbody>
          {LINHAS.map((linha, idx) => {
            const isFirstDaSecao = !!linha.secao
            return (
              <>
                {isFirstDaSecao && (
                  <tr key={`secao-${linha.secao}`} className="bg-muted/30 border-t-2 border-border">
                    <td
                      colSpan={13}
                      className="sticky left-0 px-4 py-1.5 text-xs font-bold tracking-widest uppercase text-muted-foreground bg-muted/30"
                    >
                      {linha.secao}
                    </td>
                  </tr>
                )}
                <tr
                  key={linha.key}
                  className="border-b hover:bg-muted/20 transition-colors"
                >
                  <td className="sticky left-0 z-10 bg-card px-4 py-2.5 font-medium text-foreground border-r">
                    {linha.label}
                  </td>
                  {loading
                    ? Array.from({ length: 12 }).map((_, i) => (
                        <td key={i} className="px-2 py-2.5 text-center">
                          <Skeleton className="h-4 w-16 mx-auto" />
                        </td>
                      ))
                    : dadosPorMes.flatMap((dados, i) => {
                        const valTotal = dados.total[linha.key] as number
                        const valProp = dados.proporcional[linha.key] as number
                        const anteriorTotal = i > 0 ? (dadosPorMes[i - 1].total[linha.key] as number) : null
                        const anteriorProp = i > 0 ? (dadosPorMes[i - 1].proporcional[linha.key] as number) : null
                        const isPositivo = linha.isPositivo !== false
                        return [
                          <td
                            key={`${dados.mes}-total`}
                            className="px-2 py-2.5 text-right tabular-nums border-l"
                          >
                            <span>{formatVal(valTotal, linha.fmt)}</span>
                            {anteriorTotal !== null && (
                              <Tendencia
                                atual={valTotal}
                                anterior={anteriorTotal}
                                isPositivo={isPositivo}
                              />
                            )}
                          </td>,
                          <td
                            key={`${dados.mes}-prop`}
                            className="px-2 py-2.5 text-right tabular-nums"
                          >
                            <span>{formatVal(valProp, linha.fmt)}</span>
                            {anteriorProp !== null && (
                              <Tendencia
                                atual={valProp}
                                anterior={anteriorProp}
                                isPositivo={isPositivo}
                              />
                            )}
                          </td>,
                        ]
                      })}
                </tr>
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
