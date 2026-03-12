import type {
  Expense, ExpenseCreate, ExpenseUpdate,
  Salary, SalaryCreate,
  FinancialSummary,
  PurchaseRequest, PurchaseResponse,
  ChatRequest, ChatResponse,
} from '../types'

const BASE_URL = 'http://localhost:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Erro desconhecido' }))
    throw new Error(error.detail ?? `HTTP ${res.status}`)
  }

  // 204 No Content — sem body
  if (res.status === 204) return undefined as T

  return res.json()
}

// ── Expenses ──────────────────────────────────────────────────────────────────
export const expensesApi = {
  list:      ()                              => request<Expense[]>('/expenses/'),
  get:       (id: number)                    => request<Expense>(`/expenses/${id}`),
  create:    (data: ExpenseCreate)           => request<Expense>('/expenses/', { method: 'POST', body: JSON.stringify(data) }),
  update:    (id: number, data: ExpenseUpdate) => request<Expense>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:    (id: number)                    => request<void>(`/expenses/${id}`, { method: 'DELETE' }),
  deleteAll: ()                              => request<void>('/expenses/', { method: 'DELETE' }),
}

// ── Salary ────────────────────────────────────────────────────────────────────
export const salaryApi = {
  getCurrent: ()                  => request<Salary>('/salary/current'),
  getHistory: ()                  => request<Salary[]>('/salary/history'),
  create:     (data: SalaryCreate) => request<Salary>('/salary/', { method: 'POST', body: JSON.stringify(data) }),
}

// ── Summary ───────────────────────────────────────────────────────────────────
export const summaryApi = {
  get: () => request<FinancialSummary>('/summary/'),
}

// ── Purchase ──────────────────────────────────────────────────────────────────
export const purchaseApi = {
  check: (data: PurchaseRequest) => request<PurchaseResponse>('/can-i-buy/', { method: 'POST', body: JSON.stringify(data) }),
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export const chatApi = {
  send:          (data: ChatRequest) => request<ChatResponse>('/chat/', { method: 'POST', body: JSON.stringify(data) }),
  clearHistory:  (sessionId: string) => request<void>(`/chat/history/${sessionId}`, { method: 'DELETE' }),
}