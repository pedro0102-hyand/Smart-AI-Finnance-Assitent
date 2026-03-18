import type {
  Expense, ExpenseCreate, ExpenseUpdate,
  Salary, SalaryCreate,
  FinancialSummary,
  PurchaseRequest, PurchaseResponse,
  ChatRequest, ChatResponse,
} from '../types'

const BASE_URL = 'http://localhost:8000'

// ── Classes de erro personalizadas ────────────────────────────────────────────

export class NetworkError extends Error {
  constructor() {
    super('Não foi possível conectar ao servidor. Verifique se o backend está rodando.')
    this.name = 'NetworkError'
  }
}

export class ServerError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ServerError'
  }
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── request base ──────────────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response

  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    // fetch lança TypeError quando não consegue conectar
    throw new NetworkError()
  }

  // 204 No Content — sem body
  if (res.status === 204) return undefined as T

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: `Erro HTTP ${res.status}` }))
    const message = body.detail ?? `Erro HTTP ${res.status}`

    if (res.status >= 500) throw new ServerError(res.status, `Erro interno do servidor: ${message}`)
    throw new ApiError(message)
  }

  return res.json()
}

// ── helper: transforma qualquer erro em mensagem amigável ─────────────────────

export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) return error.message
  if (error instanceof ServerError)  return `Erro no servidor (${error.status}). Tente novamente em instantes.`
  if (error instanceof ApiError)     return error.message
  if (error instanceof Error)        return error.message
  return 'Ocorreu um erro inesperado. Tente novamente.'
}

// ── Expenses ──────────────────────────────────────────────────────────────────
export const expensesApi = {
  list:      ()                               => request<Expense[]>('/expenses/'),
  get:       (id: number)                     => request<Expense>(`/expenses/${id}`),
  create:    (data: ExpenseCreate)            => request<Expense>('/expenses/', { method: 'POST', body: JSON.stringify(data) }),
  update:    (id: number, data: ExpenseUpdate) => request<Expense>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:    (id: number)                     => request<void>(`/expenses/${id}`, { method: 'DELETE' }),
  deleteAll: ()                               => request<void>('/expenses/', { method: 'DELETE' }),
}

// ── Salary ────────────────────────────────────────────────────────────────────
export const salaryApi = {
  getCurrent: ()                   => request<Salary>('/salary/current'),
  getHistory: ()                   => request<Salary[]>('/salary/history'),
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
  send:         (data: ChatRequest) => request<ChatResponse>('/chat/', { method: 'POST', body: JSON.stringify(data) }),
  clearHistory: (sessionId: string) => request<void>(`/chat/history/${sessionId}`, { method: 'DELETE' }),
}