export const usePhaser = () => {
  let game: any = null
  let resizeObserver: ResizeObserver | null = null
  let observedElement: HTMLElement | null = null

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

      game?.scale?.resize(width, height)
      game?.scale?.refresh()
    })
  }

  const initGame = async (containerId: string, config?: any) => {
    if (game) {
      game.destroy(true)
      game = null
    }

    const Phaser = await import('phaser').then(m => m.default)
    const resolution = typeof window !== 'undefined'
      ? Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
      : 1

    const defaultConfig = {
      type: Phaser.AUTO,
      parent: containerId,
      width: 1200,
      height: 800,
      backgroundColor: '#2d5016',
      resolution,
      antialias: true,
      autoRound: false,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      ...config
    }

    game = new Phaser.Game(defaultConfig)
    await new Promise<void>((resolve) => {
      game.events.once(Phaser.Core.Events.READY, () => resolve())
    })

    const container = document.getElementById(containerId)
    observedElement = container?.parentElement ?? container

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

    if (game) {
      game.destroy(true)
      game = null
    }
  }

  return {
    game,
    initGame,
    destroyGame
  }
}
