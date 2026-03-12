// ── Expense ───────────────────────────────────────────────────────────────────
export interface Expense {
  id: number
  description: string
  amount: number
  category: string
  urgency: 'Alta urgência' | 'Média urgência' | 'Baixa urgência'
  impact_percent: number
  created_at: string
}

export interface ExpenseCreate {
  description: string
  amount: number
  category: string
}

export interface ExpenseUpdate {
  description?: string
  amount?: number
  category?: string
}

// ── Salary ────────────────────────────────────────────────────────────────────
export interface Salary {
  id: number
  amount: number
  is_current: boolean
  created_at: string
}

export interface SalaryCreate {
  amount: number
}

// ── Summary ───────────────────────────────────────────────────────────────────
export interface FinancialSummary {
  salary: number
  total_expenses: number
  remaining: number
  percent_spent: number
  percent_remaining: number
  expenses: Expense[]
  suggestion: string
}

// ── Purchase ──────────────────────────────────────────────────────────────────
export interface PurchaseRequest {
  description: string
  amount: number
}

export interface PurchaseResponse {
  can_buy: boolean
  current_percent_spent: number
  new_percent_spent: number
  impact_percent: number
  suggested_installments: number
  installment_value: number
  recommendation: string
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface ChatRequest {
  message: string
  session_id: string
}

export interface ChatResponse {
  response: string
  session_id: string
}