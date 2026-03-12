import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Salary from './pages/Salary'
import Purchase from './pages/Purchase'
import Chat from './pages/Chat'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="expenses"  element={<Expenses />} />
        <Route path="salary"    element={<Salary />} />
        <Route path="purchase"  element={<Purchase />} />
        <Route path="chat"      element={<Chat />} />
      </Route>
    </Routes>
  )
}
