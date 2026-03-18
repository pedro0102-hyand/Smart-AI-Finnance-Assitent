import { useEffect, useRef, useState } from 'react'
import {
  MessageSquare, Send, Trash2, RefreshCw,
  X, AlertTriangle, Bot, User, Sparkles,
  ChevronRight, WifiOff, ServerCrash,
} from 'lucide-react'
import { chatApi, friendlyErrorMessage, NetworkError, ServerError } from '../services/api'
import type { ChatMessage } from '../types'

// ── session id persistido no localStorage ─────────────────────────────────────
function getOrCreateSessionId(): string {
  const key = 'sf_chat_session_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    localStorage.setItem(key, id)
  }
  return id
}

// ── sugestões rápidas ─────────────────────────────────────────────────────────
const QUICK_SUGGESTIONS = [
  'Como está meu orçamento esse mês?',
  'Quais gastos posso cortar?',
  'Quanto posso economizar?',
  'Analise meus gastos por categoria',
  'Tenho gastos desnecessários?',
  'Como melhorar minha saúde financeira?',
]

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtTime(date: Date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-black/20 px-1 py-0.5 font-mono text-xs">$1</code>')
}

function renderContent(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      const content = trimmed.replace(/^[-•]\s/, '')
      return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/70" />
          <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
        </div>
      )
    }
    const numbered = trimmed.match(/^(\d+)\.\s(.+)/)
    if (numbered) {
      return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="shrink-0 font-semibold text-amber-500">{numbered[1]}.</span>
          <span dangerouslySetInnerHTML={{ __html: formatInline(numbered[2]) }} />
        </div>
      )
    }
    if (!trimmed) return <div key={i} className="h-2" />
    return (
      <p key={i} className="leading-relaxed"
        dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
      />
    )
  })
}

// ── tipo de erro detectado ────────────────────────────────────────────────────
type ErrorKind = 'network' | 'server' | 'generic'

function getErrorKind(error: unknown): ErrorKind {
  if (error instanceof NetworkError) return 'network'
  if (error instanceof ServerError)  return 'server'
  return 'generic'
}

