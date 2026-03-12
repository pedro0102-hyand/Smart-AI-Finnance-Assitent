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

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const URGENCY_COLOR: Record<string, string> = {
  'Alta urgência':   '#f87171',
  'Média urgência':  '#fbbf24',
  'Baixa urgência':  '#4ade80',
}

const CHART_COLORS = ['#f59e0b','#f87171','#4ade80','#60a5fa','#c084fc','#fb923c','#34d399']

function pct(v: number) {
  const clamped = Math.min(100, Math.max(0, v))
  if (clamped < 50) return 'text-success'
  if (clamped < 75) return 'text-warning'
  return 'text-danger'
}

function barColor(v: number) {
  if (v < 50) return 'bg-success'
  if (v < 75) return 'bg-warning'
  return 'bg-danger'
}

// ── sub-components ────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, accent = false,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; accent?: boolean
}) {
  return (
    <div className={`card flex flex-col gap-3 ${accent ? 'border-amber-500/40 bg-amber-500/5' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg
          ${accent ? 'bg-amber-500/20 text-amber-500' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>
          <Icon size={16} />
        </div>
      </div>
      <div>
        <p className="font-display text-2xl leading-none">{value}</p>
        {sub && <p className="mt-1 text-xs text-[var(--text-muted)]">{sub}</p>}
      </div>
    </div>
  )
}

// ── custom tooltip para o pie ─────────────────────────────────────────────────
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm shadow-lg">
      <p className="font-medium">{d.name}</p>
      <p className="text-[var(--text-muted)]">{fmt(d.value)}</p>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await summaryApi.get()
      setSummary(data)
    } catch (e: any) {
      setError(e.message ?? 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-[var(--text-muted)]">
        <RefreshCw size={20} className="animate-spin" />
        <span>Carregando dados financeiros…</span>
      </div>
    )
  }

  // ── error / sem salário ───────────────────────────────────────────────────
  if (error || !summary) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/10 text-warning">
          <AlertTriangle size={28} />
        </div>
        <div>
          <p className="font-display text-xl">Nenhum dado encontrado</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {error ?? 'Cadastre um salário para começar.'}
          </p>
        </div>
        <button onClick={load} className="btn-primary">
          <RefreshCw size={15} /> Tentar novamente
        </button>
      </div>
    )
  }

  // ── dados para gráficos ───────────────────────────────────────────────────
  const categoryMap: Record<string, number> = {}
  for (const exp of summary.expenses) {
    categoryMap[exp.category] = (categoryMap[exp.category] ?? 0) + exp.amount
  }
  const pieData = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const barData = summary.expenses
    .slice(0, 8)
    .map(e => ({ name: e.description.slice(0, 14), valor: e.amount }))

  const topExpenses = [...summary.expenses]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const spent = summary.percent_spent

  return (
    <div className="animate-slide-up space-y-8">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl">Visão Geral</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Resumo financeiro do mês atual
          </p>
        </div>
        <button onClick={load} className="btn-ghost p-2.5" aria-label="Atualizar">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Salário"
          value={fmt(summary.salary)}
          icon={Wallet}
          accent
        />
        <StatCard
          label="Total de Gastos"
          value={fmt(summary.total_expenses)}
          sub={`${summary.percent_spent}% da renda`}
          icon={TrendingDown}
        />
        <StatCard
          label="Saldo Restante"
          value={fmt(summary.remaining)}
          sub={`${summary.percent_remaining}% livre`}
          icon={TrendingUp}
        />
        <StatCard
          label="Nº de Gastos"
          value={String(summary.expenses.length)}
          sub="registros no mês"
          icon={ArrowUpRight}
        />
      </div>

      {/* ── Barra de orçamento ────────────────────────────────────────── */}
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <span className="label">Comprometimento da renda</span>
          <span className={`font-display text-2xl ${pct(spent)}`}>
            {spent}%
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor(spent)}`}
            style={{ width: `${Math.min(spent, 100)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-[var(--text-muted)]">
          <span>0%</span>
          <span className="text-success">Ideal ≤ 70%</span>
          <span>100%</span>
        </div>
      </div>

      {/* ── Gráficos ──────────────────────────────────────────────────── */}
      {summary.expenses.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Pie — categorias */}
          <div className="card">
            <p className="label mb-4">Gastos por categoria</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
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
            {/* legenda manual */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  {d.name}
                </div>
              ))}
            </div>
          </div>

          {/* Bar — maiores gastos */}
          <div className="card">
            <p className="label mb-4">Maiores gastos</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `R$${v}`}
                />
                <Tooltip
                  formatter={(v: number) => [fmt(v), 'Valor']}
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.75rem',
                    fontSize: '0.75rem',
                  }}
                />
                <Bar dataKey="valor" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Top 5 gastos ──────────────────────────────────────────────── */}
      {topExpenses.length > 0 && (
        <div className="card">
          <p className="label mb-4">Top 5 maiores gastos</p>
          <div className="space-y-3">
            {topExpenses.map(exp => (
              <div key={exp.id} className="flex items-center gap-3">
                {/* barra lateral de urgência */}
                <div
                  className="h-8 w-1 flex-shrink-0 rounded-full"
                  style={{ background: URGENCY_COLOR[exp.urgency] ?? '#9ca3af' }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{exp.description}</p>
                  <p className="text-xs text-[var(--text-muted)]">{exp.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{fmt(exp.amount)}</p>
                  <p className="text-xs text-[var(--text-muted)]">{exp.impact_percent}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sugestão da IA ────────────────────────────────────────────── */}
      {summary.suggestion && (
        <div className="card border-amber-500/30 bg-amber-500/5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" />
            <span className="label text-amber-500">Sugestão da IA</span>
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-line">
            {summary.suggestion}
          </p>
        </div>
      )}

    </div>
  )
}
