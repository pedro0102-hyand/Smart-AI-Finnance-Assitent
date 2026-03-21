import { useState, useEffect } from 'react'
import {
  ShoppingCart, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, X, TrendingUp, CreditCard, Percent, Sparkles,
  Zap, BrainCircuit,
} from 'lucide-react'
import { purchaseApi, salaryApi, summaryApi } from '../services/api'
import type { PurchaseResponse } from '../types'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function StatusIcon({ can }: { can: boolean }) {
  if (can) return <CheckCircle2 size={52} className="text-success" />
  return <XCircle size={52} className="text-danger" />
}

function MeterBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-[var(--text-muted)]">{label}</span>
        <span className="font-medium">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

function barColor(v: number) {
  if (v < 50) return 'bg-success'
  if (v < 75) return 'bg-warning'
  return 'bg-danger'
}

function impactLabel(pct: number): { text: string; color: string } {
  if (pct <= 5)  return { text: 'Impacto muito baixo',   color: 'text-success' }
  if (pct <= 15) return { text: 'Impacto moderado',      color: 'text-warning' }
  if (pct <= 30) return { text: 'Impacto significativo', color: 'text-warning' }
  return              { text: 'Impacto alto na renda',   color: 'text-danger'  }
}

// ── Preview em tempo real ─────────────────────────────────────────────────────
interface LivePreviewProps {
  amount: number
  salary: number
  totalExpenses: number
}