// ── banner de erro rico ───────────────────────────────────────────────────────
function ErrorBanner({
  message,
  kind,
  onRetry,
  onDismiss,
}: {
  message: string
  kind: ErrorKind
  onRetry?: () => void
  onDismiss: () => void
}) {
  const isNetwork = kind === 'network'
  const Icon = isNetwork ? WifiOff : kind === 'server' ? ServerCrash : AlertTriangle

  return (
    <div className={`
      flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shrink-0
      ${isNetwork
        ? 'border-warning/30 bg-warning/10 text-warning'
        : 'border-danger/30 bg-danger/10 text-danger'
      }
    `}>
      <Icon size={15} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium leading-snug">{message}</p>
        {isNetwork && (
          <p className="mt-0.5 text-xs opacity-80">
            Verifique se o backend está rodando em <code className="font-mono">localhost:8000</code>
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-lg px-2.5 py-1 text-xs font-medium
                       bg-black/10 hover:bg-black/20 transition-colors"
          >
            Tentar novamente
          </button>
        )}
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

// ── bolha de mensagem ─────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2.5 md:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end animate-slide-up`}>
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full
        ${isUser
          ? 'bg-amber-500 text-graphite-950'
          : 'bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)]'
        }`}>
        {isUser ? <User size={13} strokeWidth={2.5} /> : <Bot size={13} />}
      </div>

      <div className={`max-w-[82%] md:max-w-[78%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-3.5 py-2.5 md:px-4 md:py-3 text-sm leading-relaxed
          ${isUser
            ? 'rounded-br-md bg-amber-500 text-graphite-950'
            : 'rounded-bl-md bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)]'
          }`}>
          {isUser
            ? <p className="leading-relaxed">{msg.content}</p>
            : <div className="space-y-1">{renderContent(msg.content)}</div>
          }
        </div>
        <span className="text-[10px] text-[var(--text-muted)] px-1">{fmtTime(msg.timestamp)}</span>
      </div>
    </div>
  )
}

// ── indicador de digitando ────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-2.5 items-end animate-slide-up">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
        bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)]">
        <Bot size={13} />
      </div>
      <div className="rounded-2xl rounded-bl-md bg-[var(--bg-card)] border border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-[var(--text-muted)] animate-pulse-slow"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onSuggest }: { onSuggest: (s: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6 text-center">
      <div className="relative">
        <div className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
          <Sparkles size={24} />
        </div>
        <div className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-success animate-pulse" />
      </div>

      <div>
        <p className="font-display text-xl md:text-2xl">Assistente Financeiro</p>
        <p className="mt-2 text-xs md:text-sm text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed px-2">
          Pergunte sobre seus gastos, orçamento, e receba conselhos com base nos seus dados reais.
        </p>
      </div>

      <div className="w-full max-w-lg px-1">
        <p className="mb-3 text-[10px] md:text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">
          Sugestões para começar
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {QUICK_SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => onSuggest(s)}
              className="group flex items-center justify-between gap-2 rounded-xl border border-[var(--border)]
                         bg-[var(--bg-card)] px-3.5 py-2.5 text-left text-xs md:text-sm
                         text-[var(--text-muted)] transition-all
                         hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-[var(--text-primary)]
                         active:scale-[0.98]"
            >
              <span>{s}</span>
              <ChevronRight size={13} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-amber-500" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function Chat() {
  const [messages, setMessages]         = useState<ChatMessage[]>([])
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [errorKind, setErrorKind]       = useState<ErrorKind>('generic')
  const [lastMessage, setLastMessage]   = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [sessionId]                     = useState(getOrCreateSessionId)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: ChatMessage = { role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setError(null)
    setLastMessage(content)
    setLoading(true)

    if (inputRef.current) inputRef.current.style.height = 'auto'

    try {
      const res = await chatApi.send({ message: content, session_id: sessionId })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.response,
        timestamp: new Date(),
      }])
      setLastMessage(null)
    } catch (e: unknown) {
      setError(friendlyErrorMessage(e))
      setErrorKind(getErrorKind(e))
      // remove a mensagem do usuário que falhou
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  async function retryLastMessage() {
    if (!lastMessage) return
    setError(null)
    await sendMessage(lastMessage)
  }

  async function clearHistory() {
    try {
      await chatApi.clearHistory(sessionId)
      setMessages([])
      setConfirmClear(false)
      setError(null)
      setLastMessage(null)
    } catch (e: unknown) {
      setError(friendlyErrorMessage(e))
      setErrorKind(getErrorKind(e))
      setConfirmClear(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const hasMessages = messages.length > 0

  return (
    <div className="animate-fade-in flex flex-col"
         style={{ height: 'calc(100dvh - 52px - 57px - 1.5rem)' }}
    >
      <div className="flex flex-col flex-1 min-h-0 md:h-full">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-3 md:mb-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-display text-2xl md:text-3xl">Assistente IA</h1>
            <p className="mt-1 text-xs md:text-sm text-[var(--text-muted)]">
              Conselhos financeiros com base nos seus dados
            </p>
          </div>
          {hasMessages && (
            <button
              onClick={() => setConfirmClear(true)}
              className="btn-ghost text-[var(--text-muted)] hover:text-danger"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline text-sm">Limpar</span>
            </button>
          )}
        </div>

        {/* ── Error banner rico ────────────────────────────────────────── */}
        {error && (
          <div className="mb-2 shrink-0">
            <ErrorBanner
              message={error}
              kind={errorKind}
              onRetry={lastMessage ? retryLastMessage : undefined}
              onDismiss={() => setError(null)}
            />
          </div>
        )}

        {/* ── Área de mensagens ────────────────────────────────────────── */}
        <div className="card flex-1 overflow-y-auto p-3 md:p-5 min-h-0">
          {!hasMessages
            ? <EmptyState onSuggest={text => sendMessage(text)} />
            : (
              <div className="space-y-3 md:space-y-4">
                {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
                {loading && <TypingIndicator />}
                <div ref={bottomRef} />
              </div>
            )
          }
        </div>

        {/* ── Chips rápidos ────────────────────────────────────────────── */}
        {hasMessages && !loading && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5 shrink-0"
               style={{ scrollbarWidth: 'none' }}>
            {QUICK_SUGGESTIONS.slice(0, 3).map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-card)]
                           px-3 py-1.5 text-[11px] text-[var(--text-muted)] whitespace-nowrap
                           transition-all hover:border-amber-500/40 hover:bg-amber-500/5
                           hover:text-[var(--text-primary)] active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* ── Input ───────────────────────────────────────────────────── */}
        <div className="mt-2 flex items-end gap-2.5 rounded-2xl border border-[var(--border)]
                        bg-[var(--bg-card)] p-2.5 md:p-3
                        focus-within:border-amber-500/50 focus-within:ring-2
                        focus-within:ring-amber-500/20 transition-all shrink-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <MessageSquare size={13} />
          </div>

          <textarea
            ref={inputRef}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)]
                       placeholder:text-[var(--text-muted)] focus:outline-none leading-relaxed"
            placeholder="Pergunte sobre seus gastos…"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={loading}
            style={{ minHeight: '22px' }}
          />

          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="flex h-8 w-8 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-xl
                       bg-amber-500 text-graphite-950 transition-all
                       hover:bg-amber-400 active:scale-95
                       disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Enviar"
          >
            {loading
              ? <RefreshCw size={14} className="animate-spin" />
              : <Send size={14} strokeWidth={2.5} />
            }
          </button>
        </div>

        <p className="mt-1.5 text-center text-[9px] md:text-[10px] text-[var(--text-muted)] shrink-0">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>

      {/* ── Modal confirmar limpeza ──────────────────────────────────── */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-[var(--border)]
                          bg-[var(--bg-card)] p-5 shadow-2xl animate-slide-up">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border)] sm:hidden" />
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-danger/10 text-danger">
              <Trash2 size={20} />
            </div>
            <p className="font-display text-lg">Limpar conversa?</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              O histórico será apagado do servidor. Essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmClear(false)} className="btn-ghost flex-1 justify-center">
                Cancelar
              </button>
              <button onClick={clearHistory} className="btn-danger flex-1 justify-center">
                <Trash2 size={14} /> Limpar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}