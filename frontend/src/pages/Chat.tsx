import { useEffect, useRef, useState } from 'react'
import {
  MessageSquare, Send, Trash2, RefreshCw,
  X, AlertTriangle, Bot, User, Sparkles,
  ChevronRight,
} from 'lucide-react'
import { chatApi } from '../services/api'
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

// ── formata hora ──────────────────────────────────────────────────────────────
function fmtTime(date: Date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ── renderiza markdown simples (negrito, itálico, listas, quebras) ─────────────
function renderContent(text: string) {
  // Converte **bold**, *italic*, bullet lists e quebras de linha
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const trimmed = line.trim()

    // linha de bullet
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      const content = trimmed.replace(/^[-•]\s/, '')
      return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/70" />
          <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
        </div>
      )
    }

    // linha numerada
    const numbered = trimmed.match(/^(\d+)\.\s(.+)/)
    if (numbered) {
      return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="shrink-0 font-semibold text-amber-500">{numbered[1]}.</span>
          <span dangerouslySetInnerHTML={{ __html: formatInline(numbered[2]) }} />
        </div>
      )
    }

    // linha vazia → espaço
    if (!trimmed) return <div key={i} className="h-2" />

    // linha normal
    return (
      <p key={i} className="leading-relaxed"
        dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
      />
    )
  })
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-black/20 px-1 py-0.5 font-mono text-xs">$1</code>')
}

// ── bolha de mensagem ─────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end animate-slide-up`}>
      {/* avatar */}
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full
        ${isUser
          ? 'bg-amber-500 text-graphite-950'
          : 'bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)]'
        }`}>
        {isUser ? <User size={14} strokeWidth={2.5} /> : <Bot size={14} />}
      </div>

      {/* conteúdo */}
      <div className={`max-w-[78%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
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
    <div className="flex gap-3 items-end animate-slide-up">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
        bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)]">
        <Bot size={14} />
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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8 text-center">
      {/* ícone */}
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
          <Sparkles size={28} />
        </div>
        <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-success animate-pulse" />
      </div>

      <div>
        <p className="font-display text-2xl">Assistente Financeiro</p>
        <p className="mt-2 text-sm text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed">
          Pergunte sobre seus gastos, orçamento, e receba conselhos personalizados com base nos seus dados reais.
        </p>
      </div>

      {/* sugestões */}
      <div className="w-full max-w-lg">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">
          Sugestões para começar
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {QUICK_SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => onSuggest(s)}
              className="group flex items-center justify-between gap-2 rounded-xl border border-[var(--border)]
                         bg-[var(--bg-card)] px-4 py-3 text-left text-sm text-[var(--text-muted)]
                         transition-all hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-[var(--text-primary)]"
            >
              <span>{s}</span>
              <ChevronRight size={14} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-amber-500" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function Chat() {
  const [messages, setMessages]     = useState<ChatMessage[]>([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [sessionId]                 = useState(getOrCreateSessionId)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  // scroll para o fim sempre que mensagens mudam
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // auto-resize do textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: ChatMessage = { role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setError(null)
    setLoading(true)

    // reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    try {
      const res = await chatApi.send({ message: content, session_id: sessionId })
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: res.response,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (e: any) {
      setError(e.message ?? 'Erro ao enviar mensagem')
      // remove a mensagem do user se falhou
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
      // foca input novamente
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  async function clearHistory() {
    try {
      await chatApi.clearHistory(sessionId)
      setMessages([])
      setConfirmClear(false)
      setError(null)
    } catch (e: any) {
      setError(e.message ?? 'Erro ao limpar histórico')
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
    <div className="animate-fade-in flex h-full flex-col" style={{ height: 'calc(100vh - 4rem)' }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Assistente IA</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Conselhos financeiros personalizados com base nos seus dados
          </p>
        </div>

        {hasMessages && (
          <button
            onClick={() => setConfirmClear(true)}
            className="btn-ghost text-[var(--text-muted)] hover:text-danger"
            aria-label="Limpar conversa"
          >
            <Trash2 size={15} />
            <span className="hidden sm:inline">Limpar</span>
          </button>
        )}
      </div>

      {/* ── Error banner ────────────────────────────────────────────── */}
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Área de mensagens ──────────────────────────────────────── */}
      <div className="card flex-1 overflow-y-auto p-4 md:p-6" style={{ minHeight: 0 }}>
        {!hasMessages ? (
          <EmptyState onSuggest={text => sendMessage(text)} />
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Chips de sugestão (quando já há mensagens) ──────────────── */}
      {hasMessages && !loading && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {QUICK_SUGGESTIONS.slice(0, 3).map(s => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-card)]
                         px-3 py-1.5 text-xs text-[var(--text-muted)]
                         transition-all hover:border-amber-500/40 hover:bg-amber-500/5
                         hover:text-[var(--text-primary)] whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Input area ──────────────────────────────────────────────── */}
      <div className="mt-3 flex items-end gap-3 rounded-2xl border border-[var(--border)]
                      bg-[var(--bg-card)] p-3 focus-within:border-amber-500/50
                      focus-within:ring-2 focus-within:ring-amber-500/20 transition-all">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                        bg-amber-500/10 text-amber-500">
          <MessageSquare size={15} />
        </div>

        <textarea
          ref={inputRef}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)]
                     placeholder:text-[var(--text-muted)] focus:outline-none leading-relaxed"
          placeholder="Pergunte sobre seus gastos, orçamento…  (Enter para enviar)"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={loading}
          style={{ minHeight: '24px' }}
        />

        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
                     bg-amber-500 text-graphite-950 transition-all
                     hover:bg-amber-400 active:scale-95
                     disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Enviar mensagem"
        >
          {loading
            ? <RefreshCw size={15} className="animate-spin" />
            : <Send size={15} strokeWidth={2.5} />
          }
        </button>
      </div>

      <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">
        Shift+Enter para nova linha · Enter para enviar
      </p>

      {/* ── Modal confirmar limpeza ──────────────────────────────────── */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl animate-slide-up">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
              <Trash2 size={22} />
            </div>
            <p className="font-display text-lg">Limpar conversa?</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              O histórico desta sessão será apagado do servidor. Essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmClear(false)}
                className="btn-ghost flex-1 justify-center"
              >
                Cancelar
              </button>
              <button
                onClick={clearHistory}
                className="btn-danger flex-1 justify-center"
              >
                <Trash2 size={14} /> Limpar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}