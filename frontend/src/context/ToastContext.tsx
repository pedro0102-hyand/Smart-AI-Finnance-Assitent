import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'


// ── tipos ─────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  error:   (message: string) => void
  warning: (message: string) => void
  info:    (message: string) => void
}

// ── context ───────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue>({
  success: () => {},
  error:   () => {},
  warning: () => {},
  info:    () => {},
})

// ── config visual por tipo ────────────────────────────────────────────────────
const TOAST_CONFIG: Record<ToastType, {
  icon: React.ElementType
  containerClass: string
  iconClass: string
}> = {
  success: {
    icon: CheckCircle2,
    containerClass: 'border-success/30 bg-success/10 text-success',
    iconClass: 'text-success',
  },
  error: {
    icon: XCircle,
    containerClass: 'border-danger/30 bg-danger/10 text-danger',
    iconClass: 'text-danger',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'border-warning/30 bg-warning/10 text-warning',
    iconClass: 'text-warning',
  },
  info: {
    icon: Info,
    containerClass: 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]',
    iconClass: 'text-[var(--text-muted)]',
  },
}

// ── componente individual de toast ────────────────────────────────────────────
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: string) => void
}) {
  const { icon: Icon, containerClass, iconClass } = TOAST_CONFIG[toast.type]

  return (
    <div
      className={`
        flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg
        text-sm font-medium min-w-[260px] max-w-[360px]
        animate-slide-up
        ${containerClass}
      `}
      style={{
        backdropFilter: 'blur(12px)',
      }}
    >
      <Icon size={16} className={`shrink-0 ${iconClass}`} />
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-1"
        aria-label="Fechar"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ── provider ──────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    setToasts(prev => [...prev, { id, type, message }])

    // auto-dismiss após 3s
    setTimeout(() => dismiss(id), 3000)
  }, [dismiss])

  const value: ToastContextValue = {
    success: (msg) => addToast('success', msg),
    error:   (msg) => addToast('error',   msg),
    warning: (msg) => addToast('warning', msg),
    info:    (msg) => addToast('info',    msg),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* ── Área de toasts — canto inferior direito ── */}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-20 right-4 z-[9999] flex flex-col gap-2 md:bottom-6 md:right-6"
          aria-live="polite"
          aria-label="Notificações"
        >
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

// ── hook ──────────────────────────────────────────────────────────────────────
export const useToast = () => useContext(ToastContext)