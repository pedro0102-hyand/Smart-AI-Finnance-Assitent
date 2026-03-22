import type {
  Expense, ExpenseCreate, ExpenseUpdate,
  Salary, SalaryCreate,
  FinancialSummary,
  ForecastResponse,
  PurchaseRequest, PurchaseResponse,
  ChatRequest, ChatResponse,
} from '../types'

const BASE_URL = 'http://localhost:8000'

// ── Classes de erro ────────────────────────────────────────────────────────────
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

export class UnauthorizedError extends Error {
  constructor() {
    super('Sessão expirada. Faça login novamente.')
    this.name = 'UnauthorizedError'
  }
}

// ── Token getter (lê do localStorage em runtime) ──────────────────────────────
function getAccessToken(): string | null {
  return localStorage.getItem('sf_access_token')
}

// ── Request base ───────────────────────────────────────────────────────────────
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { headers, ...options })
  } catch {
    throw new NetworkError()
  }

  if (res.status === 204) return undefined as T

  if (res.status === 401) {
    // Dispara evento global para o AuthContext fazer logout
    window.dispatchEvent(new CustomEvent('sf:unauthorized'))
    throw new UnauthorizedError()
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: `Erro HTTP ${res.status}` }))
    const message = body.detail ?? `Erro HTTP ${res.status}`
    if (res.status >= 500) throw new ServerError(res.status, `Erro interno do servidor: ${message}`)
    throw new ApiError(message)
  }

  return res.json()
}

// ── Friendly error ─────────────────────────────────────────────────────────────
export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof NetworkError)     return error.message
  if (error instanceof UnauthorizedError) return error.message
  if (error instanceof ServerError)      return `Erro no servidor (${error.status}). Tente novamente em instantes.`
  if (error instanceof ApiError)         return error.message
  if (error instanceof Error)            return error.message
  return 'Ocorreu um erro inesperado. Tente novamente.'
}

// ── APIs ───────────────────────────────────────────────────────────────────────
export const expensesApi = {
  list:      ()                                => request<Expense[]>('/expenses/'),
  get:       (id: number)                      => request<Expense>(`/expenses/${id}`),
  create:    (data: ExpenseCreate)             => request<Expense>('/expenses/', { method: 'POST', body: JSON.stringify(data) }),
  update:    (id: number, data: ExpenseUpdate) => request<Expense>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:    (id: number)                      => request<void>(`/expenses/${id}`, { method: 'DELETE' }),
  deleteAll: ()                                => request<void>('/expenses/', { method: 'DELETE' }),
}

export const salaryApi = {
  getCurrent: ()                   => request<Salary>('/salary/current'),
  getHistory: ()                   => request<Salary[]>('/salary/history'),
  create:     (data: SalaryCreate) => request<Salary>('/salary/', { method: 'POST', body: JSON.stringify(data) }),
}

export const summaryApi = {
  get: () => request<FinancialSummary>('/summary/'),
}

export const forecastApi = {
  get: (threshold = 80) =>
    request<ForecastResponse>(`/summary/forecast/?threshold=${threshold}`),
}

export const purchaseApi = {
  check: (data: PurchaseRequest) =>
    request<PurchaseResponse>('/can-i-buy/', { method: 'POST', body: JSON.stringify(data) }),
}

export const chatApi = {
  send:         (data: ChatRequest) => request<ChatResponse>('/chat/', { method: 'POST', body: JSON.stringify(data) }),
  clearHistory: (sessionId: string) => request<void>(`/chat/history/${sessionId}`, { method: 'DELETE' }),
}