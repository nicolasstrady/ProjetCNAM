import Phaser from 'phaser'
import type { Card, CurrentPliCard, SceneTableState, TablePlayer } from '~/types'
import { getRelativePlayerOffset, sortHandCards } from '~/utils/tarot'

declare const __CARD_ASSET_VERSION__: string

const CARD_ASSET_VERSION =
  typeof __CARD_ASSET_VERSION__ === 'string' && __CARD_ASSET_VERSION__.length > 0
    ? __CARD_ASSET_VERSION__
    : 'dev'
const ROLE_ICON_SINGLE_KEY = 'role-sword'
const ROLE_ICON_CROSSED_KEY = 'role-swords'

interface SceneCallbacks {
  onCardClick?: (card: Card) => void
  onCallKing?: (card: Card) => void
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
}

type SeatKey = 'self' | 'left' | 'topLeft' | 'topRight' | 'right'

export class GameScene extends Phaser.Scene {
  // Real scans are close to 1440x2640, so keep the whole table on that physical ratio.
  private static readonly CARD_ASPECT_RATIO = 0.545
  private static readonly TRICK_COLLECTION_DELAY_MS = 1500
  private static readonly TRICK_COLLECTION_ANIMATION_DURATION_MS = 760
  private static readonly DOG_RETRIEVE_DURATION_MS = 420
  private static readonly DOG_DISCARD_DURATION_MS = 320
  private static readonly HAND_HOVER_ANIMATION_DURATION_MS = 150

  private dynamicObjects: Phaser.GameObjects.GameObject[] = []
  private transientObjects: Phaser.GameObjects.GameObject[] = []
  private tableState: SceneTableState | null = null
  private collectedPliIds = new Set<number>()
  private pendingTrickCollection: Phaser.Time.TimerEvent | null = null
  private pendingTrickCollectionPliId: number | null = null
  private trickCollectionAnimating = false
  private trickCollectionAnimatingPliId: number | null = null
  private visualTransitionDepth = 0
  private queuedTableState: SceneTableState | null = null
  private queuedTableStateSignature = ''
  private hoveredHandCard: {
    image: Phaser.GameObjects.Image
    baseY: number
    baseWidth: number
    baseHeight: number
    baseDepth: number
  } | null = null
  private onCardClick?: (card: Card) => void
  private onCallKing?: (card: Card) => void
  private sceneReady = false
  private backgroundImage?: Phaser.GameObjects.Image
  private tableBorder?: Phaser.GameObjects.Rectangle
  private tableStateSignature = ''
  private pendingCardTextureLoads = new Set<string>()
  private pendingCardTextureCallbacks = new Map<string, Array<() => void>>()
  private pendingTextureRender: Phaser.Time.TimerEvent | null = null
  private turnPopupObjects: Phaser.GameObjects.GameObject[] = []
  private turnPopupTimer: Phaser.Time.TimerEvent | null = null

  constructor() {
    super({ key: 'GameScene' })
  }

  init(data: SceneCallbacks) {
    this.onCardClick = data.onCardClick
    this.onCallKing = data.onCallKing
  }

  preload() {
    this.load.image('cardback', this.versionAssetPath('/cards/cardback.png'))
    this.load.image('background', this.versionAssetPath('/background.jpg'))
    this.load.image(ROLE_ICON_SINGLE_KEY, this.versionAssetPath('/icons/roles/sword.png'))
    this.load.image(ROLE_ICON_CROSSED_KEY, this.versionAssetPath('/icons/roles/swords.png'))
  }

