import { useState, useEffect } from 'react'
import { getLayoutMode, applyLayoutMode, type LayoutMode } from '../theme'

export function useLayoutMode() {
  const [mode, setModeState] = useState<LayoutMode>(getLayoutMode)

  useEffect(() => {
    const handler = () => setModeState(getLayoutMode())
    window.addEventListener('comrade-layout-change', handler)
    return () => window.removeEventListener('comrade-layout-change', handler)
  }, [])

  const setMode = (m: LayoutMode) => {
    applyLayoutMode(m)
    setModeState(m)
  }

  return { mode, setMode }
}
