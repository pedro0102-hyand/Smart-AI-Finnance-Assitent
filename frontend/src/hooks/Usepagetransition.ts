import { useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

/**
 * Retorna uma key e uma classe CSS que garante animação de fade+slide
 * toda vez que a rota muda. Funciona envolvendo o <Outlet /> com
 * a key e aplicando a className no wrapper.
 *
 * Uso no Layout:
 *   const { transitionKey, transitionClass } = usePageTransition()
 *   <div key={transitionKey} className={transitionClass}>
 *     <Outlet />
 *   </div>
 */
export function usePageTransition() {
  const { pathname } = useLocation()
  const [transitionClass, setTransitionClass] = useState('page-enter')
  const prevPath = useRef(pathname)

  useEffect(() => {
    if (prevPath.current === pathname) return
    prevPath.current = pathname

    // reseta a animação forçando reflow
    setTransitionClass('page-exit')
    const t = setTimeout(() => setTransitionClass('page-enter'), 16)
    return () => clearTimeout(t)
  }, [pathname])

  return {
    transitionKey: pathname,
    transitionClass,
  }
}