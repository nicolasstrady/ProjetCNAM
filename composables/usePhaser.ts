import Phaser from 'phaser'

export const usePhaser = () => {
  let game: Phaser.Game | null = null

  const initGame = (containerId: string, config?: Phaser.Types.Core.GameConfig) => {
    const defaultConfig: Phaser.Types.Core.GameConfig = {
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