  create() {
    this.createBackdrop()
    this.scale.on('resize', this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this)
      this.pendingTextureRender?.remove(false)
      this.hideTurnPopup()
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

    this.updateBackdropLayout()
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    this.cameras.resize(gameSize.width, gameSize.height)
    this.updateBackdropLayout()

    if (!this.sceneReady || this.isVisualSequenceLocked()) {
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
  }

  setTableState(state: SceneTableState) {
    const nextState = this.cloneState(state)
    const nextSignature = this.getStateSignature(nextState)

    if (this.isVisualSequenceLocked()) {
      if (this.tableStateSignature !== nextSignature && this.queuedTableStateSignature !== nextSignature) {
        this.queueTableState(nextState, nextSignature)
      }
      return
    }

    const previousState = this.tableState ? this.cloneState(this.tableState) : null

    if (this.tableStateSignature === nextSignature) {
      this.tableState = nextState
      this.updateTurnPopup(previousState, nextState)
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
      this.animateDogRetrieve(previousState as SceneTableState)
      return
    }

    const newDiscardedDogCard = this.getNewDiscardedDogCard(previousState, nextState)
    if (newDiscardedDogCard) {
      this.animateDogDiscard(previousState as SceneTableState, nextState, newDiscardedDogCard)
      return
    }

    const newPlayedCards = this.getNewPlayedCards(previousState, nextState)
    if (newPlayedCards.length > 0) {
      const stagedState = this.getPlayedCardAnimationState(previousState, nextState, newPlayedCards[0])
      const stagedSignature = this.getStateSignature(stagedState)

      if (stagedSignature !== nextSignature) {
        this.queueTableState(nextState, nextSignature)
        this.tableState = stagedState
        this.tableStateSignature = stagedSignature
      }

      this.animatePlayedCard(previousState, this.tableState as SceneTableState, newPlayedCards[0])
      return
    }

    if (this.shouldAnimateTrickCollection(previousState, nextState)) {
      this.animateTrickCollection(nextState)
      return
    }

    this.renderTable()
    this.updateTurnPopup(previousState, nextState)
  }

  private isVisualSequenceLocked() {
    return this.visualTransitionDepth > 0 ||
      this.pendingTrickCollection !== null ||
      this.trickCollectionAnimating ||
      this.trickCollectionAnimatingPliId !== null
  }

  private queueTableState(state: SceneTableState, signature = this.getStateSignature(state)) {
    this.queuedTableState = this.cloneState(state)
    this.queuedTableStateSignature = signature
    this.hideTurnPopup()
  }

  private flushQueuedTableState() {
    if (!this.queuedTableState) {
      return false
    }

    const queuedState = this.queuedTableState
    this.queuedTableState = null
    this.queuedTableStateSignature = ''
    this.setTableState(queuedState)
    return true
  }

  private beginVisualTransition() {
    this.visualTransitionDepth += 1
    this.hideTurnPopup()
  }

  private finishVisualTransition() {
    this.visualTransitionDepth = Math.max(0, this.visualTransitionDepth - 1)
  }

  private updateTurnPopup(previousState: SceneTableState | null, nextState: SceneTableState) {
    if (this.isVisualSequenceLocked()) {
      this.hideTurnPopup()
      return
    }

    if (this.shouldShowTurnPopup(previousState, nextState)) {
      this.showTurnPopup()
    } else if (!this.isOwnPlayableTurn(nextState)) {
      this.hideTurnPopup()
    }
  }

  private shouldShowTurnPopup(previousState: SceneTableState | null, nextState: SceneTableState) {
    if (!this.isOwnPlayableTurn(nextState)) {
      return false
    }

    return !previousState
      || previousState.phase !== 'PLAYING'
      || previousState.finTour
      || previousState.currentTurn !== nextState.myPlayerNum
      || previousState.currentPliId !== nextState.currentPliId
      || (previousState.selectableCardIds.length === 0 && nextState.selectableCardIds.length > 0)
  }

  private isOwnPlayableTurn(state: SceneTableState) {
    return state.phase === 'PLAYING' && !state.finTour && state.currentTurn === state.myPlayerNum
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
      playerHand: state.playerHand.map((card) => card.id),
      players: state.players.map((player) => [player.num, player.handCount, player.pseudo]),
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

    const tableCardBaseHeightDisplay = Phaser.Math.Clamp(displayHeight * 0.238, 98, 182)
    const handCardHeightDisplay = Phaser.Math.Clamp(displayHeight * 0.4, 168, 320)
    const handCardWidthDisplay = handCardHeightDisplay * GameScene.CARD_ASPECT_RATIO
    const handYDisplay = displayHeight + (handCardHeightDisplay * 0.05)
    const selfLabelYDisplay = handYDisplay - (handCardHeightDisplay / 2) - Phaser.Math.Clamp(displayHeight * 0.055, 22, 38)

    const opponentCardHeightDisplay = Phaser.Math.Clamp(tableCardBaseHeightDisplay * 0.72, 68, 118)
    const opponentCardWidthDisplay = opponentCardHeightDisplay * GameScene.CARD_ASPECT_RATIO
    const topSeatYDisplay = paddingDisplay + (opponentCardHeightDisplay / 2) + Phaser.Math.Clamp(displayHeight * 0.09, 52, 82)
    const topSeatOffsetXDisplay = Math.min(
      Phaser.Math.Clamp(displayWidth * 0.29, 150, 340),
      Math.max((displayWidth / 2) - paddingDisplay - (opponentCardWidthDisplay * 1.08), 126)
    )
    const sideSeatXDisplay = paddingDisplay + (opponentCardHeightDisplay / 2) + Phaser.Math.Clamp(displayWidth * 0.032, 24, 44)
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
      kingCardHeight
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

    this.renderPlayers()
    this.renderCenterArea(options)
    this.renderPlayerHand()
  }

  private renderPlayers() {
    if (!this.tableState) {
      return
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
      color: '#f1ead9',
      fontSize: this.toPx(layout.opponentLabelFontSize),
      fontStyle: 'bold'
    }).setOrigin(0.5)

    const badge = this.addTextBadge(
      [label],
      seatConfig.badgeWidth,
      this.tableState.currentTurn === player.num
    )
    this.dynamicObjects.push(badge, label)

    const opponentRoleIcon = this.getPlayerRoleIcon(player.num)
    if (opponentRoleIcon) {
      const iconSize = layout.opponentLabelFontSize
      const labelBounds = label.getBounds()
      const icons = this.renderSwordIcon(labelBounds.x - iconSize * 0.72, seatConfig.labelY, iconSize, opponentRoleIcon)
      this.dynamicObjects.push(...icons)
    }
  }

