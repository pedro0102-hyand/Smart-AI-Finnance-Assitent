import { useEffect, useState } from 'react'
import {
  Wallet, Plus, RefreshCw, TrendingUp, TrendingDown,
  Clock, CheckCircle2, AlertTriangle, X,
} from 'lucide-react'
import { salaryApi } from '../services/api'
import { useToast } from '../context/ToastContext'
import type { Salary } from '../types'

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

function variationPct(current: number, previous: number) {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

// ── modal novo salário ────────────────────────────────────────────────────────
function SalaryModal({
  onSave,
  onClose,
  loading,
}: {
  onSave: (amount: number) => void
  onClose: () => void
  loading: boolean
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function handleSubmit() {
    const n = Number(value.replace(',', '.'))
    if (!value || isNaN(n) || n <= 0) {
      setError('Informe um valor válido maior que zero.')
      return
    }
    onSave(n)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl animate-slide-up">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl">Atualizar salário</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        <p className="mb-4 text-sm text-[var(--text-muted)]">
          O salário anterior será marcado como inativo e o novo passará a ser
          usado em todos os cálculos.
        </p>

        <div>
          <label className="label">Novo salário (R$)</label>
          <input
            className="input text-lg"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0,00"
            value={value}
            onChange={e => { setValue(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary flex-1 justify-center"
          >
            {loading
              ? <RefreshCw size={15} className="animate-spin" />
              : <CheckCircle2 size={15} />
            }
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function Salary() {
  const toast = useToast()

  const [current, setCurrent]     = useState<Salary | null>(null)
  const [history, setHistory]     = useState<Salary[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  async function load() {
    setLoading(true); setError(null)
    try {
      const [cur, hist] = await Promise.allSettled([
        salaryApi.getCurrent(),
        salaryApi.getHistory(),
      ])
      if (cur.status === 'fulfilled') setCurrent(cur.value)
      else setCurrent(null)
      if (hist.status === 'fulfilled') setHistory(hist.value)
      else setHistory([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSave(amount: number) {
    setSaving(true)
    try {
      const created = await salaryApi.create({ amount })
      setCurrent(created)
      setHistory(prev => [created, ...prev.map(s => ({ ...s, is_current: false }))])
      setShowModal(false)
      toast.success(`Salário de ${fmt(amount)} cadastrado com sucesso!`)
    } catch (e: any) {
      setError(e.message)
      toast.error('Erro ao salvar salário. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const previous = history.find(s => !s.is_current)
  const variation = current && previous
    ? variationPct(current.amount, previous.amount)
    : null

  return (
    <div className="animate-slide-up space-y-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl">Salário</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Gerencie sua renda mensal
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={15} /> {current ? 'Atualizar' : 'Cadastrar'}
        </button>
      </div>

      {/* ── Error banner ────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex h-48 items-center justify-center gap-2 text-[var(--text-muted)]">
          <RefreshCw size={18} className="animate-spin" /> Carregando…
        </div>
      )}

      {/* ── Sem salário cadastrado ───────────────────────────────────── */}
      {!loading && !current && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <Wallet size={28} />
          </div>
          <div>
            <p className="font-display text-xl">Nenhum salário cadastrado</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Cadastre seu salário para começar a usar o assistente financeiro
            </p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={15} /> Cadastrar salário
          </button>
        </div>
      )}

      {/* ── Salário atual ────────────────────────────────────────────── */}
      {!loading && current && (
        <div className="card border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/20 text-amber-500">
                  <CheckCircle2 size={14} />
                </div>
                <span className="label text-amber-500/80">Salário atual</span>
              </div>
              <p className="font-display text-4xl mt-2">{fmt(current.amount)}</p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Cadastrado em {fmtDate(current.created_at)}
              </p>
            </div>

            {variation !== null && (
              <div className={`flex flex-col items-end gap-1 shrink-0 ${variation >= 0 ? 'text-success' : 'text-danger'}`}>
                <div className="flex items-center gap-1">
                  {variation >= 0
                    ? <TrendingUp size={18} />
                    : <TrendingDown size={18} />
                  }
                  <span className="font-display text-xl">
                    {variation >= 0 ? '+' : ''}{variation.toFixed(1)}%
                  </span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">vs anterior</span>
              </div>
            )}
          </div>

          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-xs text-[var(--text-muted)]">
              <span>R$ 0</span>
              <span>R$ 10.000</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-700"
                style={{ width: `${Math.min((current.amount / 10000) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Histórico ────────────────────────────────────────────────── */}
      {!loading && history.length > 1 && (
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Clock size={16} className="text-[var(--text-muted)]" />
            <p className="label">Histórico de salários</p>
          </div>

          <div className="space-y-0 divide-y divide-[var(--border)]">
            {history.map((s, i) => {
              const prev = history[i + 1]
              const vari = prev ? variationPct(s.amount, prev.amount) : null

              return (
                <div key={s.id} className="flex items-center gap-4 py-3.5">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                    ${s.is_current
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                    }`}>
                    <Wallet size={15} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${s.is_current ? 'text-amber-500' : ''}`}>
                      {fmt(s.amount)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{fmtDate(s.created_at)}</p>
                  </div>

                  {vari !== null && (
                    <div className={`flex items-center gap-1 text-xs font-medium
                      ${vari >= 0 ? 'text-success' : 'text-danger'}`}>
                      {vari >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {vari >= 0 ? '+' : ''}{vari.toFixed(1)}%
                    </div>
                  )}

                  {s.is_current && (
                    <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500">
                      Atual
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Modal ────────────────────────────────────────────────────── */}
      {showModal && (
        <SalaryModal
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          loading={saving}
        />
      )}
    </div>
  )
}