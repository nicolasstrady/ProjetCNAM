import Phaser from 'phaser'
import type { Card, CurrentPliCard, SceneTableState, TablePlayer } from '~/types'
import { getRelativePlayerOffset, sortHandCards } from '~/utils/tarot'

interface SceneCallbacks {
  onCardClick?: (card: Card) => void
  onCallKing?: (card: Card) => void
  onRetrieveDog?: () => void
}

interface RenderOptions {
  suppressTrickCards?: boolean
  suppressPlayedCardId?: number | null
  suppressDogDiscardedCardId?: number | null
}

interface SceneLayout {
  width: number
  height: number
  centerX: number
  centerY: number
  padding: number
  statusY: number
  statusWidth: number
  statusHeight: number
  statusFontSize: number
  handCardWidth: number
  handCardHeight: number
  handY: number
  selfLabelY: number
  selfFontSize: number
  handSpacingMin: number
  handSpacingMax: number
  opponentCardWidth: number
  opponentCardHeight: number
  opponentLabelFontSize: number
  opponentScoreFontSize: number
  topSeatY: number
  topSeatOffsetX: number
  sideSeatX: number
  sideSeatY: number
  trickCardWidth: number
  trickCardHeight: number
  trickCenterY: number
  trickRadiusX: number
  trickTopOffsetY: number
  trickBottomOffsetY: number
  dogLabelY: number
  dogCardsY: number
  dogCardWidth: number
  dogCardHeight: number
  dogInfoY: number
  kingLabelY: number
  kingCardsY: number
  kingCardWidth: number
  kingCardHeight: number
  retrieveButtonY: number
  retrieveButtonWidth: number
  retrieveButtonHeight: number
}

type SeatKey = 'self' | 'left' | 'topLeft' | 'topRight' | 'right'

export class GameScene extends Phaser.Scene {
  // Real scans are close to 1440x2640, so keep the whole table on that physical ratio.
  private static readonly CARD_ASPECT_RATIO = 0.545
  private static readonly TRICK_COLLECTION_DELAY_MS = 1500
  private static readonly TRICK_COLLECTION_ANIMATION_DURATION_MS = 760
  private static readonly DOG_RETRIEVE_DURATION_MS = 420
  private static readonly DOG_DISCARD_DURATION_MS = 320

  private dynamicObjects: Phaser.GameObjects.GameObject[] = []
  private transientObjects: Phaser.GameObjects.GameObject[] = []
  private tableState: SceneTableState | null = null
  private collectedPliIds = new Set<number>()
  private pendingTrickCollection: Phaser.Time.TimerEvent | null = null
  private pendingTrickCollectionPliId: number | null = null
  private trickCollectionAnimating = false
  private trickCollectionAnimatingPliId: number | null = null
  private hoveredHandCard: {
    image: Phaser.GameObjects.Image
    baseY: number
    baseWidth: number
    baseHeight: number
    baseDepth: number
  } | null = null
  private onCardClick?: (card: Card) => void
  private onCallKing?: (card: Card) => void
  private onRetrieveDog?: () => void
  private sceneReady = false
  private backgroundImage?: Phaser.GameObjects.Image
  private tableBorder?: Phaser.GameObjects.Rectangle
  private tableGlow?: Phaser.GameObjects.Ellipse
  private tableStateSignature = ''

  constructor() {
    super({ key: 'GameScene' })
  }

  init(data: SceneCallbacks) {
    this.onCardClick = data.onCardClick
    this.onCallKing = data.onCallKing
    this.onRetrieveDog = data.onRetrieveDog
  }

  preload() {
    this.load.image('cardback', '/cards/cardback.png')
    this.load.image('background', '/background.jpg')

    for (let i = 1; i <= 14; i += 1) {
      this.load.image(`spade_${i}`, `/cards/Spade/card_${i}_spade.png`)
      this.load.image(`heart_${i}`, `/cards/Heart/card_${i}_heart.png`)
      this.load.image(`diamond_${i}`, `/cards/Diamond/card_${i}_diamond.png`)
      this.load.image(`clover_${i}`, `/cards/Clover/card_${i}_clover.png`)
    }

    for (let i = 1; i <= 21; i += 1) {
      this.load.image(`atout_${i}`, `/cards/Atout/card_${i}_atout.png`)
    }

    this.load.image('atout_E', '/cards/Atout/card_E_atout.png')
  }

