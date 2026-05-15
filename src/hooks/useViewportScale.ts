import { useEffect } from 'react'

const DESIGN_WIDTH = 1440

export function useViewportScale() {
  useEffect(() => {
    function update() {
      const scale = window.innerWidth / DESIGN_WIDTH
      const root = document.documentElement
      root.style.setProperty('--app-scale', String(scale))
      root.style.setProperty('--app-height', `${window.innerHeight / scale}px`)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
}
