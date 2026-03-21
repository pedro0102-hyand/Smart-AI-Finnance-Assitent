import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, AlertTriangle,
  RefreshCw, ArrowUpRight, Sparkles,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { summaryApi } from '../services/api'
import type { FinancialSummary } from '../types'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const URGENCY_COLOR: Record<string, string> = {
  'Alta urgência':   '#f87171',
  'Média urgência':  '#fbbf24',
  'Baixa urgência':  '#4ade80',
}
const CHART_COLORS = ['#f59e0b','#f87171','#4ade80','#60a5fa','#c084fc','#fb923c','#34d399']

function pctColor(v: number) {
  if (v < 50) return 'text-success'
  if (v < 75) return 'text-warning'
  return 'text-danger'
}
function barColor(v: number) {
  if (v < 50) return 'bg-success'
  if (v < 75) return 'bg-warning'
  return 'bg-danger'
}

// ── skeleton ──────────────────────────────────────────────────────────────────
function Bone({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-lg bg-[var(--bg-secondary)] ${className}`}
      style={{ animation: 'skeletonPulse 1.6s ease-in-out infinite', ...style }}
    />
  )
}

function DashboardSkeleton() {
  return (
    <>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Bone className="h-8 w-40" />
          <Bone className="h-4 w-56" />
        </div>
        <Bone className="h-9 w-9 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card flex flex-col gap-3 p-4 md:p-6">
            <div className="flex items-center justify-between">
              <Bone className="h-3 w-20" />
              <Bone className="h-7 w-7 md:h-8 md:w-8 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Bone className="h-7 w-28" />
              <Bone className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="card p-4 md:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <Bone className="h-3 w-44" />
          <Bone className="h-8 w-14" />
        </div>
        <Bone className="h-3 w-full rounded-full" />
        <div className="flex justify-between">
          <Bone className="h-3 w-6" />
          <Bone className="h-3 w-20" />
          <Bone className="h-3 w-8" />
        </div>
      </div>
      <div className="grid gap-3 md:gap-4 md:grid-cols-2">
        <div className="card p-4 md:p-6 space-y-4">
          <Bone className="h-3 w-36" />
          <div className="flex items-center justify-center">
            <Bone className="h-[180px] w-[180px] rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => <Bone key={i} className="h-3 w-16" />)}
          </div>
        </div>
        <div className="card p-4 md:p-6 space-y-4">
          <Bone className="h-3 w-28" />
          <div className="flex flex-col justify-between gap-2 h-[180px] px-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Bone key={i} className="h-6 rounded-md"
                style={{ width: `${40 + Math.sin(i * 1.2) * 30 + 30}%`, animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        </div>
      </div>
      <div className="card p-4 md:p-6 space-y-4">
        <Bone className="h-3 w-28" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Bone className="h-7 w-1 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Bone className="h-3.5" style={{ width: `${60 + (i % 3) * 15}%`, animationDelay: `${i * 60}ms` }} />
                <Bone className="h-3 w-20" style={{ animationDelay: `${i * 60 + 30}ms` }} />
              </div>
              <div className="text-right space-y-1.5 shrink-0">
                <Bone className="h-3.5 w-16" style={{ animationDelay: `${i * 60}ms` }} />
                <Bone className="h-3 w-8 ml-auto" style={{ animationDelay: `${i * 60 + 30}ms` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-4 md:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Bone className="h-4 w-4 rounded-full" />
          <Bone className="h-3 w-24" />
        </div>
        <div className="space-y-2">
          {['w-full','w-full','w-4/5','w-full','w-3/5'].map((w, i) => (
            <Bone key={i} className={`h-3 ${w}`} />
          ))}
        </div>
      </div>
    </>
  )
}

// ── BudgetBar: anima de 0% → valor real ao montar ─────────────────────────────
function BudgetBar({ spent }: { spent: number }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.min(spent, 100)), 120)
    return () => clearTimeout(t)
  }, [spent])

  return (
    <div className="card p-4 md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="label text-[10px] md:text-xs">Comprometimento da renda</span>
        <span className={`font-display text-xl md:text-2xl ${pctColor(spent)}`}>{spent}%</span>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]">
        <div
          className={`h-full rounded-full ${barColor(spent)}`}
          style={{
            width: `${width}%`,
            transition: 'width 900ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      </div>

      <div className="mt-2 flex justify-between text-xs text-[var(--text-muted)]">
        <span>0%</span>
        <span className="text-success">Ideal ≤ 70%</span>
        <span>100%</span>
      </div>

      <div className="relative h-1.5 mt-0.5">
        <div
          className="absolute -top-3.5 h-4 w-px bg-success/30"
          style={{ left: '70%' }}
          title="Limite ideal 70%"
        />
      </div>
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent = false }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent?: boolean
}) {
  return (
    <div className={`card flex flex-col gap-2 p-4 md:p-6 ${accent ? 'border-amber-500/40 bg-amber-500/5' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="label text-[10px] md:text-xs">{label}</span>
        <div className={`flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-lg
          ${accent ? 'bg-amber-500/20 text-amber-500' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>
          <Icon size={14} />
        </div>
      </div>
      <div>
        <p className="font-display text-xl md:text-2xl leading-none">{value}</p>
        {sub && <p className="mt-1 text-[10px] md:text-xs text-[var(--text-muted)]">{sub}</p>}
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm shadow-lg">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-[var(--text-muted)]">{fmt(payload[0].value)}</p>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try { setSummary(await summaryApi.get()) }
    catch (e: any) { setError(e.message ?? 'Erro ao carregar dados') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="space-y-4 md:space-y-8"><DashboardSkeleton /></div>

  if (error || !summary) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center px-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/10 text-warning">
          <AlertTriangle size={28} />
        </div>
        <div>
          <p className="font-display text-xl">Nenhum dado encontrado</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{error ?? 'Cadastre um salário para começar.'}</p>
        </div>
        <button onClick={load} className="btn-primary"><RefreshCw size={15} /> Tentar novamente</button>
      </div>
    )
  }

  const categoryMap: Record<string, number> = {}
  for (const exp of summary.expenses) {
    categoryMap[exp.category] = (categoryMap[exp.category] ?? 0) + exp.amount
  }
  const pieData = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const barData = summary.expenses
    .slice(0, 6)
    .map(e => ({ name: e.description, valor: e.amount }))

  // Calcula a largura do eixo Y com base no nome mais longo (aprox. 7px por caractere)
  const yAxisWidth = Math.min(
    Math.max(...barData.map(d => d.name.length)) * 7 + 8,
    180
  )

  const topExpenses = [...summary.expenses]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  return (
    <div className="space-y-4 md:space-y-8">

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl">Visão Geral</h1>
          <p className="mt-1 text-xs md:text-sm text-[var(--text-muted)]">Resumo financeiro do mês atual</p>
        </div>
        <button onClick={load} className="btn-ghost p-2.5" aria-label="Atualizar"><RefreshCw size={16} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard label="Salário"        value={fmt(summary.salary)}             icon={Wallet}       accent />
        <StatCard label="Total Gastos"   value={fmt(summary.total_expenses)}     sub={`${summary.percent_spent}% da renda`}  icon={TrendingDown} />
        <StatCard label="Saldo Restante" value={fmt(summary.remaining)}          sub={`${summary.percent_remaining}% livre`} icon={TrendingUp}   />
        <StatCard label="Nº de Gastos"   value={String(summary.expenses.length)} sub="registros"                             icon={ArrowUpRight} />
      </div>

      <BudgetBar spent={summary.percent_spent} />

      {summary.expenses.length > 0 && (
        <div className="grid gap-3 md:gap-4 md:grid-cols-2">

          {/* ── Gráfico de pizza por categoria ── */}
          <div className="card p-4 md:p-6">
            <p className="label mb-4 text-[10px] md:text-xs">Gastos por categoria</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="truncate max-w-[80px]">{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Gráfico de barras horizontal — nomes completos no eixo Y ── */}
          <div className="card p-4 md:p-6">
            <p className="label mb-4 text-[10px] md:text-xs">Maiores gastos</p>
            <ResponsiveContainer
              width="100%"
              height={Math.max(barData.length * 36 + 16, 180)}
            >
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `R$${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={yAxisWidth}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => [fmt(v), 'Valor']}
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.75rem',
                    fontSize: '0.7rem',
                  }}
                />
                <Bar dataKey="valor" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}

      {topExpenses.length > 0 && (
        <div className="card p-4 md:p-6">
          <p className="label mb-3 md:mb-4 text-[10px] md:text-xs">Top 5 maiores gastos</p>
          <div className="space-y-3">
            {topExpenses.map(exp => (
              <div key={exp.id} className="flex items-center gap-3">
                <div
                  className="h-7 w-1 flex-shrink-0 rounded-full"
                  style={{ background: URGENCY_COLOR[exp.urgency] ?? '#9ca3af' }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs md:text-sm font-medium">{exp.description}</p>
                  <p className="text-[10px] md:text-xs text-[var(--text-muted)]">{exp.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs md:text-sm font-semibold">{fmt(exp.amount)}</p>
                  <p className="text-[10px] md:text-xs text-[var(--text-muted)]">{exp.impact_percent}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.suggestion && (
        <div className="card border-amber-500/30 bg-amber-500/5 p-4 md:p-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={15} className="text-amber-500 shrink-0" />
            <span className="label text-[10px] md:text-xs text-amber-500">Sugestão da IA</span>
          </div>
          <p className="text-xs md:text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-line">
            {summary.suggestion}
          </p>
        </div>
      )}

    </div>
  )
}