function LivePreview({ amount, salary, totalExpenses }: LivePreviewProps) {
  if (!salary || !amount || amount <= 0) return null

  const impactPct            = (amount / salary) * 100
  const newTotalPct          = ((totalExpenses + amount) / salary) * 100
  const { text, color }      = impactLabel(impactPct)

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 space-y-3 animate-slide-up">
      <div className="flex items-center gap-2">
        <Zap size={13} className="text-amber-500 shrink-0" />
        <p className="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">
          Prévia do impacto
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--text-muted)]">Representa</span>
        <div className="text-right">
          <span className={`font-display text-xl ${color}`}>{impactPct.toFixed(1)}%</span>
          <span className="text-xs text-[var(--text-muted)] ml-1">da renda</span>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-card)]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(impactPct)}`}
          style={{ width: `${Math.min(impactPct, 100)}%` }}
        />
      </div>

      <div className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
        {impactPct <= 15 ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
        {text}
      </div>

      <div className="pt-1 border-t border-[var(--border)]">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Comprometimento após compra</span>
          <span className={`font-semibold ${barColor(newTotalPct).replace('bg-', 'text-')}`}>
            {newTotalPct.toFixed(1)}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-card)]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor(newTotalPct)}`}
            style={{ width: `${Math.min(newTotalPct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Bloco de análise da IA ────────────────────────────────────────────────────
function AiAnalysisBlock({ text, loading }: { text?: string | null; loading?: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2 animate-pulse">
        <div className="flex items-center gap-2">
          <BrainCircuit size={14} className="text-amber-500 shrink-0" />
          <span className="text-xs font-medium uppercase tracking-widest text-amber-500">
            Análise da IA
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="h-3 rounded bg-amber-500/10 w-full" />
          <div className="h-3 rounded bg-amber-500/10 w-4/5" />
          <div className="h-3 rounded bg-amber-500/10 w-3/5" />
        </div>
      </div>
    )
  }

  if (!text) return null

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2 animate-slide-up">
      <div className="flex items-center gap-2">
        <BrainCircuit size={14} className="text-amber-500 shrink-0" />
        <span className="text-xs font-medium uppercase tracking-widest text-amber-500">
          Análise da IA
        </span>
      </div>
      <p className="text-sm leading-relaxed text-[var(--text-primary)]">{text}</p>
    </div>
  )
}

// ── ResultCard ────────────────────────────────────────────────────────────────
function ResultCard({ result }: { result: PurchaseResponse }) {
  const {
    can_buy, recommendation, current_percent_spent, new_percent_spent,
    impact_percent, suggested_installments, installment_value, ai_analysis,
  } = result

  return (
    <div className={`card animate-slide-up border-2 ${can_buy ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5'}`}>

      {/* ── Status ── */}
      <div className="flex flex-col items-center gap-3 pb-6 text-center border-b border-[var(--border)]">
        <StatusIcon can={can_buy} />
        <div>
          <p className="font-display text-2xl">{can_buy ? 'Pode comprar!' : 'Não recomendado'}</p>
          <p className="mt-1.5 text-sm text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed">
            {recommendation}
          </p>
        </div>
      </div>

      {/* ── Barras de comprometimento ── */}
      <div className="py-6 space-y-4 border-b border-[var(--border)]">
        <MeterBar
          label="Comprometimento atual"
          value={current_percent_spent}
          color={barColor(current_percent_spent)}
        />
        <MeterBar
          label="Comprometimento após compra"
          value={new_percent_spent}
          color={barColor(new_percent_spent)}
        />
      </div>

      {/* ── Métricas ── */}
      <div className="pt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Percent,      label: 'Impacto na renda',   value: `${impact_percent.toFixed(1)}%` },
          { icon: TrendingUp,   label: 'Após a compra',      value: `${new_percent_spent.toFixed(1)}%` },
          { icon: CreditCard,   label: 'Parcelas sugeridas', value: `${suggested_installments}x` },
          { icon: ShoppingCart, label: 'Por parcela',        value: fmt(installment_value) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl bg-[var(--bg-secondary)] p-4 text-center">
            <Icon size={16} className="mx-auto mb-1.5 text-[var(--text-muted)]" />
            <p className="font-display text-lg">{value}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
          </div>
        ))}
      </div>

      {/* ── À vista ── */}
      {suggested_installments === 1 && can_buy && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 size={15} />
          Você pode pagar à vista sem comprometer o orçamento.
        </div>
      )}

      {/* ── Análise da IA ── */}
      {ai_analysis && (
        <div className="mt-4">
          <AiAnalysisBlock text={ai_analysis} />
        </div>
      )}
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function Purchase() {
  const [description, setDescription] = useState('')
  const [amount, setAmount]           = useState('')
  const [result, setResult]           = useState<PurchaseResponse | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [errors, setErrors]           = useState<{ description?: string; amount?: string }>({})

  const [salary, setSalary]               = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)

  useEffect(() => {
    Promise.allSettled([
      salaryApi.getCurrent(),
      summaryApi.get(),
    ]).then(([salRes, sumRes]) => {
      if (salRes.status === 'fulfilled') setSalary(salRes.value.amount)
      if (sumRes.status === 'fulfilled') setTotalExpenses(sumRes.value.total_expenses)
    })
  }, [])

  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0

  function validate() {
    const e: typeof errors = {}
    if (!description.trim()) e.description = 'Descreva o que quer comprar'
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) e.amount = 'Informe um valor válido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleCheck() {
    if (!validate()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await purchaseApi.check({ description: description.trim(), amount: parsedAmount })
      setResult(res)
    } catch (e: any) {
      setError(e.message ?? 'Erro ao consultar')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setResult(null); setDescription(''); setAmount(''); setError(null); setErrors({})
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">

      <div>
        <h1 className="font-display text-3xl">Posso comprar?</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Analise se uma compra cabe no seu orçamento
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* ── Formulário ── */}
      {!result && (
        <div className="card space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Sparkles size={15} />
            </div>
            <p className="text-sm font-medium">Análise inteligente de compra</p>
          </div>

          <div>
            <label className="label">O que quer comprar?</label>
            <input
              className="input"
              placeholder="Ex: iPhone 15, Notebook, Tênis Nike…"
              value={description}
              onChange={e => { setDescription(e.target.value); setErrors(v => ({ ...v, description: undefined })) }}
              onKeyDown={e => e.key === 'Enter' && handleCheck()}
            />
            {errors.description && <p className="mt-1 text-xs text-danger">{errors.description}</p>}
          </div>

          <div>
            <label className="label">Valor total (R$)</label>
            <input
              className="input text-lg"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={amount}
              onChange={e => { setAmount(e.target.value); setErrors(v => ({ ...v, amount: undefined })) }}
              onKeyDown={e => e.key === 'Enter' && handleCheck()}
            />
            {errors.amount && <p className="mt-1 text-xs text-danger">{errors.amount}</p>}
          </div>

          {parsedAmount > 0 && salary > 0 && (
            <LivePreview
              amount={parsedAmount}
              salary={salary}
              totalExpenses={totalExpenses}
            />
          )}

          <button
            onClick={handleCheck}
            disabled={loading}
            className="btn-primary w-full justify-center py-3 text-base"
          >
            {loading
              ? <><RefreshCw size={16} className="animate-spin" /> Analisando com IA…</>
              : <><BrainCircuit size={16} /> Analisar compra</>
            }
          </button>
        </div>
      )}

      {/* ── Resultado ── */}
      {result && (
        <>
          <ResultCard result={result} />
          <button onClick={handleReset} className="btn-ghost w-full justify-center">
            <RefreshCw size={15} /> Nova análise
          </button>
        </>
      )}

      {/* ── Como funciona ── */}
      {!result && !loading && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)] mb-2">
            Como funciona
          </p>
          <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
            {[
              { color: 'bg-amber-500', text: 'Compra segura se o total ficar abaixo de 70% da renda' },
              { color: 'bg-warning',   text: 'Possível com cautela entre 70% e 85%' },
              { color: 'bg-danger',    text: 'Não recomendado acima de 85%' },
              { color: 'bg-[var(--text-muted)]', text: 'A IA analisa seus gastos cortáveis e dá um conselho personalizado' },
            ].map(({ color, text }) => (
              <li key={text} className="flex items-start gap-2">
                <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
                {text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}