  private addTextBadge(textObjects: Phaser.GameObjects.Text[], minWidth = 0, active = false) {
    const bounds = textObjects.map((textObject) => textObject.getBounds())
    const minX = Math.min(...bounds.map((bound) => bound.x))
    const maxX = Math.max(...bounds.map((bound) => bound.right))
    const minY = Math.min(...bounds.map((bound) => bound.y))
    const maxY = Math.max(...bounds.map((bound) => bound.bottom))
    const width = Math.max(minWidth, maxX - minX + 26)
    const height = maxY - minY + 16
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    if (active) {
      const glow = this.add.rectangle(
        centerX,
        centerY,
        width + 16,
        height + 12,
        0xf5d37f,
        0.18
      ).setStrokeStyle(1, 0xf8df9a, 0.3)

      glow.setDepth(4)
      this.dynamicObjects.push(glow)
    }

    const badge = this.add.rectangle(
      centerX,
      centerY,
      width,
      height,
      active ? 0x856018 : 0x06150e,
      active ? 0.94 : 0.62
    ).setStrokeStyle(active ? 3 : 1, active ? 0xffedb0 : 0xe4cb8a, active ? 1 : 0.3)

    badge.setDepth(6)
    textObjects.forEach((textObject) => textObject.setDepth(7))

    return badge
  }

