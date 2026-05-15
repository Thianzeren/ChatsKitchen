import { useLayoutEffect } from 'react'

const DESIGN_WIDTH = 1440

export function useViewportScale() {
  useLayoutEffect(() => {
    const root = document.getElementById('root')!
    root.style.width = `${DESIGN_WIDTH}px`
    root.style.position = 'absolute'
    root.style.left = '50%'
    root.style.marginLeft = `-${DESIGN_WIDTH / 2}px`
    root.style.transformOrigin = 'top center'

    function update() {
      const scale = window.innerWidth / DESIGN_WIDTH
      root.style.transform = `scale(${scale})`
      root.style.height = `${window.innerHeight / scale}px`
      document.documentElement.style.setProperty('--app-scale', String(scale))
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight / scale}px`)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
}
