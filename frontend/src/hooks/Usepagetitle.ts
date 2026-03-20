import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard — SmartFinance',
  '/expenses':  'Gastos — SmartFinance',
  '/salary':    'Salário — SmartFinance',
  '/purchase':  'Posso Comprar? — SmartFinance',
  '/chat':      'Assistente IA — SmartFinance',
}

export function usePageTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    const title = ROUTE_TITLES[pathname] ?? 'SmartFinance — Assistente Financeiro'
    document.title = title
  }, [pathname])
}