  private showTurnPopup() {
    this.hideTurnPopup()

    const layout = this.getLayout()
    const popupY = Math.max(
      layout.padding + 44,
      layout.handY - (layout.handCardHeight / 2) - Phaser.Math.Clamp(layout.height * 0.078, 44, 70)
    )

    const text = this.addSharpText(layout.centerX, popupY, 'À vous de jouer', {
      color: '#1b1202',
      fontSize: this.toPx(Math.max(layout.statusFontSize, 18)),
      fontStyle: 'bold'
    }).setOrigin(0.5)

    const width = Math.max(230, text.width + 52)
    const height = Math.max(48, text.height + 22)
    const background = this.add.rectangle(layout.centerX, popupY, width, height, 0xf5d37f, 0.94)
      .setStrokeStyle(2, 0xfff1bd, 0.9)

    background.setDepth(360)
    text.setDepth(361)
    background.setAlpha(0)
    text.setAlpha(0)
    background.setScale(0.96)
    text.setScale(0.96)

    this.turnPopupObjects = [background, text]

    this.tweens.add({
      targets: this.turnPopupObjects,
      alpha: 1,
      scale: 1,
      duration: 120,
      ease: 'Quad.Out'
    })

    this.turnPopupTimer = this.time.delayedCall(1250, () => {
      this.tweens.add({
        targets: this.turnPopupObjects,
        alpha: 0,
        duration: 220,
        ease: 'Quad.In',
        onComplete: () => this.hideTurnPopup()
      })
    })
  }

  private hideTurnPopup() {
    if (this.turnPopupTimer) {
      this.turnPopupTimer.remove(false)
      this.turnPopupTimer = null
    }

    if (this.turnPopupObjects.length === 0) {
      return
    }

    this.tweens.killTweensOf(this.turnPopupObjects)
    this.turnPopupObjects.forEach((gameObject) => gameObject.destroy())
    this.turnPopupObjects = []
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
      const cardImage = this.addCardImage(config.x, config.y, playedCard.card)

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
      const image = this.addCardImage(position.x, position.y, card)
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
      const image = this.addCardImage(firstX + index * spacing, layout.kingCardsY, card)
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
    const cardWidth = Math.round(layout.kingCardWidth * 0.52)
    const cardHeight = Math.round(layout.kingCardHeight * 0.52)
    const inset = Math.max(10, Math.round(layout.padding * 0.55))
    const kingCard = this.add.image(
      layout.padding + inset + (cardWidth / 2),
      layout.padding + inset + (cardHeight / 2),
      this.getKingCardTextureKey(normalizedColor)
    )
    kingCard.setDisplaySize(cardWidth, cardHeight)
    kingCard.setDepth(15)

    this.dynamicObjects.push(kingCard)
  }

