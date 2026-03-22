
import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/layout/Layout'
import PrivateRoute from './components/auth/PrivateRoute'
import AuthPage from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Salary from './pages/Salary'
import Purchase from './pages/Purchase'
import Chat from './pages/Chat'
import { useAuth } from './context/AuthContext'

export default function App() {
  const { logout } = useAuth()

  // Escuta evento global disparado pela api.ts quando recebe 401
  useEffect(() => {
    function handleUnauthorized() {
      logout()
    }
    window.addEventListener('sf:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('sf:unauthorized', handleUnauthorized)
  }, [logout])

  return (
    <Routes>
      {/* ── Rotas públicas ── */}
      <Route path="/login"    element={<AuthPage />} />
      <Route path="/register" element={<AuthPage />} />

      {/* ── Rotas protegidas ── */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="expenses"  element={<Expenses />} />
        <Route path="salary"    element={<Salary />} />
        <Route path="purchase"  element={<Purchase />} />
        <Route path="chat"      element={<Chat />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}