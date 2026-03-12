import { useEffect, useState } from 'react'
import {
  Plus, Trash2, Pencil, RefreshCw, X, Check,
  AlertTriangle, Search, Filter,
} from 'lucide-react'
import { expensesApi } from '../services/api'
import type { Expense, ExpenseCreate, ExpenseUpdate } from '../types'

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const URGENCY_COLOR: Record<string, string> = {
  'Alta urgência':  'badge-high',
  'Média urgência': 'badge-medium',
  'Baixa urgência': 'badge-low',
}

const URGENCY_DOT: Record<string, string> = {
  'Alta urgência':  'bg-danger',
  'Média urgência': 'bg-warning',
  'Baixa urgência': 'bg-success',
}

const CATEGORIES = [
  'Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação',
  'Lazer', 'Roupas', 'Academia', 'Streaming', 'Internet',
  'Telefone', 'Seguro', 'Investimento', 'Outros',
]

// ── form modal ────────────────────────────────────────────────────────────────
interface FormData { description: string; amount: string; category: string }
const EMPTY: FormData = { description: '', amount: '', category: '' }

function ExpenseModal({
  initial,
  onSave,
  onClose,
  loading,
}: {
  initial?: Expense | null
  onSave: (data: FormData) => void
  onClose: () => void
  loading: boolean
}) {
  const [form, setForm] = useState<FormData>(
    initial
      ? { description: initial.description, amount: String(initial.amount), category: initial.category }
      : EMPTY
  )
  const [errors, setErrors] = useState<Partial<FormData>>({})

  function validate() {
    const e: Partial<FormData> = {}
    if (!form.description.trim()) e.description = 'Descrição obrigatória'
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      e.amount = 'Valor inválido'
    if (!form.category.trim()) e.category = 'Categoria obrigatória'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (validate()) onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl animate-slide-up">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl">
            {initial ? 'Editar gasto' : 'Novo gasto'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Descrição */}
          <div>
            <label className="label">Descrição</label>
            <input
              className="input"
              placeholder="Ex: Mercado, Conta de luz…"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-danger">{errors.description}</p>
            )}
          </div>

          {/* Valor */}
          <div>
            <label className="label">Valor (R$)</label>
            <input
              className="input"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            />
            {errors.amount && (
              <p className="mt-1 text-xs text-danger">{errors.amount}</p>
            )}
          </div>

          {/* Categoria */}
          <div>
            <label className="label">Categoria</label>
            <select
              className="input"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            >
              <option value="">Selecione…</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__custom">Outra (digitar)</option>
            </select>
            {form.category === '__custom' && (
              <input
                className="input mt-2"
                placeholder="Digite a categoria"
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              />
            )}
            {errors.category && (
              <p className="mt-1 text-xs text-danger">{errors.category}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary flex-1 justify-center"
          >
            {loading
              ? <RefreshCw size={15} className="animate-spin" />
              : <Check size={15} />
            }
            {initial ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── confirm delete ────────────────────────────────────────────────────────────
function ConfirmModal({
  message,
  onConfirm,
  onClose,
  loading,
}: {
  message: string
  onConfirm: () => void
  onClose: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl animate-slide-up">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          <AlertTriangle size={22} />
        </div>
        <p className="font-display text-lg">Confirmar exclusão</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{message}</p>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="btn-danger flex-1 justify-center"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function Expenses() {
  const [expenses, setExpenses]     = useState<Expense[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const [showAdd, setShowAdd]       = useState(false)
  const [editing, setEditing]       = useState<Expense | null>(null)
  const [deleting, setDeleting]     = useState<Expense | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)

  const [search, setSearch]         = useState('')
  const [filterUrgency, setFilterUrgency] = useState<string>('all')

  async function load() {
    setLoading(true); setError(null)
    try { setExpenses(await expensesApi.list()) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleAdd(form: FormData) {
    setSaving(true)
    try {
      const data: ExpenseCreate = {
        description: form.description,
        amount: Number(form.amount),
        category: form.category,
      }
      const created = await expensesApi.create(data)
      setExpenses(prev => [created, ...prev])
      setShowAdd(false)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleEdit(form: FormData) {
    if (!editing) return
    setSaving(true)
    try {
      const data: ExpenseUpdate = {
        description: form.description,
        amount: Number(form.amount),
        category: form.category,
      }
      const updated = await expensesApi.update(editing.id, data)
      setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e))
      setEditing(null)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleting) return
    setSaving(true)
    try {
      await expensesApi.delete(deleting.id)
      setExpenses(prev => prev.filter(e => e.id !== deleting.id))
      setDeleting(null)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleDeleteAll() {
    setSaving(true)
    try {
      await expensesApi.deleteAll()
      setExpenses([])
      setDeletingAll(false)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  // ── filter ──────────────────────────────────────────────────────────────
  const filtered = expenses.filter(e => {
    const matchSearch =
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase())
    const matchUrgency =
      filterUrgency === 'all' || e.urgency === filterUrgency
    return matchSearch && matchUrgency
  })

  const total = filtered.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="animate-slide-up space-y-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Gastos</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {expenses.length} registro{expenses.length !== 1 ? 's' : ''} no mês
          </p>
        </div>
        <div className="flex gap-2">
          {expenses.length > 0 && (
            <button onClick={() => setDeletingAll(true)} className="btn-danger">
              <Trash2 size={15} /> Zerar mês
            </button>
          )}
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={15} /> Novo gasto
          </button>
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* ── Search + filter ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="input pl-9"
            placeholder="Buscar por descrição ou categoria…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <select
            className="input pl-9 pr-8 appearance-none"
            value={filterUrgency}
            onChange={e => setFilterUrgency(e.target.value)}
          >
            <option value="all">Todas urgências</option>
            <option value="Alta urgência">Alta urgência</option>
            <option value="Média urgência">Média urgência</option>
            <option value="Baixa urgência">Baixa urgência</option>
          </select>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex h-48 items-center justify-center gap-2 text-[var(--text-muted)]">
          <RefreshCw size={18} className="animate-spin" /> Carregando…
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {!loading && expenses.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-secondary)] text-[var(--text-muted)]">
            <Plus size={28} />
          </div>
          <div>
            <p className="font-display text-xl">Nenhum gasto ainda</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Adicione seu primeiro gasto do mês</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={15} /> Adicionar gasto
          </button>
        </div>
      )}

      {/* ── List ────────────────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <>
          <div className="card p-0 overflow-hidden">
            <div className="divide-y divide-[var(--border)]">
              {filtered.map(exp => (
                <div
                  key={exp.id}
                  className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  {/* dot */}
                  <div className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${URGENCY_DOT[exp.urgency] ?? 'bg-[var(--text-muted)]'}`} />

                  {/* info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{exp.description}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-xs text-[var(--text-muted)]">{exp.category}</span>
                      <span className={`text-[10px] ${URGENCY_COLOR[exp.urgency] ?? ''}`}>
                        {exp.urgency}
                      </span>
                    </div>
                  </div>

                  {/* amount */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{fmt(exp.amount)}</p>
                    <p className="text-xs text-[var(--text-muted)]">{exp.impact_percent}% da renda</p>
                  </div>

                  {/* actions */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setEditing(exp)}
                      className="btn-ghost p-1.5 text-[var(--text-muted)]"
                      aria-label="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleting(exp)}
                      className="btn-ghost p-1.5 text-danger/70 hover:text-danger"
                      aria-label="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* total da busca */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-3">
            <span className="text-sm text-[var(--text-muted)]">
              {filtered.length} gasto{filtered.length !== 1 ? 's' : ''} filtrados
            </span>
            <span className="font-display text-lg">{fmt(total)}</span>
          </div>
        </>
      )}

      {/* ── No results from search ──────────────────────────────────── */}
      {!loading && expenses.length > 0 && filtered.length === 0 && (
        <div className="py-12 text-center text-[var(--text-muted)]">
          <p>Nenhum resultado para "<strong>{search}</strong>"</p>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {showAdd && (
        <ExpenseModal
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
          loading={saving}
        />
      )}
      {editing && (
        <ExpenseModal
          initial={editing}
          onSave={handleEdit}
          onClose={() => setEditing(null)}
          loading={saving}
        />
      )}
      {deleting && (
        <ConfirmModal
          message={`Excluir "${deleting.description}" (${fmt(deleting.amount)})?`}
          onConfirm={handleDelete}
          onClose={() => setDeleting(null)}
          loading={saving}
        />
      )}
      {deletingAll && (
        <ConfirmModal
          message="Isso vai apagar todos os gastos do mês. Essa ação não pode ser desfeita."
          onConfirm={handleDeleteAll}
          onClose={() => setDeletingAll(false)}
          loading={saving}
        />
      )}
    </div>
  )
}