  private renderPlayerHand() {
    if (!this.tableState) {
      return
    }

    const layout = this.getLayout()
    const sortedHand = sortHandCards(this.getVisibleHandCards(this.tableState))
    const spacing = this.getHandSpacing(sortedHand.length)
    const firstX = layout.centerX - ((sortedHand.length - 1) * spacing) / 2
    const selectableIds = new Set(this.tableState.selectableCardIds)
    const disableAllCards = this.shouldDisableAllHandCards()
    const showPlayability = this.shouldShowHandPlayability()

    sortedHand.forEach((card, index) => {
      const x = firstX + index * spacing
      const y = layout.handY
      const selectable = selectableIds.has(card.id)
      const canInteract = selectable && !disableAllCards
      const shouldDim = disableAllCards || (!selectable && showPlayability)
      const baseWidth = layout.handCardWidth
      const baseHeight = layout.handCardHeight
      const baseDepth = 10 + index
      const image = this.addCardImage(x, y, card)

      image.setDisplaySize(baseWidth, baseHeight)
      image.setDepth(baseDepth)

      if (shouldDim) {
        image.setTint(0xb4bcc4)
      }

      if (canInteract) {
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

    if (this.isVisualSequenceLocked()) {
      return true
    }

    if (this.tableState.phase === 'PLAYING') {
      return this.tableState.currentTurn !== this.tableState.myPlayerNum
    }

    if (this.tableState.phase === 'DOG_EXCHANGE') {
      return this.tableState.takerNum !== this.tableState.myPlayerNum || !this.tableState.dogRetrieved
    }

    return false
  }

  private shouldShowHandPlayability() {
    if (!this.tableState) {
      return false
    }

    if (this.tableState.phase === 'PLAYING') {
      return this.tableState.currentTurn === this.tableState.myPlayerNum && !this.tableState.finTour
    }

    if (this.tableState.phase === 'DOG_EXCHANGE') {
      return this.tableState.takerNum === this.tableState.myPlayerNum &&
        this.tableState.dogRetrieved &&
        this.tableState.dogDiscardCount < 3
    }

    return false
  }

  private getVisibleHandCards(state: SceneTableState) {
    if (state.phase !== 'DOG_EXCHANGE' || state.takerNum !== state.myPlayerNum || state.discardedDogCards.length === 0) {
      return state.playerHand
    }

    const discardedDogCardIds = new Set(state.discardedDogCards.map((card) => card.id))
    return state.playerHand.filter((card) => !discardedDogCardIds.has(card.id))
  }

  private clearHoveredHandCard() {
    if (this.hoveredHandCard?.image.scene) {
      this.tweens.killTweensOf(this.hoveredHandCard.image)
    }

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

    this.tweens.killTweensOf(image)
    image.setDepth(250)
    this.tweens.add({
      targets: image,
      y: baseY - Math.round(Math.min(baseHeight * 0.16, 28)),
      displayWidth: Math.round(baseWidth * 1.08),
      displayHeight: Math.round(baseHeight * 1.08),
      duration: GameScene.HAND_HOVER_ANIMATION_DURATION_MS,
      ease: 'Cubic.Out'
    })

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

    this.tweens.killTweensOf(image)
    image.setDepth(250)
    this.tweens.add({
      targets: image,
      y: baseY,
      displayWidth: baseWidth,
      displayHeight: baseHeight,
      duration: GameScene.HAND_HOVER_ANIMATION_DURATION_MS,
      ease: 'Cubic.Out',
      onComplete: () => {
        if (!image.scene) {
          return
        }

        image.setDisplaySize(baseWidth, baseHeight)
        image.setY(baseY)
        image.setDepth(baseDepth)
      }
    })
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

  private animateDogRetrieve(previousState: SceneTableState) {
    if (previousState.dogCards.length === 0) {
      this.renderTable()
      return
    }

    const layout = this.getLayout()
    this.beginVisualTransition()
    this.renderTable()

    let completedTweens = 0

    previousState.dogCards.forEach((card, index) => {
      const start = this.getDogCardPosition(index, previousState.dogCards.length)
      const target = this.getRetrievedDogTargetPosition(index, previousState.dogCards.length)
      const animationCard = this.addCardImage(start.x, start.y, card)

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
            this.finishVisualTransition()
            if (this.flushQueuedTableState()) {
              return
            }

            this.renderTable()
            if (this.tableState) {
              this.updateTurnPopup(previousState, this.tableState)
            }
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
    const origin = this.getHandCardPosition(previousState.playerHand, discardedCard.id, previousState)
    const targetWidth = layout.dogCardWidth
    const targetHeight = layout.dogCardHeight

    this.beginVisualTransition()
    this.renderTable({ suppressDogDiscardedCardId: discardedCard.id })

    const animationCard = this.addCardImage(origin.x, origin.y, discardedCard)

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
        this.finishVisualTransition()
        if (this.flushQueuedTableState()) {
          return
        }

        this.renderTable()
        this.updateTurnPopup(previousState, nextState)
      }
    })
  }

  private getHandCardPosition(handCards: Card[], cardId: number, state?: SceneTableState | null) {
    const layout = this.getLayout()
    const visibleHandCards = state
      ? this.getVisibleHandCards({ ...state, playerHand: handCards })
      : handCards
    const sortedHand = sortHandCards(visibleHandCards)
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

  private getNewPlayedCards(previousState: SceneTableState | null, nextState: SceneTableState) {
    if (nextState.currentPliCards.length === 0) {
      return []
    }

    const previousCardIds = new Set(previousState?.currentPliCards.map((playedCard) => playedCard.card.id) ?? [])
    return nextState.currentPliCards.filter((playedCard) => !previousCardIds.has(playedCard.card.id))
  }

  private getPlayedCardAnimationState(
    previousState: SceneTableState | null,
    nextState: SceneTableState,
    playedCard: CurrentPliCard
  ) {
    const previousCardIds = new Set(previousState?.currentPliCards.map((currentPliCard) => currentPliCard.card.id) ?? [])
    const stagedPliCards: CurrentPliCard[] = []

    for (const currentPliCard of nextState.currentPliCards) {
      stagedPliCards.push(currentPliCard)

      if (!previousCardIds.has(currentPliCard.card.id) && currentPliCard.card.id === playedCard.card.id) {
        break
      }
    }

    const includesFullPli = stagedPliCards.length === nextState.currentPliCards.length

    return {
      ...nextState,
      currentTurn: includesFullPli ? nextState.currentTurn : null,
      currentPliWinnerNum: includesFullPli ? nextState.currentPliWinnerNum : null,
      finTour: includesFullPli ? nextState.finTour : false,
      currentPliCards: stagedPliCards,
      selectableCardIds: includesFullPli ? nextState.selectableCardIds : []
    }
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
    const textureKey = this.getCardKey(playedCard.card)
    this.beginVisualTransition()

    if (!this.textures.exists(textureKey)) {
      this.renderTable({ suppressPlayedCardId: playedCard.card.id })
      this.queueCardTextureLoad(textureKey, this.getVersionedCardTexturePath(playedCard.card), () => {
        if (!this.sceneReady || this.trickCollectionAnimating) {
          this.finishVisualTransition()
          return
        }

        if (!this.textures.exists(textureKey)) {
          this.finishVisualTransition()
          if (this.flushQueuedTableState()) {
            return
          }

          this.renderTable()
          this.updateTurnPopup(previousState, nextState)
          return
        }

        this.runPlayedCardAnimation(previousState, nextState, playedCard, textureKey)
      })
      return
    }

    this.runPlayedCardAnimation(previousState, nextState, playedCard, textureKey)
  }

  private runPlayedCardAnimation(
    previousState: SceneTableState | null,
    nextState: SceneTableState,
    playedCard: CurrentPliCard,
    textureKey: string
  ) {
    this.renderTable({ suppressPlayedCardId: playedCard.card.id })

    const seat = playedCard.playerNum ? this.getSeatKey(playedCard.playerNum) : 'self'
    const layout = this.getLayout()
    const origin = previousState && playedCard.playerNum === nextState.myPlayerNum
      ? { ...this.getHandCardPosition(previousState.playerHand, playedCard.card.id, previousState), rotation: 0 }
      : this.getCardOriginPosition(seat)
    const target = this.getTrickPosition(playedCard)
    const animationCard = this.add.image(origin.x, origin.y, textureKey)
    const startWidth = seat === 'self' ? layout.handCardWidth : layout.opponentCardWidth
    const startHeight = seat === 'self' ? layout.handCardHeight : layout.opponentCardHeight
    const settleWidth = Math.round(layout.trickCardWidth * 1.035)
    const settleHeight = Math.round(layout.trickCardHeight * 1.035)

    animationCard.setDisplaySize(startWidth, startHeight)
    animationCard.setRotation(origin.rotation)
    animationCard.setDepth(320)
    this.transientObjects.push(animationCard)

    const finishAnimation = () => {
      animationCard.destroy()
      this.transientObjects = this.transientObjects.filter((object) => object !== animationCard)
      this.finishVisualTransition()

      if (this.shouldAnimateTrickCollection(previousState, nextState)) {
        this.renderTable()
        this.scheduleTrickCollection(nextState)
        return
      }

      if (this.flushQueuedTableState()) {
        return
      }

      this.renderTable()
      this.updateTurnPopup(previousState, nextState)
    }

    this.tweens.add({
      targets: animationCard,
      x: target.x,
      y: target.y,
      angle: Phaser.Math.RadToDeg(target.rotation),
      displayWidth: settleWidth,
      displayHeight: settleHeight,
      duration: 330,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.tweens.add({
          targets: animationCard,
          displayWidth: layout.trickCardWidth,
          displayHeight: layout.trickCardHeight,
          duration: 95,
          ease: 'Sine.Out',
          onComplete: finishAnimation
        })
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
    this.beginVisualTransition()
    this.renderTable({ suppressTrickCards: true })

    const winnerSeat = this.getSeatKey(state.currentPliWinnerNum)
    const destination = this.getCollectDestination(winnerSeat)
    let completedTweens = 0

    state.currentPliCards.forEach((playedCard, index) => {
      const start = this.getTrickPosition(playedCard)
      const animationCard = this.addCardImage(start.x, start.y, playedCard.card)

      animationCard.setDisplaySize(layout.trickCardWidth, layout.trickCardHeight)
      animationCard.setRotation(start.rotation)
      animationCard.setDepth(340 + index)
      this.transientObjects.push(animationCard)

      this.tweens.add({
        targets: animationCard,
        x: destination.x + index * destination.spreadX,
        y: destination.y + index * destination.spreadY,
        angle: Phaser.Math.RadToDeg(destination.rotation),
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
            this.finishVisualTransition()

            if (this.flushQueuedTableState()) {
              return
            }

            this.renderTable()
            if (this.tableState) {
              this.updateTurnPopup(null, this.tableState)
            }
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
    const topLabelY = layout.topSeatY - (layout.opponentCardHeight / 2) - Phaser.Math.Clamp(layout.height * 0.065, 30, 48)
    const sideLabelY = layout.sideSeatY - (layout.opponentCardHeight / 2) - Phaser.Math.Clamp(layout.height * 0.08, 36, 56)
    const badgeWidth = Math.max(118, layout.opponentCardHeight + 26)

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
          badgeWidth: Math.max(132, layout.opponentCardWidth * 2)
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
          badgeWidth: Math.max(132, layout.opponentCardWidth * 2)
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

  private getPlayerRoleIcon(playerNum: number): 'crossed' | 'single' | null {
    if (!this.tableState || this.tableState.takerNum === null) {
      return null
    }

    if (playerNum === this.tableState.takerNum) {
      return 'crossed'
    }

    if (
      this.tableState.teamsRevealed &&
      this.tableState.partnerNum !== null &&
      playerNum === this.tableState.partnerNum &&
      playerNum !== this.tableState.takerNum
    ) {
      return 'single'
    }

    return null
  }

  private renderSwordIcon(
    x: number,
    y: number,
    size: number,
    type: 'crossed' | 'single'
  ): Phaser.GameObjects.Image[] {
    const textureKey = type === 'crossed' ? ROLE_ICON_CROSSED_KEY : ROLE_ICON_SINGLE_KEY

    if (!this.textures.exists(textureKey)) {
      return []
    }

    const icon = this.add.image(x, y, textureKey)
    const displaySize = size * 1.35
    icon.setDisplaySize(displaySize, displaySize)
    icon.setAlpha(0.96)
    icon.setDepth(8)

    return [icon]
  }

  private addCardImage(x: number, y: number, card: Card) {
    return this.add.image(x, y, this.getRenderableCardKey(card))
  }

  private getRenderableCardKey(card: Card) {
    const key = this.getCardKey(card)

    if (this.textures.exists(key)) {
      return key
    }

    this.queueCardTextureLoad(key, this.getVersionedCardTexturePath(card))
    return 'cardback'
  }

  private getRenderableTextureKey(key: string, path: string) {
    if (this.textures.exists(key)) {
      return key
    }

    this.queueCardTextureLoad(key, this.versionAssetPath(path))
    return 'cardback'
  }

  private queueCardTextureLoad(key: string, path: string, onComplete?: () => void) {
    if (this.textures.exists(key)) {
      onComplete?.()
      return
    }

    if (onComplete) {
      const callbacks = this.pendingCardTextureCallbacks.get(key) ?? []
      callbacks.push(onComplete)
      this.pendingCardTextureCallbacks.set(key, callbacks)
    }

    if (this.pendingCardTextureLoads.has(key)) {
      return
    }

    this.pendingCardTextureLoads.add(key)
    const onLoadError = (file: { key?: string }) => {
      if (file.key !== key) {
        return
      }

      this.pendingCardTextureLoads.delete(key)
      this.pendingCardTextureCallbacks.delete(key)
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError)
    }

    this.load.image(key, path)
    this.load.once(`filecomplete-image-${key}`, () => {
      this.pendingCardTextureLoads.delete(key)
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError)
      const callbacks = this.pendingCardTextureCallbacks.get(key) ?? []
      this.pendingCardTextureCallbacks.delete(key)

      if (callbacks.length > 0) {
        callbacks.forEach((callback) => callback())
      } else {
        this.scheduleRenderAfterTextureLoad()
      }
    })
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError)

    if (!this.load.isLoading()) {
      this.load.start()
    }
  }

  private scheduleRenderAfterTextureLoad() {
    if (!this.sceneReady || this.isVisualSequenceLocked() || this.pendingTextureRender) {
      return
    }

    this.pendingTextureRender = this.time.delayedCall(40, () => {
      this.pendingTextureRender = null

      if (this.sceneReady && !this.isVisualSequenceLocked()) {
        this.renderTable()
      }
    })
  }

  private getKingCardTextureKey(color: string) {
    switch (color) {
      case 'COEUR':
      case 'HEART':
        return this.getRenderableTextureKey('heart_14', '/cards/Heart/card_14_heart.png')
      case 'CARREAU':
      case 'DIAMOND':
        return this.getRenderableTextureKey('diamond_14', '/cards/Diamond/card_14_diamond.png')
      case 'TREFLE':
      case 'CLOVER':
        return this.getRenderableTextureKey('clover_14', '/cards/Clover/card_14_clover.png')
      case 'PIQUE':
      case 'SPADE':
      default:
        return this.getRenderableTextureKey('spade_14', '/cards/Spade/card_14_spade.png')
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

  private getVersionedCardTexturePath(card: Card) {
    return this.versionAssetPath(this.getCardTexturePath(card))
  }

  private getCardTexturePath(card: Card) {
    if (card.lien) {
      return `/${card.lien.replace(/^\/+/, '')}`
    }

    const key = this.getCardKey(card)
    const [color, value] = key.split('_')

    switch (color) {
      case 'spade':
        return `/cards/Spade/card_${value}_spade.png`
      case 'heart':
        return `/cards/Heart/card_${value}_heart.png`
      case 'diamond':
        return `/cards/Diamond/card_${value}_diamond.png`
      case 'clover':
        return `/cards/Clover/card_${value}_clover.png`
      case 'atout':
        return `/cards/Atout/card_${value}_atout.png`
      default:
        return '/cards/cardback.png'
    }
  }

  private versionAssetPath(path: string) {
    const separator = path.includes('?') ? '&' : '?'
    return `${path}${separator}v=${encodeURIComponent(CARD_ASSET_VERSION)}`
  }
}
