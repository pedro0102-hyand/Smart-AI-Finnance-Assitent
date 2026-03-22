import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { TrendingUp, Mail, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

type Mode = 'login' | 'register'

// ── Floating label input ───────────────────────────────────────────────────────
interface FieldProps {
  id:          string
  label:       string
  type?:       string
  value:       string
  onChange:    (v: string) => void
  error?:      string
  icon:        React.ReactNode
  autoFocus?:  boolean
  autoComplete?: string
}

function Field({ id, label, type = 'text', value, onChange, error, icon, autoFocus, autoComplete }: FieldProps) {
  const [show, setShow] = useState(false)
  const isPassword      = type === 'password'
  const inputType       = isPassword ? (show ? 'text' : 'password') : type

  return (
    <div className="space-y-1.5">
      <div className="relative">
        {/* icon */}
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
          {icon}
        </span>

        <input
          id={id}
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          placeholder={label}
          className={`
            w-full rounded-2xl border bg-[var(--bg-secondary)] py-3.5 pl-11 pr-${isPassword ? '11' : '4'}
            text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
            outline-none transition-all duration-200
            focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20
            ${error ? 'border-danger/60 focus:border-danger focus:ring-danger/20' : 'border-[var(--border)]'}
          `}
        />

        {/* show/hide password */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]
                       hover:text-[var(--text-primary)] transition-colors"
            tabIndex={-1}
            aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-danger px-1">
          <AlertCircle size={12} className="shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const navigate        = useNavigate()
  const location        = useLocation()
  const { login, register, user } = useAuth()

  // Se já autenticado, redireciona
  useEffect(() => {
    if (user) {
      const from = (location.state as any)?.from?.pathname ?? '/dashboard'
      navigate(from, { replace: true })
    }
  }, [user, navigate, location])

  // Determina modo pela URL: /login vs /register
  const mode: Mode = location.pathname === '/register' ? 'register' : 'login'

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [errors,   setErrors]   = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState('')
  const [loading,  setLoading]  = useState(false)

  // Limpa erros ao mudar de modo
  useEffect(() => {
    setErrors({}); setApiError(''); setName(''); setPassword('')
  }, [mode])

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate() {
    const e: Record<string, string> = {}
    if (mode === 'register' && !name.trim())
      e.name = 'Informe seu nome'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      e.email = 'E-mail inválido'
    if (!password || password.length < 6)
      e.password = 'Mínimo de 6 caracteres'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true); setApiError('')

    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(name, email, password)
      }
      // Navegação feita pelo useEffect que observa `user`
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center
                    bg-[var(--bg-primary)] px-4 py-12 overflow-hidden">

      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full
                        bg-amber-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full
                        bg-amber-500/5 blur-3xl" />
        {/* Grid pattern */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.03]"
             xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative w-full max-w-[400px] animate-slide-up">

        {/* ── Logo ── */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl
                          bg-amber-500 shadow-lg shadow-amber-500/30">
            <TrendingUp size={22} className="text-graphite-950" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="font-display text-2xl">
              Smart<span className="text-amber-500">Finance</span>
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {mode === 'login'
                ? 'Entre na sua conta'
                : 'Crie sua conta gratuita'}
            </p>
          </div>
        </div>

        {/* ── Card ── */}
        <div className="card p-6 shadow-xl">

          {/* Mode tabs */}
          <div className="mb-6 flex rounded-xl bg-[var(--bg-secondary)] p-1">
            {(['login', 'register'] as Mode[]).map(m => (
              <Link
                key={m}
                to={m === 'login' ? '/login' : '/register'}
                className={`
                  flex-1 rounded-lg py-2 text-center text-sm font-medium transition-all duration-200
                  ${mode === m
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}
                `}
              >
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </Link>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {mode === 'register' && (
              <Field
                id="name"
                label="Seu nome"
                value={name}
                onChange={setName}
                error={errors.name}
                icon={<User size={16} />}
                autoFocus
                autoComplete="name"
              />
            )}

            <Field
              id="email"
              label="E-mail"
              type="email"
              value={email}
              onChange={setEmail}
              error={errors.email}
              icon={<Mail size={16} />}
              autoFocus={mode === 'login'}
              autoComplete="email"
            />

            <Field
              id="password"
              label={mode === 'register' ? 'Senha (mín. 6 caracteres)' : 'Senha'}
              type="password"
              value={password}
              onChange={setPassword}
              error={errors.password}
              icon={<Lock size={16} />}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />

            {/* API error */}
            {apiError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-danger/30
                              bg-danger/10 px-4 py-3 text-sm text-danger animate-slide-up">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{apiError}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3.5 text-sm font-semibold
                         mt-2 shadow-md shadow-amber-500/20 disabled:shadow-none"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Aguarde…</>
                : mode === 'login'
                  ? <><ArrowRight size={16} /> Entrar</>
                  : <><ArrowRight size={16} /> Criar conta</>
              }
            </button>
          </form>
        </div>

        {/* Alt mode link */}
        <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
          {mode === 'login'
            ? <>Não tem conta?{' '}
                <Link to="/register"
                  className="font-medium text-amber-500 hover:text-amber-400 transition-colors">
                  Criar agora
                </Link>
              </>
            : <>Já tem conta?{' '}
                <Link to="/login"
                  className="font-medium text-amber-500 hover:text-amber-400 transition-colors">
                  Entrar
                </Link>
              </>
          }
        </p>

        <p className="mt-6 text-center text-[10px] text-[var(--text-muted)]/50">
          Seus dados ficam salvos localmente e nunca são compartilhados.
        </p>
      </div>
    </div>
  )
}