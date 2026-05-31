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
    // A deferred pass catches the case where dimensions aren't final on mount
    // (session restore, fullscreen transition, devtools dock/undock) — without
    // it the scale can stay stale and the page shows white gaps around #root.
    const raf = requestAnimationFrame(update)

    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    // ResizeObserver fires on size changes the resize event can miss.
    const ro = new ResizeObserver(update)
    ro.observe(document.documentElement)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      ro.disconnect()
    }
  }, [])
}
