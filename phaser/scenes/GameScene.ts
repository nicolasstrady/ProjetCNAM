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

type SeatKey = 'self' | 'left' | 'topLeft' | 'topRight' | 'right'

export class GameScene extends Phaser.Scene {
  private static readonly TRICK_COLLECTION_DELAY_MS = 1200
  private static readonly DOG_RETRIEVE_DURATION_MS = 420
  private static readonly DOG_DISCARD_DURATION_MS = 320

  private dynamicObjects: Phaser.GameObjects.GameObject[] = []
  private transientObjects: Phaser.GameObjects.GameObject[] = []
  private tableState: SceneTableState | null = null
  private collectedPliIds = new Set<number>()
  private pendingTrickCollection: Phaser.Time.TimerEvent | null = null
  private pendingTrickCollectionPliId: number | null = null
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
    const background = this.add.image(600, 400, 'background')
    background.setDisplaySize(1200, 800)
    background.setAlpha(0.32)

    this.add.rectangle(600, 400, 1160, 760, 0x042b16, 0.22).setStrokeStyle(2, 0xd2b36b, 0.35)
    this.add.ellipse(600, 390, 520, 290, 0x082f1c, 0.22).setStrokeStyle(2, 0xe7d29b, 0.22)

    this.sceneReady = true
    this.renderTable()
  }

  setTableState(state: SceneTableState) {
    const previousState = this.tableState ? this.cloneState(this.tableState) : null
    const nextState = this.cloneState(state)

    if (
      this.pendingTrickCollection &&
      (nextState.currentPliId !== this.pendingTrickCollectionPliId || !nextState.finTour)
    ) {
      this.clearPendingTrickCollection()
    }

    this.tableState = nextState

    if (!this.sceneReady) {
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

    const banner = this.add.rectangle(600, 48, 540, 52, 0x06150e, 0.75).setStrokeStyle(2, 0xe4cb8a, 0.5)
    const text = this.add.text(600, 48, this.tableState.statusText, {
      color: '#f6f0dd',
      fontFamily: 'Georgia',
      fontSize: '24px',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    this.dynamicObjects.push(banner, text)
  }

  private renderPlayers() {
    if (!this.tableState) {
      return
    }

    const myself = this.tableState.players.find((player) => player.num === this.tableState?.myPlayerNum)

    if (myself) {
      const selfLabel = this.add.text(600, 558, `${myself.pseudo}  ${myself.score.toFixed(1)}`, {
        color: this.getPlayerColor(myself.num),
        fontFamily: 'Georgia',
        fontSize: '22px',
        fontStyle: 'bold'
      }).setOrigin(0.5)

      const badge = this.addTextBadge([selfLabel], 220)
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

      card.setDisplaySize(70, 108)
      card.setRotation(seatConfig.rotation)
      card.setAlpha(0.96)
      this.dynamicObjects.push(card)
    }

    const label = this.add.text(seatConfig.labelX, seatConfig.labelY, player.pseudo, {
      color: this.getPlayerColor(player.num),
      fontFamily: 'Georgia',
      fontSize: '22px',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    const score = this.add.text(seatConfig.scoreX, seatConfig.scoreY, `${player.score.toFixed(1)}  ${player.handCount} cartes`, {
      color: '#f1ead9',
      fontFamily: 'Georgia',
      fontSize: '18px'
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

    if (this.tableState.phase === 'CALLING' && this.tableState.kingChoices.length > 0) {
      this.renderKingChoices()
    }

    if (this.tableState.phase === 'DOG_EXCHANGE' && this.tableState.takerNum === this.tableState.myPlayerNum) {
      if (!this.tableState.dogRetrieved) {
        this.renderRetrieveDogButton()
      } else if (this.tableState.dogDiscardCount >= 3) {
        const info = this.add.text(600, 505, 'Chien valide', {
          color: '#f5e2ac',
          fontFamily: 'Georgia',
          fontSize: '22px',
          fontStyle: 'bold'
        }).setOrigin(0.5)

        this.dynamicObjects.push(info)
      } else {
        const info = this.add.text(600, 505, `Choisissez ${3 - this.tableState.dogDiscardCount} carte(s) pour le chien`, {
          color: '#f5e2ac',
          fontFamily: 'Georgia',
          fontSize: '22px',
          fontStyle: 'bold'
        }).setOrigin(0.5)

        this.dynamicObjects.push(info)
      }
    }
  }

  private renderCurrentPliCards(cards: CurrentPliCard[], suppressPlayedCardId: number | null) {
    cards.forEach((playedCard) => {
      if (suppressPlayedCardId && playedCard.card.id === suppressPlayedCardId) {
        return
      }

      const config = this.getTrickPosition(playedCard)
      const cardImage = this.add.image(config.x, config.y, this.getCardKey(playedCard.card))

      cardImage.setDisplaySize(92, 138)
      cardImage.setRotation(config.rotation)
      cardImage.setDepth(30)
      this.dynamicObjects.push(cardImage)
    })
  }

  private renderDogCards(title: string, cards: Card[], suppressCardId: number | null = null) {
    const label = this.add.text(600, 284, title, {
      color: '#f3e6bf',
      fontFamily: 'Georgia',
      fontSize: '24px',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    this.dynamicObjects.push(label)

    cards.forEach((card, index) => {
      if (suppressCardId && card.id === suppressCardId) {
        return
      }

      const position = this.getDogCardPosition(index, cards.length)
      const image = this.add.image(position.x, position.y, this.getCardKey(card))
      image.setDisplaySize(78, 118)
      image.setDepth(18)
      this.dynamicObjects.push(image)
    })
  }

  private renderKingChoices() {
    if (!this.tableState) {
      return
    }

    const label = this.add.text(600, 250, 'Choisissez un roi', {
      color: '#f3e6bf',
      fontFamily: 'Georgia',
      fontSize: '24px',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    this.dynamicObjects.push(label)

    const spacing = 122
    const firstX = 600 - ((this.tableState.kingChoices.length - 1) * spacing) / 2

    this.tableState.kingChoices.forEach((card, index) => {
      const image = this.add.image(firstX + index * spacing, 350, this.getCardKey(card))
      image.setDisplaySize(92, 138)
      image.setDepth(24)
      image.setInteractive({ useHandCursor: true })

      image.on('pointerover', () => {
        image.setDisplaySize(98, 147)
        image.setDepth(40)
      })

      image.on('pointerout', () => {
        image.setDisplaySize(92, 138)
        image.setDepth(24)
      })

      image.on('pointerdown', () => {
        this.onCallKing?.(card)
      })

      this.dynamicObjects.push(image)
    })
  }

  private renderRetrieveDogButton() {
    const background = this.add.rectangle(600, 500, 208, 46, 0x1c5b2e, 0.92)
      .setStrokeStyle(2, 0xf5d37f, 0.7)
      .setInteractive({ useHandCursor: true })

    const text = this.add.text(600, 500, 'Recuperer le chien', {
      color: '#fff6d8',
      fontFamily: 'Georgia',
      fontSize: '22px',
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

    const sortedHand = sortHandCards(this.tableState.playerHand)
    const spacing = sortedHand.length > 1
      ? Math.min(62, Math.max(28, Math.floor(920 / (sortedHand.length - 1))))
      : 0
    const firstX = 600 - ((sortedHand.length - 1) * spacing) / 2
    const selectableIds = new Set(this.tableState.selectableCardIds)
    const disableAllCards = this.shouldDisableAllHandCards()

    sortedHand.forEach((card, index) => {
      const x = firstX + index * spacing
      const y = 704
      const selectable = selectableIds.has(card.id)
      const baseWidth = 112
      const baseHeight = 168
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
    image.setY(baseY - 28)
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

    this.renderTable()

    let completedTweens = 0

    previousState.dogCards.forEach((card, index) => {
      const start = this.getDogCardPosition(index, previousState.dogCards.length)
      const target = this.getRetrievedDogTargetPosition(index, previousState.dogCards.length)
      const animationCard = this.add.image(start.x, start.y, this.getCardKey(card))

      animationCard.setDisplaySize(78, 118)
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
    const discardIndex = nextState.discardedDogCards.findIndex((card) => card.id === discardedCard.id)
    const target = this.getDogCardPosition(
      discardIndex >= 0 ? discardIndex : Math.max(nextState.discardedDogCards.length - 1, 0),
      nextState.discardedDogCards.length
    )
    const origin = this.getHandCardPosition(previousState.playerHand, discardedCard.id)
    const targetWidth = 78
    const targetHeight = 118

    this.renderTable({ suppressDogDiscardedCardId: discardedCard.id })

    const animationCard = this.add.image(origin.x, origin.y, this.getCardKey(discardedCard))

    animationCard.setDisplaySize(112, 168)
    animationCard.setDepth(260)
    this.transientObjects.push(animationCard)

    const startScaleX = animationCard.scaleX
    const startScaleY = animationCard.scaleY

    this.tweens.add({
      targets: animationCard,
      x: target.x,
      y: target.y,
      scaleX: startScaleX * (targetWidth / 112),
      scaleY: startScaleY * (targetHeight / 168),
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
    const sortedHand = sortHandCards(handCards)
    const cardIndex = sortedHand.findIndex((card) => card.id === cardId)
    const spacing = sortedHand.length > 1
      ? Math.min(62, Math.max(28, Math.floor(920 / (sortedHand.length - 1))))
      : 0
    const firstX = 600 - ((sortedHand.length - 1) * spacing) / 2

    return {
      x: cardIndex >= 0 ? firstX + cardIndex * spacing : 600,
      y: 704
    }
  }

  private getDogCardPosition(index: number, totalCards: number) {
    const spacing = 86
    const firstX = 600 - ((totalCards - 1) * spacing) / 2

    return {
      x: firstX + index * spacing,
      y: 360
    }
  }

  private getRetrievedDogTargetPosition(index: number, totalCards: number) {
    const spacing = 74
    const firstX = 600 - ((totalCards - 1) * spacing) / 2

    return {
      x: firstX + index * spacing,
      y: 636
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
    const origin = this.getCardOriginPosition(seat)
    const target = this.getTrickPosition(playedCard)
    const animationCard = this.add.image(origin.x, origin.y, this.getCardKey(playedCard.card))

    animationCard.setDisplaySize(92, 138)
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

    this.clearPendingTrickCollection()
    this.renderTable({ suppressTrickCards: true })

    const winnerSeat = this.getSeatKey(state.currentPliWinnerNum)
    const destination = this.getCollectDestination(winnerSeat)
    let completedTweens = 0

    state.currentPliCards.forEach((playedCard, index) => {
      const start = this.getTrickPosition(playedCard)
      const animationCard = this.add.image(start.x, start.y, this.getCardKey(playedCard.card))

      animationCard.setDisplaySize(92, 138)
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
        duration: 340,
        ease: 'Cubic.InOut',
        onComplete: () => {
          animationCard.destroy()
          this.transientObjects = this.transientObjects.filter((object) => object !== animationCard)
          completedTweens += 1

          if (completedTweens === state.currentPliCards.length) {
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
    switch (seat) {
      case 'left':
        return {
          cardX: 120,
          cardY: 402,
          spreadX: 0,
          spreadY: 10,
          rotation: -Math.PI / 2,
          labelX: 156,
          labelY: 248,
          scoreX: 156,
          scoreY: 274,
          badgeWidth: 150
        }
      case 'topLeft':
        return {
          cardX: 362,
          cardY: 148,
          spreadX: 12,
          spreadY: 0,
          rotation: 0,
          labelX: 206,
          labelY: 94,
          scoreX: 206,
          scoreY: 120,
          badgeWidth: 170
        }
      case 'topRight':
        return {
          cardX: 838,
          cardY: 148,
          spreadX: 12,
          spreadY: 0,
          rotation: 0,
          labelX: 994,
          labelY: 94,
          scoreX: 994,
          scoreY: 120,
          badgeWidth: 170
        }
      case 'right':
        return {
          cardX: 1080,
          cardY: 402,
          spreadX: 0,
          spreadY: 10,
          rotation: Math.PI / 2,
          labelX: 1044,
          labelY: 248,
          scoreX: 1044,
          scoreY: 274,
          badgeWidth: 150
        }
      default:
        return {
          cardX: 600,
          cardY: 0,
          spreadX: 0,
          spreadY: 0,
          rotation: 0,
          labelX: 600,
          labelY: 0,
          scoreX: 600,
          scoreY: 0,
          badgeWidth: 0
        }
    }
  }

  private getCardOriginPosition(seat: SeatKey) {
    switch (seat) {
      case 'left':
        return { x: 160, y: 402, rotation: -Math.PI / 2 }
      case 'topLeft':
        return { x: 430, y: 170, rotation: 0 }
      case 'topRight':
        return { x: 770, y: 170, rotation: 0 }
      case 'right':
        return { x: 1040, y: 402, rotation: Math.PI / 2 }
      default:
        return { x: 600, y: 748, rotation: 0 }
    }
  }

  private getCollectDestination(seat: SeatKey) {
    switch (seat) {
      case 'left':
        return { x: 175, y: 390, spreadX: 0, spreadY: 5, rotation: -Math.PI / 2 }
      case 'topLeft':
        return { x: 395, y: 182, spreadX: 5, spreadY: 0, rotation: 0 }
      case 'topRight':
        return { x: 805, y: 182, spreadX: 5, spreadY: 0, rotation: 0 }
      case 'right':
        return { x: 1025, y: 390, spreadX: 0, spreadY: 5, rotation: Math.PI / 2 }
      default:
        return { x: 600, y: 640, spreadX: 14, spreadY: 0, rotation: 0 }
    }
  }

  private getTrickPosition(playedCard: CurrentPliCard) {
    const fallbackX = [480, 540, 600, 660, 720]

    if (playedCard.playerNum) {
      return this.getTrickSeatConfig(this.getSeatKey(playedCard.playerNum))
    }

    return { x: fallbackX[playedCard.position - 1] ?? 600, y: 390, rotation: 0 }
  }

  private getTrickSeatConfig(seat: SeatKey) {
    switch (seat) {
      case 'left':
        return { x: 398, y: 408, rotation: -0.09 }
      case 'topLeft':
        return { x: 520, y: 262, rotation: -0.03 }
      case 'topRight':
        return { x: 680, y: 262, rotation: 0.03 }
      case 'right':
        return { x: 802, y: 408, rotation: 0.09 }
      default:
        return { x: 600, y: 520, rotation: 0 }
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
