import { useState } from 'react'
import {
  ShoppingCart, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, X, TrendingUp, CreditCard, Percent, Sparkles,
} from 'lucide-react'
import { purchaseApi } from '../services/api'
import type { PurchaseResponse } from '../types'

// ── helpers ───────────────────────────────────────────────────────────────────
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

// ── result card ───────────────────────────────────────────────────────────────
function ResultCard({ result, amount }: { result: PurchaseResponse; amount: number }) {
  const { can_buy, recommendation, current_percent_spent, new_percent_spent,
          impact_percent, suggested_installments, installment_value } = result

  return (
    <div className={`card animate-slide-up border-2 ${
      can_buy ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5'
    }`}>

      {/* veredicto */}
      <div className="flex flex-col items-center gap-3 pb-6 text-center border-b border-[var(--border)]">
        <StatusIcon can={can_buy} />
        <div>
          <p className="font-display text-2xl">
            {can_buy ? 'Pode comprar!' : 'Não recomendado'}
          </p>
          <p className="mt-1.5 text-sm text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed">
            {recommendation}
          </p>
        </div>
      </div>

      {/* métricas */}
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

      {/* cards de info */}
      <div className="pt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-[var(--bg-secondary)] p-4 text-center">
          <Percent size={16} className="mx-auto mb-1.5 text-[var(--text-muted)]" />
          <p className="font-display text-lg">{impact_percent.toFixed(1)}%</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            Impacto na renda
          </p>
        </div>

        <div className="rounded-xl bg-[var(--bg-secondary)] p-4 text-center">
          <TrendingUp size={16} className="mx-auto mb-1.5 text-[var(--text-muted)]" />
          <p className="font-display text-lg">{new_percent_spent.toFixed(1)}%</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            Após a compra
          </p>
        </div>

        <div className="rounded-xl bg-[var(--bg-secondary)] p-4 text-center">
          <CreditCard size={16} className="mx-auto mb-1.5 text-[var(--text-muted)]" />
          <p className="font-display text-lg">{suggested_installments}x</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            Parcelas sugeridas
          </p>
        </div>

        <div className="rounded-xl bg-[var(--bg-secondary)] p-4 text-center">
          <ShoppingCart size={16} className="mx-auto mb-1.5 text-[var(--text-muted)]" />
          <p className="font-display text-base">{fmt(installment_value)}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            Por parcela
          </p>
        </div>
      </div>

      {/* aviso se parcelamento = 1x */}
      {suggested_installments === 1 && can_buy && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 size={15} />
          Você pode pagar à vista sem comprometer o orçamento.
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

  function validate() {
    const e: typeof errors = {}
    if (!description.trim()) e.description = 'Descreva o que quer comprar'
    const n = Number(amount.replace(',', '.'))
    if (!amount || isNaN(n) || n <= 0) e.amount = 'Informe um valor válido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleCheck() {
    if (!validate()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await purchaseApi.check({
        description: description.trim(),
        amount: Number(amount.replace(',', '.')),
      })
      setResult(res)
    } catch (e: any) {
      setError(e.message ?? 'Erro ao consultar')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setResult(null)
    setDescription('')
    setAmount('')
    setError(null)
    setErrors({})
  }

  return (
    <div className="animate-slide-up space-y-6 max-w-xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-display text-3xl">Posso comprar?</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Analise se uma compra cabe no seu orçamento
        </p>
      </div>

      {/* ── Error banner ────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* ── Formulário ──────────────────────────────────────────────── */}
      {!result && (
        <div className="card space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Sparkles size={15} />
            </div>
            <p className="text-sm font-medium">Análise inteligente de compra</p>
          </div>

          {/* O que quer comprar */}
          <div>
            <label className="label">O que quer comprar?</label>
            <input
              className="input"
              placeholder="Ex: iPhone 15, Notebook, Tênis Nike…"
              value={description}
              onChange={e => { setDescription(e.target.value); setErrors(v => ({ ...v, description: undefined })) }}
              onKeyDown={e => e.key === 'Enter' && handleCheck()}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-danger">{errors.description}</p>
            )}
          </div>

          {/* Valor */}
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
            {errors.amount && (
              <p className="mt-1 text-xs text-danger">{errors.amount}</p>
            )}
          </div>

          <button
            onClick={handleCheck}
            disabled={loading}
            className="btn-primary w-full justify-center py-3 text-base"
          >
            {loading
              ? <><RefreshCw size={16} className="animate-spin" /> Analisando…</>
              : <><ShoppingCart size={16} /> Analisar compra</>
            }
          </button>
        </div>
      )}

      {/* ── Resultado ───────────────────────────────────────────────── */}
      {result && (
        <>
          <ResultCard result={result} amount={Number(amount)} />
          <button onClick={handleReset} className="btn-ghost w-full justify-center">
            <RefreshCw size={15} /> Nova análise
          </button>
        </>
      )}

      {/* ── Dica de uso ─────────────────────────────────────────────── */}
      {!result && !loading && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)] mb-2">
            Como funciona
          </p>
          <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              Compra segura se o total ficar abaixo de 70% da renda
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
              Possível com cautela entre 70% e 85%
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
              Não recomendado acima de 85%
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-muted)]" />
              O sistema sugere o menor número de parcelas viável
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
