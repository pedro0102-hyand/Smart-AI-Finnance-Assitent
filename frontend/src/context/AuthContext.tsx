import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from 'react'

export interface AuthUser {
  id: number
  name: string
  email: string
}

interface AuthState {
  user:         AuthUser | null
  accessToken:  string | null
  refreshToken: string | null
}

interface AuthContextValue extends AuthState {
  login:   (email: string, password: string) => Promise<void>
  register:(name: string, email: string, password: string) => Promise<void>
  logout:  () => void
  isReady: boolean
}

const KEY_ACCESS  = 'sf_access_token'
const KEY_REFRESH = 'sf_refresh_token'
const KEY_USER    = 'sf_user'

// Em produção lê VITE_API_URL; em dev cai no localhost
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const AuthContext = createContext<AuthContextValue>({
  user: null, accessToken: null, refreshToken: null,
  login: async () => {}, register: async () => {}, logout: () => {},
  isReady: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, accessToken: null, refreshToken: null,
  })
  const [isReady, setIsReady] = useState(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function persist(user: AuthUser, accessToken: string, refreshToken: string) {
    localStorage.setItem(KEY_ACCESS,  accessToken)
    localStorage.setItem(KEY_REFRESH, refreshToken)
    localStorage.setItem(KEY_USER,    JSON.stringify(user))
    setState({ user, accessToken, refreshToken })
    scheduleRefresh(accessToken)
  }

  function clear() {
    localStorage.removeItem(KEY_ACCESS)
    localStorage.removeItem(KEY_REFRESH)
    localStorage.removeItem(KEY_USER)
    setState({ user: null, accessToken: null, refreshToken: null })
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
  }

  function getTokenExp(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.exp ?? null
    } catch {
      return null
    }
  }

  const doRefresh = useCallback(async (refreshToken: string) => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) { clear(); return }
      const data = await res.json()
      const storedUser = localStorage.getItem(KEY_USER)
      if (!storedUser) { clear(); return }
      persist(JSON.parse(storedUser), data.access_token, data.refresh_token)
    } catch {
      clear()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleRefresh(accessToken: string) {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const exp = getTokenExp(accessToken)
    if (!exp) return
    const msUntilRefresh = (exp * 1000) - Date.now() - 60_000
    if (msUntilRefresh <= 0) return
    refreshTimerRef.current = setTimeout(() => {
      const rt = localStorage.getItem(KEY_REFRESH)
      if (rt) doRefresh(rt)
    }, msUntilRefresh)
  }

  useEffect(() => {
    const access  = localStorage.getItem(KEY_ACCESS)
    const refresh = localStorage.getItem(KEY_REFRESH)
    const userRaw = localStorage.getItem(KEY_USER)

    if (access && refresh && userRaw) {
      try {
        const user = JSON.parse(userRaw) as AuthUser
        const exp  = getTokenExp(access)
        if (exp && exp * 1000 > Date.now()) {
          setState({ user, accessToken: access, refreshToken: refresh })
          scheduleRefresh(access)
        } else if (refresh) {
          doRefresh(refresh)
        } else {
          clear()
        }
      } catch {
        clear()
      }
    }
    setIsReady(true)

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function login(email: string, password: string) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail ?? 'E-mail ou senha incorretos.')
    }
    const data = await res.json()
    persist(data.user, data.access_token, data.refresh_token)
  }

  async function register(name: string, email: string, password: string) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail ?? 'Erro ao criar conta.')
    }
    const data = await res.json()
    persist(data.user, data.access_token, data.refresh_token)
  }

  function logout() { clear() }

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, isReady }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)