  create() {
    this.createBackdrop()
    this.scale.on('resize', this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this)
    })

    this.sceneReady = true
    this.renderTable()
  }

  private createBackdrop() {
    this.backgroundImage = this.add.image(0, 0, 'background')
    this.backgroundImage.setAlpha(0.32)
    this.backgroundImage.setDepth(-30)

    this.tableBorder = this.add.rectangle(0, 0, 0, 0, 0x042b16, 0.22)
      .setStrokeStyle(2, 0xd2b36b, 0.35)
      .setDepth(-20)

    this.tableGlow = this.add.ellipse(0, 0, 0, 0, 0x082f1c, 0.22)
      .setStrokeStyle(2, 0xe7d29b, 0.22)
      .setDepth(-10)

    this.updateBackdropLayout()
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    this.cameras.resize(gameSize.width, gameSize.height)
    this.updateBackdropLayout()

    if (!this.sceneReady || this.trickCollectionAnimating) {
      return
    }

    this.renderTable()
  }

  private updateBackdropLayout() {
    const layout = this.getLayout()
    const backgroundSource = this.backgroundImage?.texture.getSourceImage() as { width?: number; height?: number } | undefined

    if (this.backgroundImage) {
      this.backgroundImage.setPosition(layout.centerX, layout.centerY)

      if (backgroundSource?.width && backgroundSource.height) {
        const coverScale = Math.max(layout.width / backgroundSource.width, layout.height / backgroundSource.height)
        this.backgroundImage.setDisplaySize(backgroundSource.width * coverScale, backgroundSource.height * coverScale)
      } else {
        this.backgroundImage.setDisplaySize(layout.width, layout.height)
      }
    }

    this.tableBorder
      ?.setPosition(layout.centerX, layout.centerY)
      .setSize(Math.max(layout.width - 20, layout.width * 0.96), Math.max(layout.height - 20, layout.height * 0.95))

    this.tableGlow
      ?.setPosition(layout.centerX, layout.centerY - Math.min(10, layout.height * 0.015))
      .setSize(Math.max(layout.width * 0.5, 360), Math.max(layout.height * 0.42, 220))
  }

  setTableState(state: SceneTableState) {
    const previousState = this.tableState ? this.cloneState(this.tableState) : null
    const nextState = this.cloneState(state)
    const nextSignature = this.getStateSignature(nextState)

    if (this.tableStateSignature === nextSignature) {
      this.tableState = nextState
      return
    }

    if (
      this.pendingTrickCollection &&
      (nextState.currentPliId !== this.pendingTrickCollectionPliId || !nextState.finTour)
    ) {
      this.clearPendingTrickCollection()
    }

    this.tableState = nextState
    this.tableStateSignature = nextSignature

    if (!this.sceneReady) {
      return
    }

    const isUpdatingCollectedPli = this.trickCollectionAnimatingPliId !== null
      && nextState.currentPliId === this.trickCollectionAnimatingPliId

    if (this.trickCollectionAnimating || isUpdatingCollectedPli) {
      return
    }

    if (this.shouldAnimateDogRetrieve(previousState, nextState)) {
      this.animateDogRetrieve(previousState as SceneTableState, nextState)
      return
    }

    const newDiscardedDogCard = this.getNewDiscardedDogCard(previousState, nextState)
    if (newDiscardedDogCard) {
      this.animateDogDiscard(previousState as SceneTableState, nextState, newDiscardedDogCard)
      return
    }

    const newPlayedCard = this.getNewPlayedCard(previousState, nextState)
    if (newPlayedCard) {
      this.animatePlayedCard(previousState, nextState, newPlayedCard)
      return
    }

    if (this.shouldAnimateTrickCollection(previousState, nextState)) {
      this.animateTrickCollection(nextState)
      return
    }

    this.renderTable()
  }

  displayPlayerHand(cards: Card[]) {
    if (!this.tableState) {
      return
    }

    this.tableState = {
      ...this.tableState,
      playerHand: [...cards]
    }
    this.tableStateSignature = this.getStateSignature(this.tableState)

    if (this.sceneReady) {
      this.renderTable()
    }
  }

  clearCenterCards() {
    if (!this.tableState) {
      return
    }

    this.tableState = {
      ...this.tableState,
      currentPliCards: []
    }
    this.tableStateSignature = this.getStateSignature(this.tableState)

    if (this.sceneReady) {
      this.renderTable()
    }
  }

  private cloneState(state: SceneTableState): SceneTableState {
    return {
      ...state,
      playerHand: [...state.playerHand],
      players: [...state.players],
      dogCards: [...state.dogCards],
      discardedDogCards: [...state.discardedDogCards],
      currentPliCards: [...state.currentPliCards],
      kingChoices: [...state.kingChoices],
      selectableCardIds: [...state.selectableCardIds]
    }
  }

  private getStateSignature(state: SceneTableState) {
    return JSON.stringify({
      phase: state.phase,
      myPlayerNum: state.myPlayerNum,
      currentTurn: state.currentTurn,
      currentPliId: state.currentPliId,
      currentPliWinnerNum: state.currentPliWinnerNum,
      finTour: state.finTour,
      takerNum: state.takerNum,
      partnerNum: state.partnerNum,
      teamsRevealed: state.teamsRevealed,
      calledKingColor: state.calledKingColor,
      dogRetrieved: state.dogRetrieved,
      dogDiscardCount: state.dogDiscardCount,
      statusText: state.statusText,
      playerHand: state.playerHand.map((card) => card.id),
      players: state.players.map((player) => [player.num, player.score, player.handCount, player.pseudo]),
      dogCards: state.dogCards.map((card) => card.id),
      discardedDogCards: state.discardedDogCards.map((card) => card.id),
      currentPliCards: state.currentPliCards.map((playedCard) => [playedCard.card.id, playedCard.playerNum, playedCard.position]),
      kingChoices: state.kingChoices.map((card) => card.id),
      selectableCardIds: [...state.selectableCardIds]
    })
  }

  private getLayout(): SceneLayout {
    const width = this.scale.width
    const height = this.scale.height
    const canvasRect = this.game.canvas.getBoundingClientRect()
    const displayWidth = Math.max(canvasRect.width || width, 1)
    const displayHeight = Math.max(canvasRect.height || height, 1)
    const scaleX = width / displayWidth
    const scaleY = height / displayHeight
    const scale = Math.min(scaleX, scaleY)
    const sx = (value: number) => value * scaleX
    const sy = (value: number) => value * scaleY
    const ss = (value: number) => value * scale

    const centerX = width / 2
    const centerY = height / 2
    const paddingDisplay = Phaser.Math.Clamp(Math.min(displayWidth, displayHeight) * 0.028, 8, 24)

    const statusHeightDisplay = Phaser.Math.Clamp(displayHeight * 0.068, 40, 56)
    const statusWidthMaxDisplay = Math.max(displayWidth - (paddingDisplay * 2) - 150, 220)
    const statusWidthDisplay = Math.min(Math.max(displayWidth * 0.4, 260), statusWidthMaxDisplay)
    const statusYDisplay = paddingDisplay + statusHeightDisplay / 2 + Phaser.Math.Clamp(displayHeight * 0.022, 8, 18)

    const tableCardBaseHeightDisplay = Phaser.Math.Clamp(displayHeight * 0.238, 98, 182)
    const handCardHeightDisplay = Phaser.Math.Clamp(displayHeight * 0.4, 168, 320)
    const handCardWidthDisplay = handCardHeightDisplay * GameScene.CARD_ASPECT_RATIO
    const handYDisplay = displayHeight + (handCardHeightDisplay * 0.05)
    const selfLabelYDisplay = handYDisplay - (handCardHeightDisplay / 2) - Phaser.Math.Clamp(displayHeight * 0.055, 22, 38)

    const opponentCardHeightDisplay = Phaser.Math.Clamp(tableCardBaseHeightDisplay * 0.72, 68, 118)
    const opponentCardWidthDisplay = opponentCardHeightDisplay * GameScene.CARD_ASPECT_RATIO
    const topSeatYDisplay = statusYDisplay + (statusHeightDisplay / 2) + (opponentCardHeightDisplay / 2) + Phaser.Math.Clamp(displayHeight * 0.075, 24, 42)
    const topSeatOffsetXDisplay = Math.min(
      Phaser.Math.Clamp(displayWidth * 0.29, 150, 340),
      Math.max((displayWidth / 2) - paddingDisplay - (opponentCardWidthDisplay * 1.08), 126)
    )
    const sideSeatXDisplay = paddingDisplay + (opponentCardHeightDisplay / 2) + 18
    const sideSeatYDisplay = (displayHeight / 2) + Phaser.Math.Clamp(displayHeight * 0.01, 0, 14)

    const trickCardHeightDisplay = Phaser.Math.Clamp(tableCardBaseHeightDisplay * 0.86, 84, 150)
    const trickCardWidthDisplay = trickCardHeightDisplay * GameScene.CARD_ASPECT_RATIO
    const trickCenterYDisplay = (displayHeight / 2) - Phaser.Math.Clamp(displayHeight * 0.008, 0, 8)
    const trickRadiusXDisplay = Phaser.Math.Clamp(displayWidth * 0.18, 102, 228)
    const trickTopOffsetYDisplay = Phaser.Math.Clamp(displayHeight * 0.158, 64, 132)
    const trickBottomOffsetYDisplay = Phaser.Math.Clamp(displayHeight * 0.152, 58, 124)

    const dogCardHeightDisplay = Phaser.Math.Clamp(tableCardBaseHeightDisplay * 0.74, 76, 126)
    const dogCardWidthDisplay = dogCardHeightDisplay * GameScene.CARD_ASPECT_RATIO
    const dogLabelYDisplay = (displayHeight / 2) - Phaser.Math.Clamp(displayHeight * 0.19, 64, 96)
    const dogCardsYDisplay = dogLabelYDisplay + Phaser.Math.Clamp(displayHeight * 0.135, 50, 78)
    const dogInfoYDisplay = selfLabelYDisplay - Phaser.Math.Clamp(displayHeight * 0.08, 20, 34)

    const kingCardHeightDisplay = Phaser.Math.Clamp(tableCardBaseHeightDisplay * 0.86, 88, 148)
    const kingCardWidthDisplay = kingCardHeightDisplay * GameScene.CARD_ASPECT_RATIO
    const kingLabelYDisplay = (displayHeight / 2) - Phaser.Math.Clamp(displayHeight * 0.215, 76, 114)
    const kingCardsYDisplay = kingLabelYDisplay + Phaser.Math.Clamp(displayHeight * 0.145, 56, 104)

    const handCardHeight = sy(handCardHeightDisplay)
    const handCardWidth = Math.round(sx(handCardWidthDisplay))
    const opponentCardHeight = sy(opponentCardHeightDisplay)
    const opponentCardWidth = Math.round(sx(opponentCardWidthDisplay))
    const trickCardHeight = sy(trickCardHeightDisplay)
    const trickCardWidth = Math.round(sx(trickCardWidthDisplay))
    const dogCardHeight = sy(dogCardHeightDisplay)
    const dogCardWidth = Math.round(sx(dogCardWidthDisplay))
    const kingCardHeight = sy(kingCardHeightDisplay)
    const kingCardWidth = Math.round(sx(kingCardWidthDisplay))

    return {
      width,
      height,
      centerX,
      centerY,
      padding: ss(paddingDisplay),
      statusY: sy(statusYDisplay),
      statusWidth: sx(statusWidthDisplay),
      statusHeight: sy(statusHeightDisplay),
      statusFontSize: ss(Phaser.Math.Clamp(displayHeight * 0.032, 16, 25)),
      handCardWidth,
      handCardHeight,
      handY: sy(handYDisplay),
      selfLabelY: sy(selfLabelYDisplay),
      selfFontSize: ss(Phaser.Math.Clamp(displayHeight * 0.029, 17, 23)),
      handSpacingMin: Math.round(handCardWidth * 0.34),
      handSpacingMax: Math.round(handCardWidth * 0.42),
      opponentCardWidth,
      opponentCardHeight,
      opponentLabelFontSize: ss(Phaser.Math.Clamp(displayHeight * 0.028, 15, 22)),
      opponentScoreFontSize: ss(Phaser.Math.Clamp(displayHeight * 0.023, 12, 18)),
      topSeatY: sy(topSeatYDisplay),
      topSeatOffsetX: sx(topSeatOffsetXDisplay),
      sideSeatX: sx(sideSeatXDisplay),
      sideSeatY: sy(sideSeatYDisplay),
      trickCardWidth,
      trickCardHeight,
      trickCenterY: sy(trickCenterYDisplay),
      trickRadiusX: sx(trickRadiusXDisplay),
      trickTopOffsetY: sy(trickTopOffsetYDisplay),
      trickBottomOffsetY: sy(trickBottomOffsetYDisplay),
      dogLabelY: sy(dogLabelYDisplay),
      dogCardsY: sy(dogCardsYDisplay),
      dogCardWidth,
      dogCardHeight,
      dogInfoY: sy(dogInfoYDisplay),
      kingLabelY: sy(kingLabelYDisplay),
      kingCardsY: sy(kingCardsYDisplay),
      kingCardWidth,
      kingCardHeight,
      retrieveButtonY: sy(dogInfoYDisplay),
      retrieveButtonWidth: sx(Phaser.Math.Clamp(displayWidth * 0.22, 190, 250)),
      retrieveButtonHeight: sy(Phaser.Math.Clamp(displayHeight * 0.062, 42, 54))
    }
  }

  private toPx(size: number) {
    return `${Math.round(size)}px`
  }

  private getTextResolution() {
    const renderer = this.game.renderer as { resolution?: number }
    return Math.max(1, Math.min(renderer?.resolution ?? 1, 3))
  }

  private addSharpText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle
  ) {
    const textObject = this.add.text(Math.round(x), Math.round(y), text, {
      fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
      padding: { x: 2, y: 1 },
      ...style
    })

    textObject.setResolution(this.getTextResolution())

    return textObject
  }

  private getHandSpacing(cardCount: number) {
    const layout = this.getLayout()

    if (cardCount <= 1) {
      return 0
    }

    const availableWidth = Math.max(layout.width - (layout.padding * 2) - layout.handCardWidth, layout.handCardWidth)
    return Math.min(
      layout.handSpacingMax,
      Math.max(layout.handSpacingMin, Math.floor(availableWidth / (cardCount - 1)))
    )
  }

  private renderTable(options: RenderOptions = {}) {
    this.clearHoveredHandCard()
    this.dynamicObjects.forEach((gameObject) => gameObject.destroy())
    this.dynamicObjects = []
    this.transientObjects.forEach((gameObject) => gameObject.destroy())
    this.transientObjects = []

    if (!this.tableState) {
      return
    }

    this.renderStatusBanner()
    this.renderPlayers()
    this.renderCenterArea(options)
    this.renderPlayerHand()
  }

  private renderStatusBanner() {
    if (!this.tableState) {
      return
    }

    const layout = this.getLayout()
    const banner = this.add.rectangle(layout.centerX, layout.statusY, layout.statusWidth, layout.statusHeight, 0x06150e, 0.75)
      .setStrokeStyle(2, 0xe4cb8a, 0.5)

    const text = this.addSharpText(layout.centerX, layout.statusY, this.tableState.statusText, {
      color: '#f6f0dd',
      fontSize: this.toPx(layout.statusFontSize),
      align: 'center',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)
      .setWordWrapWidth(layout.statusWidth - 28, true)

    this.dynamicObjects.push(banner, text)
  }

  private renderPlayers() {
    if (!this.tableState) {
      return
    }

    const layout = this.getLayout()
    const myself = this.tableState.players.find((player) => player.num === this.tableState?.myPlayerNum)

    if (myself) {
      const selfLabel = this.addSharpText(layout.centerX, layout.selfLabelY, `${myself.pseudo}  ${myself.score.toFixed(1)}`, {
        color: this.getPlayerColor(myself.num),
        fontSize: this.toPx(layout.selfFontSize),
        fontStyle: 'bold'
      }).setOrigin(0.5)

      const badge = this.addTextBadge([selfLabel], Math.max(170, layout.handCardWidth * 2))
      this.dynamicObjects.push(badge, selfLabel)
    }

    this.tableState.players
      .filter((player) => player.num !== this.tableState?.myPlayerNum)
      .forEach((player) => this.renderOpponent(player))
  }

  private renderOpponent(player: TablePlayer) {
    if (!this.tableState) {
      return
    }

    const layout = this.getLayout()
    const seat = this.getSeatKey(player.num)
    const seatConfig = this.getSeatConfig(seat)
    const visibleBacks = Math.min(Math.max(player.handCount, 1), 8)

    for (let index = 0; index < visibleBacks; index += 1) {
      const spread = index - (visibleBacks - 1) / 2
      const card = this.add.image(
        seatConfig.cardX + spread * seatConfig.spreadX,
        seatConfig.cardY + spread * seatConfig.spreadY,
        'cardback'
      )

      card.setDisplaySize(layout.opponentCardWidth, layout.opponentCardHeight)
      card.setRotation(seatConfig.rotation)
      card.setAlpha(0.96)
      this.dynamicObjects.push(card)
    }

    const label = this.addSharpText(seatConfig.labelX, seatConfig.labelY, player.pseudo, {
      color: this.getPlayerColor(player.num),
      fontSize: this.toPx(layout.opponentLabelFontSize),
      fontStyle: 'bold'
    }).setOrigin(0.5)

    const score = this.addSharpText(seatConfig.scoreX, seatConfig.scoreY, `${player.score.toFixed(1)}  ${player.handCount} cartes`, {
      color: '#f1ead9',
      fontSize: this.toPx(layout.opponentScoreFontSize)
    }).setOrigin(0.5)

    const badge = this.addTextBadge([label, score], seatConfig.badgeWidth)
    this.dynamicObjects.push(badge, label, score)
  }

  private addTextBadge(textObjects: Phaser.GameObjects.Text[], minWidth = 0) {
    const bounds = textObjects.map((textObject) => textObject.getBounds())
    const minX = Math.min(...bounds.map((bound) => bound.x))
    const maxX = Math.max(...bounds.map((bound) => bound.right))
    const minY = Math.min(...bounds.map((bound) => bound.y))
    const maxY = Math.max(...bounds.map((bound) => bound.bottom))
    const badge = this.add.rectangle(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      Math.max(minWidth, maxX - minX + 26),
      maxY - minY + 16,
      0x06150e,
      0.62
    ).setStrokeStyle(1, 0xe4cb8a, 0.3)

    badge.setDepth(6)
    textObjects.forEach((textObject) => textObject.setDepth(7))

    return badge
  }

  private renderCenterArea(options: RenderOptions) {
    if (!this.tableState) {
      return
    }

    const layout = this.getLayout()
    const trickAlreadyCollected = Boolean(
      this.tableState.currentPliId &&
      this.tableState.finTour &&
      this.collectedPliIds.has(this.tableState.currentPliId)
    )

    if (!options.suppressTrickCards && !trickAlreadyCollected && this.tableState.currentPliCards.length > 0) {
      this.renderCurrentPliCards(this.tableState.currentPliCards, options.suppressPlayedCardId ?? null)
    }

    if (this.tableState.phase === 'DOG_EXCHANGE') {
      if (!this.tableState.dogRetrieved && this.tableState.dogCards.length > 0) {
        this.renderDogCards('Chien', this.tableState.dogCards)
      } else if (this.isTakerView(this.tableState)) {
        if (this.tableState.discardedDogCards.length > 0) {
          this.renderDogCards('Chien', this.tableState.discardedDogCards, options.suppressDogDiscardedCardId ?? null)
        }
      } else if (this.tableState.dogCards.length > 0) {
        this.renderDogCards('Chien', this.tableState.dogCards)
      }
    }

    if (this.tableState.calledKingColor && !this.tableState.teamsRevealed && this.tableState.phase !== 'CALLING') {
      this.renderCalledKingInfo()
    }

    if (this.tableState.phase === 'CALLING' && this.tableState.kingChoices.length > 0) {
      this.renderKingChoices()
    }

    if (this.tableState.phase === 'DOG_EXCHANGE' && this.tableState.takerNum === this.tableState.myPlayerNum) {
      if (this.tableState.dogRetrieved && this.tableState.dogDiscardCount >= 3) {
        const info = this.addSharpText(layout.centerX, layout.dogInfoY, 'Chien valide', {
          color: '#f5e2ac',
          fontSize: this.toPx(layout.selfFontSize),
          fontStyle: 'bold'
        }).setOrigin(0.5)

        this.dynamicObjects.push(info)
      } else if (this.tableState.dogRetrieved) {
        const info = this.addSharpText(layout.centerX, layout.dogInfoY, `Choisissez ${3 - this.tableState.dogDiscardCount} carte(s) pour le chien`, {
          color: '#f5e2ac',
          fontSize: this.toPx(layout.selfFontSize),
          fontStyle: 'bold'
        }).setOrigin(0.5)

        this.dynamicObjects.push(info)
      }
    }
  }

  private renderCurrentPliCards(cards: CurrentPliCard[], suppressPlayedCardId: number | null) {
    const layout = this.getLayout()

    cards.forEach((playedCard) => {
      if (suppressPlayedCardId && playedCard.card.id === suppressPlayedCardId) {
        return
      }

      const config = this.getTrickPosition(playedCard)
      const cardImage = this.add.image(config.x, config.y, this.getCardKey(playedCard.card))

      cardImage.setDisplaySize(layout.trickCardWidth, layout.trickCardHeight)
      cardImage.setRotation(config.rotation)
      cardImage.setDepth(30)
      this.dynamicObjects.push(cardImage)
    })
  }

  private renderDogCards(title: string, cards: Card[], suppressCardId: number | null = null) {
    const layout = this.getLayout()
    const label = this.addSharpText(layout.centerX, layout.dogLabelY, title, {
      color: '#f3e6bf',
      fontSize: this.toPx(layout.statusFontSize),
      fontStyle: 'bold'
    }).setOrigin(0.5)

    this.dynamicObjects.push(label)

    cards.forEach((card, index) => {
      if (suppressCardId && card.id === suppressCardId) {
        return
      }

      const position = this.getDogCardPosition(index, cards.length)
      const image = this.add.image(position.x, position.y, this.getCardKey(card))
      image.setDisplaySize(layout.dogCardWidth, layout.dogCardHeight)
      image.setDepth(18)
      this.dynamicObjects.push(image)
    })
  }

  private renderKingChoices() {
    if (!this.tableState) {
      return
    }

    const layout = this.getLayout()
    const label = this.addSharpText(layout.centerX, layout.kingLabelY, 'Choisissez un roi', {
      color: '#f3e6bf',
      fontSize: this.toPx(layout.statusFontSize),
      fontStyle: 'bold'
    }).setOrigin(0.5)

    this.dynamicObjects.push(label)

    const maxSpan = Math.min(layout.width * 0.58, 520)
    const spacing = this.tableState.kingChoices.length > 1
      ? Math.min(layout.kingCardWidth + 16, maxSpan / (this.tableState.kingChoices.length - 1))
      : 0
    const firstX = layout.centerX - ((this.tableState.kingChoices.length - 1) * spacing) / 2

    this.tableState.kingChoices.forEach((card, index) => {
      const image = this.add.image(firstX + index * spacing, layout.kingCardsY, this.getCardKey(card))
      image.setDisplaySize(layout.kingCardWidth, layout.kingCardHeight)
      image.setDepth(24)
      image.setInteractive({ useHandCursor: true })

      image.on('pointerover', () => {
        image.setDisplaySize(Math.round(layout.kingCardWidth * 1.06), Math.round(layout.kingCardHeight * 1.06))
        image.setDepth(40)
      })

      image.on('pointerout', () => {
        image.setDisplaySize(layout.kingCardWidth, layout.kingCardHeight)
        image.setDepth(24)
      })

      image.on('pointerdown', () => {
        this.onCallKing?.(card)
      })

      this.dynamicObjects.push(image)
    })
  }

  private renderCalledKingInfo() {
    if (!this.tableState?.calledKingColor) {
      return
    }

    const layout = this.getLayout()
    const normalizedColor = this.tableState.calledKingColor.toUpperCase()
    const colorLabel = this.getCalledKingColorLabel(normalizedColor)
    const cardWidth = Math.round(layout.kingCardWidth * 0.46)
    const cardHeight = Math.round(layout.kingCardHeight * 0.46)
    const bannerY = layout.statusY + (layout.statusHeight / 2) + (cardHeight / 2) + 16

    const label = this.addSharpText(layout.centerX + 14, bannerY, `Roi appele : ${colorLabel}`, {
      color: '#f7e9bc',
      fontSize: this.toPx(Math.max(layout.statusFontSize - 4, 12)),
      fontStyle: 'bold'
    }).setOrigin(0, 0.5)

    const kingCard = this.add.image(
      layout.centerX - (label.width / 2) - (cardWidth / 2),
      bannerY,
      this.getKingCardTextureKey(normalizedColor)
    )
    kingCard.setDisplaySize(cardWidth, cardHeight)
    kingCard.setDepth(15)

    const leftEdge = kingCard.x - (cardWidth / 2) - 12
    const rightEdge = label.x + label.width + 14
    const badge = this.add.rectangle(
      (leftEdge + rightEdge) / 2,
      bannerY,
      rightEdge - leftEdge,
      Math.max(cardHeight + 12, label.height + 16),
      0x06150e,
      0.68
    ).setStrokeStyle(1, 0xe4cb8a, 0.26)

    badge.setDepth(13)
    label.setDepth(16)
    this.dynamicObjects.push(badge, kingCard, label)
  }

  private renderRetrieveDogButton() {
    const layout = this.getLayout()
    const background = this.add.rectangle(
      layout.centerX,
      layout.retrieveButtonY,
      layout.retrieveButtonWidth,
      layout.retrieveButtonHeight,
      0x1c5b2e,
      0.92
    )
      .setStrokeStyle(2, 0xf5d37f, 0.7)
      .setInteractive({ useHandCursor: true })

    const text = this.addSharpText(layout.centerX, layout.retrieveButtonY, 'Recuperer le chien', {
      color: '#fff6d8',
      fontSize: this.toPx(layout.selfFontSize),
      fontStyle: 'bold'
    }).setOrigin(0.5)

    background.on('pointerover', () => {
      background.setFillStyle(0x24763b, 0.96)
    })

    background.on('pointerout', () => {
      background.setFillStyle(0x1c5b2e, 0.92)
    })

    background.on('pointerdown', () => {
      this.onRetrieveDog?.()
    })

    this.dynamicObjects.push(background, text)
  }

  private renderPlayerHand() {
    if (!this.tableState) {
      return
    }

    const layout = this.getLayout()
    const sortedHand = sortHandCards(this.tableState.playerHand)
    const spacing = this.getHandSpacing(sortedHand.length)
    const firstX = layout.centerX - ((sortedHand.length - 1) * spacing) / 2
    const selectableIds = new Set(this.tableState.selectableCardIds)
    const disableAllCards = this.shouldDisableAllHandCards()

    sortedHand.forEach((card, index) => {
      const x = firstX + index * spacing
      const y = layout.handY
      const selectable = selectableIds.has(card.id)
      const baseWidth = layout.handCardWidth
      const baseHeight = layout.handCardHeight
      const baseDepth = 10 + index
      const image = this.add.image(x, y, this.getCardKey(card))

      image.setDisplaySize(baseWidth, baseHeight)
      image.setDepth(baseDepth)

      if (!selectable && (disableAllCards || selectableIds.size > 0)) {
        image.setTint(0xb4bcc4)
      }

      if (selectable) {
        image.setInteractive({ useHandCursor: true })

        image.on('pointerover', () => {
          this.highlightHandCard(image, y, baseWidth, baseHeight, baseDepth)
        })

        image.on('pointerout', () => {
          this.resetSpecificHandCard(image, y, baseWidth, baseHeight, baseDepth)
        })

        image.on('pointerdown', () => {
          this.onCardClick?.(card)
        })
      }

      this.dynamicObjects.push(image)
    })
  }

  private shouldDisableAllHandCards() {
    if (!this.tableState) {
      return false
    }

    if (this.tableState.phase === 'PLAYING') {
      return this.tableState.currentTurn !== this.tableState.myPlayerNum
    }

    if (this.tableState.phase === 'DOG_EXCHANGE') {
      return this.tableState.takerNum !== this.tableState.myPlayerNum || !this.tableState.dogRetrieved
    }

    return false
  }

  private clearHoveredHandCard() {
    this.hoveredHandCard = null
  }

  private highlightHandCard(
    image: Phaser.GameObjects.Image,
    baseY: number,
    baseWidth: number,
    baseHeight: number,
    baseDepth: number
  ) {
    if (this.hoveredHandCard && this.hoveredHandCard.image !== image) {
      this.restoreHandCard(
        this.hoveredHandCard.image,
        this.hoveredHandCard.baseY,
        this.hoveredHandCard.baseWidth,
        this.hoveredHandCard.baseHeight,
        this.hoveredHandCard.baseDepth
      )
    }

    image.setDisplaySize(Math.round(baseWidth * 1.08), Math.round(baseHeight * 1.08))
    image.setY(baseY - Math.round(Math.min(baseHeight * 0.16, 28)))
    image.setDepth(250)

    this.hoveredHandCard = {
      image,
      baseY,
      baseWidth,
      baseHeight,
      baseDepth
    }
  }

  private resetSpecificHandCard(
    image: Phaser.GameObjects.Image,
    baseY: number,
    baseWidth: number,
    baseHeight: number,
    baseDepth: number
  ) {
    this.restoreHandCard(image, baseY, baseWidth, baseHeight, baseDepth)

    if (this.hoveredHandCard?.image === image) {
      this.hoveredHandCard = null
    }
  }

  private restoreHandCard(
    image: Phaser.GameObjects.Image,
    baseY: number,
    baseWidth: number,
    baseHeight: number,
    baseDepth: number
  ) {
    if (!image.scene) {
      return
    }

    image.setDisplaySize(baseWidth, baseHeight)
    image.setY(baseY)
    image.setDepth(baseDepth)
  }

  private isTakerView(state: SceneTableState | null) {
    return Boolean(state && state.takerNum !== null && state.takerNum === state.myPlayerNum)
  }

  private shouldAnimateDogRetrieve(previousState: SceneTableState | null, nextState: SceneTableState) {
    return Boolean(
      previousState &&
      this.isTakerView(nextState) &&
      previousState.phase === 'DOG_EXCHANGE' &&
      !previousState.dogRetrieved &&
      nextState.phase === 'DOG_EXCHANGE' &&
      nextState.dogRetrieved
    )
  }

  private getNewDiscardedDogCard(previousState: SceneTableState | null, nextState: SceneTableState) {
    if (
      !previousState ||
      !this.isTakerView(nextState) ||
      nextState.phase !== 'DOG_EXCHANGE' ||
      nextState.discardedDogCards.length === 0
    ) {
      return null
    }

    const previousDiscardIds = new Set(previousState.discardedDogCards.map((card) => card.id))
    return nextState.discardedDogCards.find((card) => !previousDiscardIds.has(card.id)) ?? null
  }

  private animateDogRetrieve(previousState: SceneTableState, nextState: SceneTableState) {
    if (previousState.dogCards.length === 0) {
      this.renderTable()
      return
    }

    const layout = this.getLayout()
    this.renderTable()

    let completedTweens = 0

    previousState.dogCards.forEach((card, index) => {
      const start = this.getDogCardPosition(index, previousState.dogCards.length)
      const target = this.getRetrievedDogTargetPosition(index, previousState.dogCards.length)
      const animationCard = this.add.image(start.x, start.y, this.getCardKey(card))

      animationCard.setDisplaySize(layout.dogCardWidth, layout.dogCardHeight)
      animationCard.setDepth(220 + index)
      this.transientObjects.push(animationCard)

      this.tweens.add({
        targets: animationCard,
        x: target.x,
        y: target.y,
        alpha: 0.12,
        duration: GameScene.DOG_RETRIEVE_DURATION_MS,
        delay: index * 70,
        ease: 'Cubic.InOut',
        onComplete: () => {
          animationCard.destroy()
          this.transientObjects = this.transientObjects.filter((object) => object !== animationCard)
          completedTweens += 1

          if (completedTweens === previousState.dogCards.length) {
            this.renderTable()
          }
        }
      })
    })
  }

  private animateDogDiscard(previousState: SceneTableState, nextState: SceneTableState, discardedCard: Card) {
    const layout = this.getLayout()
    const discardIndex = nextState.discardedDogCards.findIndex((card) => card.id === discardedCard.id)
    const target = this.getDogCardPosition(
      discardIndex >= 0 ? discardIndex : Math.max(nextState.discardedDogCards.length - 1, 0),
      nextState.discardedDogCards.length
    )
    const origin = this.getHandCardPosition(previousState.playerHand, discardedCard.id)
    const targetWidth = layout.dogCardWidth
    const targetHeight = layout.dogCardHeight

    this.renderTable({ suppressDogDiscardedCardId: discardedCard.id })

    const animationCard = this.add.image(origin.x, origin.y, this.getCardKey(discardedCard))

    animationCard.setDisplaySize(layout.handCardWidth, layout.handCardHeight)
    animationCard.setDepth(260)
    this.transientObjects.push(animationCard)

    const startScaleX = animationCard.scaleX
    const startScaleY = animationCard.scaleY

    this.tweens.add({
      targets: animationCard,
      x: target.x,
      y: target.y,
      scaleX: startScaleX * (targetWidth / layout.handCardWidth),
      scaleY: startScaleY * (targetHeight / layout.handCardHeight),
      duration: GameScene.DOG_DISCARD_DURATION_MS,
      ease: 'Cubic.Out',
      onComplete: () => {
        animationCard.destroy()
        this.transientObjects = this.transientObjects.filter((object) => object !== animationCard)
        this.renderTable()
      }
    })
  }

  private getHandCardPosition(handCards: Card[], cardId: number) {
    const layout = this.getLayout()
    const sortedHand = sortHandCards(handCards)
    const cardIndex = sortedHand.findIndex((card) => card.id === cardId)
    const spacing = this.getHandSpacing(sortedHand.length)
    const firstX = layout.centerX - ((sortedHand.length - 1) * spacing) / 2

    return {
      x: cardIndex >= 0 ? firstX + cardIndex * spacing : layout.centerX,
      y: layout.handY
    }
  }

  private getDogCardPosition(index: number, totalCards: number) {
    const layout = this.getLayout()
    const spacing = totalCards > 1
      ? Math.min(layout.dogCardWidth + 10, Math.min(layout.width * 0.36, 300) / (totalCards - 1))
      : 0
    const firstX = layout.centerX - ((totalCards - 1) * spacing) / 2

    return {
      x: firstX + index * spacing,
      y: layout.dogCardsY
    }
  }

  private getRetrievedDogTargetPosition(index: number, totalCards: number) {
    const layout = this.getLayout()
    const spacing = totalCards > 1
      ? Math.min(layout.dogCardWidth + 12, Math.min(layout.width * 0.42, 360) / (totalCards - 1))
      : 0
    const firstX = layout.centerX - ((totalCards - 1) * spacing) / 2

    return {
      x: firstX + index * spacing,
      y: layout.handY - Math.round(layout.handCardHeight * 0.4)
    }
  }

  private getNewPlayedCard(previousState: SceneTableState | null, nextState: SceneTableState) {
    if (nextState.currentPliCards.length === 0) {
      return null
    }

    const previousCardIds = new Set(previousState?.currentPliCards.map((playedCard) => playedCard.card.id) ?? [])
    return nextState.currentPliCards.find((playedCard) => !previousCardIds.has(playedCard.card.id)) ?? null
  }

  private shouldAnimateTrickCollection(previousState: SceneTableState | null, nextState: SceneTableState) {
    if (!nextState.finTour || !nextState.currentPliId || !nextState.currentPliWinnerNum || nextState.currentPliCards.length === 0) {
      return false
    }

    if (this.collectedPliIds.has(nextState.currentPliId)) {
      return false
    }

    return previousState?.currentPliId !== nextState.currentPliId || !previousState.finTour
  }

  private animatePlayedCard(previousState: SceneTableState | null, nextState: SceneTableState, playedCard: CurrentPliCard) {
    this.renderTable({ suppressPlayedCardId: playedCard.card.id })

    const seat = playedCard.playerNum ? this.getSeatKey(playedCard.playerNum) : 'self'
    const layout = this.getLayout()
    const origin = previousState && playedCard.playerNum === nextState.myPlayerNum
      ? { ...this.getHandCardPosition(previousState.playerHand, playedCard.card.id), rotation: 0 }
      : this.getCardOriginPosition(seat)
    const target = this.getTrickPosition(playedCard)
    const animationCard = this.add.image(origin.x, origin.y, this.getCardKey(playedCard.card))

    animationCard.setDisplaySize(layout.trickCardWidth, layout.trickCardHeight)
    animationCard.setRotation(origin.rotation)
    animationCard.setDepth(320)
    this.transientObjects.push(animationCard)

    this.tweens.add({
      targets: animationCard,
      x: target.x,
      y: target.y,
      angle: Phaser.Math.RadToDeg(target.rotation),
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => {
        animationCard.destroy()
        this.transientObjects = this.transientObjects.filter((object) => object !== animationCard)

        if (this.shouldAnimateTrickCollection(previousState, nextState)) {
          this.renderTable()
          this.scheduleTrickCollection(nextState)
          return
        }

        this.renderTable()
      }
    })
  }

  private scheduleTrickCollection(state: SceneTableState) {
    if (!state.currentPliId || !state.currentPliWinnerNum || state.currentPliCards.length === 0) {
      return
    }

    this.clearPendingTrickCollection()
    this.pendingTrickCollectionPliId = state.currentPliId
    this.pendingTrickCollection = this.time.delayedCall(GameScene.TRICK_COLLECTION_DELAY_MS, () => {
      this.pendingTrickCollection = null
      this.pendingTrickCollectionPliId = null

      if (
        !this.tableState ||
        this.collectedPliIds.has(state.currentPliId as number) ||
        this.tableState.currentPliId !== state.currentPliId ||
        !this.tableState.finTour
      ) {
        return
      }

      this.animateTrickCollection(state)
    })
  }

  private clearPendingTrickCollection() {
    if (this.pendingTrickCollection) {
      this.pendingTrickCollection.remove(false)
      this.pendingTrickCollection = null
    }

    this.pendingTrickCollectionPliId = null
  }

  private animateTrickCollection(state: SceneTableState) {
    if (!state.currentPliWinnerNum || !state.currentPliId) {
      this.renderTable()
      return
    }

    const layout = this.getLayout()
    this.clearPendingTrickCollection()
    this.trickCollectionAnimating = true
    this.trickCollectionAnimatingPliId = state.currentPliId
    this.renderTable({ suppressTrickCards: true })

    const winnerSeat = this.getSeatKey(state.currentPliWinnerNum)
    const destination = this.getCollectDestination(winnerSeat)
    let completedTweens = 0

    state.currentPliCards.forEach((playedCard, index) => {
      const start = this.getTrickPosition(playedCard)
      const animationCard = this.add.image(start.x, start.y, this.getCardKey(playedCard.card))

      animationCard.setDisplaySize(layout.trickCardWidth, layout.trickCardHeight)
      animationCard.setRotation(start.rotation)
      animationCard.setDepth(340 + index)
      this.transientObjects.push(animationCard)

      this.tweens.add({
        targets: animationCard,
        x: destination.x + index * destination.spreadX,
        y: destination.y + index * destination.spreadY,
        angle: Phaser.Math.RadToDeg(destination.rotation),
        scaleX: 0.72,
        scaleY: 0.72,
        alpha: 0.94,
        duration: GameScene.TRICK_COLLECTION_ANIMATION_DURATION_MS,
        ease: 'Cubic.InOut',
        onComplete: () => {
          animationCard.destroy()
          this.transientObjects = this.transientObjects.filter((object) => object !== animationCard)
          completedTweens += 1

          if (completedTweens === state.currentPliCards.length) {
            this.trickCollectionAnimating = false
            this.trickCollectionAnimatingPliId = null
            this.collectedPliIds.add(state.currentPliId as number)
            this.renderTable()
          }
        }
      })
    })
  }

  private getSeatKey(playerNum: number): SeatKey {
    if (!this.tableState) {
      return 'self'
    }

    switch (getRelativePlayerOffset(this.tableState.myPlayerNum, playerNum)) {
      case 1:
        return 'left'
      case 2:
        return 'topLeft'
      case 3:
        return 'topRight'
      case 4:
        return 'right'
      default:
        return 'self'
    }
  }

  private getSeatConfig(seat: SeatKey) {
    const layout = this.getLayout()
    const topLabelY = layout.topSeatY - (layout.opponentCardHeight / 2) - Phaser.Math.Clamp(layout.height * 0.04, 12, 20)
    const sideLabelY = layout.sideSeatY - (layout.opponentCardHeight / 2) - Phaser.Math.Clamp(layout.height * 0.06, 18, 28)
    const scoreOffsetY = Phaser.Math.Clamp(layout.opponentScoreFontSize + 6, 18, 26)
    const badgeWidth = Math.max(150, layout.opponentCardHeight + 42)

    switch (seat) {
      case 'left':
        return {
          cardX: layout.sideSeatX,
          cardY: layout.sideSeatY,
          spreadX: 0,
          spreadY: Math.max(6, Math.round(layout.opponentCardHeight * 0.09)),
          rotation: -Math.PI / 2,
          labelX: layout.sideSeatX,
          labelY: sideLabelY,
          scoreX: layout.sideSeatX,
          scoreY: sideLabelY + scoreOffsetY,
          badgeWidth
        }
      case 'topLeft':
        return {
          cardX: layout.centerX - layout.topSeatOffsetX,
          cardY: layout.topSeatY,
          spreadX: Math.max(8, Math.round(layout.opponentCardWidth * 0.18)),
          spreadY: 0,
          rotation: 0,
          labelX: layout.centerX - layout.topSeatOffsetX,
          labelY: topLabelY,
          scoreX: layout.centerX - layout.topSeatOffsetX,
          scoreY: topLabelY + scoreOffsetY,
          badgeWidth: Math.max(170, layout.opponentCardWidth * 2)
        }
      case 'topRight':
        return {
          cardX: layout.centerX + layout.topSeatOffsetX,
          cardY: layout.topSeatY,
          spreadX: Math.max(8, Math.round(layout.opponentCardWidth * 0.18)),
          spreadY: 0,
          rotation: 0,
          labelX: layout.centerX + layout.topSeatOffsetX,
          labelY: topLabelY,
          scoreX: layout.centerX + layout.topSeatOffsetX,
          scoreY: topLabelY + scoreOffsetY,
          badgeWidth: Math.max(170, layout.opponentCardWidth * 2)
        }
      case 'right':
        return {
          cardX: layout.width - layout.sideSeatX,
          cardY: layout.sideSeatY,
          spreadX: 0,
          spreadY: Math.max(6, Math.round(layout.opponentCardHeight * 0.09)),
          rotation: Math.PI / 2,
          labelX: layout.width - layout.sideSeatX,
          labelY: sideLabelY,
          scoreX: layout.width - layout.sideSeatX,
          scoreY: sideLabelY + scoreOffsetY,
          badgeWidth
        }
      default:
        return {
          cardX: layout.centerX,
          cardY: 0,
          spreadX: 0,
          spreadY: 0,
          rotation: 0,
          labelX: layout.centerX,
          labelY: 0,
          scoreX: layout.centerX,
          scoreY: 0,
          badgeWidth: 0
        }
    }
  }

  private getCardOriginPosition(seat: SeatKey) {
    const layout = this.getLayout()
    const seatConfig = this.getSeatConfig(seat)

    switch (seat) {
      case 'left':
        return { x: seatConfig.cardX + layout.opponentCardHeight * 0.28, y: seatConfig.cardY, rotation: -Math.PI / 2 }
      case 'topLeft':
        return { x: seatConfig.cardX + layout.opponentCardWidth * 0.45, y: seatConfig.cardY + layout.opponentCardHeight * 0.16, rotation: 0 }
      case 'topRight':
        return { x: seatConfig.cardX - layout.opponentCardWidth * 0.45, y: seatConfig.cardY + layout.opponentCardHeight * 0.16, rotation: 0 }
      case 'right':
        return { x: seatConfig.cardX - layout.opponentCardHeight * 0.28, y: seatConfig.cardY, rotation: Math.PI / 2 }
      default:
        return { x: layout.centerX, y: layout.handY, rotation: 0 }
    }
  }

  private getCollectDestination(seat: SeatKey) {
    const layout = this.getLayout()
    const seatConfig = this.getSeatConfig(seat)

    switch (seat) {
      case 'left':
        return { x: seatConfig.cardX + layout.opponentCardHeight * 0.38, y: seatConfig.cardY, spreadX: 0, spreadY: 5, rotation: -Math.PI / 2 }
      case 'topLeft':
        return { x: seatConfig.cardX + layout.opponentCardWidth * 0.28, y: seatConfig.cardY + layout.opponentCardHeight * 0.34, spreadX: 5, spreadY: 0, rotation: 0 }
      case 'topRight':
        return { x: seatConfig.cardX - layout.opponentCardWidth * 0.28, y: seatConfig.cardY + layout.opponentCardHeight * 0.34, spreadX: 5, spreadY: 0, rotation: 0 }
      case 'right':
        return { x: seatConfig.cardX - layout.opponentCardHeight * 0.38, y: seatConfig.cardY, spreadX: 0, spreadY: 5, rotation: Math.PI / 2 }
      default:
        return {
          x: layout.centerX,
          y: layout.handY - Math.round(layout.handCardHeight * 0.72),
          spreadX: Math.max(10, Math.round(layout.handCardWidth * 0.12)),
          spreadY: 0,
          rotation: 0
        }
    }
  }

  private getTrickPosition(playedCard: CurrentPliCard) {
    const layout = this.getLayout()
    const fallbackSpacing = Math.max(48, Math.round(layout.trickCardWidth * 0.7))
    const fallbackX = Array.from({ length: 5 }, (_, index) => {
      return layout.centerX + ((index - 2) * fallbackSpacing)
    })

    if (playedCard.playerNum) {
      return this.getTrickSeatConfig(this.getSeatKey(playedCard.playerNum))
    }

    return { x: fallbackX[playedCard.position - 1] ?? layout.centerX, y: layout.trickCenterY, rotation: 0 }
  }

  private getTrickSeatConfig(seat: SeatKey) {
    const layout = this.getLayout()

    switch (seat) {
      case 'left':
        return { x: layout.centerX - layout.trickRadiusX, y: layout.trickCenterY + Math.round(layout.trickBottomOffsetY * 0.16), rotation: -0.09 }
      case 'topLeft':
        return { x: layout.centerX - Math.round(layout.trickRadiusX * 0.42), y: layout.trickCenterY - layout.trickTopOffsetY, rotation: -0.03 }
      case 'topRight':
        return { x: layout.centerX + Math.round(layout.trickRadiusX * 0.42), y: layout.trickCenterY - layout.trickTopOffsetY, rotation: 0.03 }
      case 'right':
        return { x: layout.centerX + layout.trickRadiusX, y: layout.trickCenterY + Math.round(layout.trickBottomOffsetY * 0.16), rotation: 0.09 }
      default:
        return { x: layout.centerX, y: layout.trickCenterY + layout.trickBottomOffsetY, rotation: 0 }
    }
  }

  private getPlayerColor(playerNum: number) {
    if (!this.tableState) {
      return '#f1ead9'
    }

    if (this.tableState.currentTurn === playerNum) {
      return '#f2a347'
    }

    if (this.tableState.teamsRevealed && this.tableState.takerNum !== null) {
      if (playerNum === this.tableState.takerNum || playerNum === this.tableState.partnerNum) {
        return '#db7660'
      }

      return '#7fb0de'
    }

    return '#f1ead9'
  }

  private getCalledKingColorLabel(color: string) {
    switch (color) {
      case 'COEUR':
        return 'coeur'
      case 'CARREAU':
        return 'carreau'
      case 'TREFLE':
        return 'trefle'
      case 'PIQUE':
        return 'pique'
      default:
        return color.toLowerCase()
    }
  }

  private getKingCardTextureKey(color: string) {
    switch (color) {
      case 'COEUR':
      case 'HEART':
        return 'heart_14'
      case 'CARREAU':
      case 'DIAMOND':
        return 'diamond_14'
      case 'TREFLE':
      case 'CLOVER':
        return 'clover_14'
      case 'PIQUE':
      case 'SPADE':
      default:
        return 'spade_14'
    }
  }

  private getCardKey(card: Card) {
    const color = card.couleur.toLowerCase()
    const value = card.valeur

    switch (color) {
      case 'spade':
      case 'pique':
        return `spade_${value}`
      case 'heart':
      case 'coeur':
        return `heart_${value}`
      case 'diamond':
      case 'carreau':
        return `diamond_${value}`
      case 'clover':
      case 'trefle':
        return `clover_${value}`
      case 'atout':
      case 'bout':
        return `atout_${value}`
      default:
        return 'cardback'
    }
  }
}
