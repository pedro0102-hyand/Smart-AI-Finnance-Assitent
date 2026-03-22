import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface PrivateRouteProps {
  children: React.ReactNode
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const { user, isReady } = useAuth()
  const location = useLocation()

  // Ainda inicializando (verificando localStorage / refresh silencioso)
  if (!isReady) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <p className="text-sm text-[var(--text-muted)]">Verificando sessão…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    // Salva a rota que o usuário tentou acessar para redirecionar após login
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}