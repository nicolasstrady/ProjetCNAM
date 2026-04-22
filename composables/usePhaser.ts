export const usePhaser = () => {
  let game: any = null
  let resizeObserver: ResizeObserver | null = null
  let observedElement: HTMLElement | null = null
  let lastCssWidth = 0
  let lastCssHeight = 0
  let lastRenderWidth = 0
  let lastRenderHeight = 0

  const getTargetResolution = (width?: number, height?: number) => {
    if (typeof window === 'undefined') {
      return 1
    }

    const deviceResolution = Math.max(window.devicePixelRatio || 1, 1)
    const safeWidth = Math.max(width ?? window.innerWidth ?? 1, 1)
    const safeHeight = Math.max(height ?? window.innerHeight ?? 1, 1)
    const maxInternalPixels = 9_000_000
    const budgetResolution = Math.sqrt(maxInternalPixels / (safeWidth * safeHeight))

    return Math.max(1, Math.min(deviceResolution, budgetResolution, 3))
  }

  const getGlobalGameStore = () => {
    if (typeof window === 'undefined') {
      return null
    }

    return window as Window & { __tarotPhaserGame?: any }
  }

  const destroyGameInstance = (gameInstance: any) => {
    try {
      gameInstance?.destroy(true)
    } catch {
      // Phaser peut deja etre en cours de destruction pendant un HMR.
    }
  }

  const refreshScale = () => {
    if (!game?.scale || !observedElement) {
      return
    }

    requestAnimationFrame(() => {
      const element = observedElement

      if (!element) {
        return
      }

      const width = Math.max(element.clientWidth, 1)
      const height = Math.max(element.clientHeight, 1)
      const resolution = getTargetResolution(width, height)
      const renderWidth = Math.max(1, Math.round(width * resolution))
      const renderHeight = Math.max(1, Math.round(height * resolution))

      const hasChanged =
        width !== lastCssWidth ||
        height !== lastCssHeight ||
        renderWidth !== lastRenderWidth ||
        renderHeight !== lastRenderHeight

      if (!hasChanged) {
        return
      }

      lastCssWidth = width
      lastCssHeight = height
      lastRenderWidth = renderWidth
      lastRenderHeight = renderHeight

      game?.scale?.resize(renderWidth, renderHeight)

      if (game?.canvas) {
        game.canvas.style.width = `${width}px`
        game.canvas.style.height = `${height}px`
      }

      game?.scale?.refresh()
    })
  }

  const initGame = async (containerId: string, config?: any) => {
    if (game) {
      destroyGameInstance(game)
      game = null
    }

    const Phaser = await import('phaser').then(m => m.default)
    const globalGameStore = getGlobalGameStore()

    if (globalGameStore?.__tarotPhaserGame) {
      destroyGameInstance(globalGameStore.__tarotPhaserGame)
      globalGameStore.__tarotPhaserGame = null
    }

    const container = document.getElementById(containerId)
    container?.querySelectorAll('canvas').forEach((canvas) => canvas.remove())

    const element = container?.parentElement ?? container
    const initialCssWidth = Math.max(element?.clientWidth ?? 1200, 1)
    const initialCssHeight = Math.max(element?.clientHeight ?? 800, 1)
    const initialResolution = getTargetResolution(initialCssWidth, initialCssHeight)
    const initialWidth = Math.max(1, Math.round(initialCssWidth * initialResolution))
    const initialHeight = Math.max(1, Math.round(initialCssHeight * initialResolution))

    const defaultConfig: any = {
      parent: containerId,
      width: initialWidth,
      height: initialHeight,
      backgroundColor: '#2d5016',
      antialias: true,
      antialiasGL: true,
      autoRound: false,
      powerPreference: 'high-performance',
      desynchronized: false,
      scale: {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.NO_CENTER
      },
      ...config
    }
    defaultConfig.type = Phaser.WEBGL ?? 2
    defaultConfig.parent = containerId

    game = new Phaser.Game(defaultConfig)
    if (globalGameStore) {
      globalGameStore.__tarotPhaserGame = game
    }

    await new Promise<void>((resolve) => {
      game.events.once(Phaser.Core.Events.READY, () => resolve())
    })

    observedElement = container?.parentElement ?? container
    lastCssWidth = 0
    lastCssHeight = 0
    lastRenderWidth = 0
    lastRenderHeight = 0

    if (typeof ResizeObserver !== 'undefined' && observedElement) {
      resizeObserver = new ResizeObserver(() => {
        refreshScale()
      })
      resizeObserver.observe(observedElement)
    }

    window.addEventListener('resize', refreshScale)
    refreshScale()

    return game
  }

  const destroyGame = () => {
    window.removeEventListener('resize', refreshScale)
    resizeObserver?.disconnect()
    resizeObserver = null
    observedElement = null
    lastCssWidth = 0
    lastCssHeight = 0
    lastRenderWidth = 0
    lastRenderHeight = 0

    if (game) {
      destroyGameInstance(game)
      const globalGameStore = getGlobalGameStore()

      if (globalGameStore && globalGameStore.__tarotPhaserGame === game) {
        globalGameStore.__tarotPhaserGame = null
      }

      game = null
    }
  }

  return {
    game,
    initGame,
    destroyGame
  }
}
