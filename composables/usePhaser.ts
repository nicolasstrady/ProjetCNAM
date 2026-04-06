export const usePhaser = () => {
  let game: any = null

  const initGame = async (containerId: string, config?: any) => {
    if (game) {
      game.destroy(true)
      game = null
    }

    const Phaser = await import('phaser').then(m => m.default)

    const defaultConfig = {
      type: Phaser.AUTO,
      parent: containerId,
      width: 1200,
      height: 800,
      backgroundColor: '#2d5016',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      ...config
    }

    game = new Phaser.Game(defaultConfig)
    await new Promise<void>((resolve) => {
      game.events.once(Phaser.Core.Events.READY, () => resolve())
    })

    return game
  }

  const destroyGame = () => {
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
