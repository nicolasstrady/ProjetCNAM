import Phaser from 'phaser'
import type { Card, CurrentPliCard, SceneTableState, TablePlayer } from '~/types'
import { getRelativePlayerOffset, sortHandCards } from '~/utils/tarot'

interface SceneCallbacks {
  onCardClick?: (card: Card) => void
  onCallKing?: (card: Card) => void
  onRetrieveDog?: () => void
}

type SeatKey = 'self' | 'left' | 'topLeft' | 'topRight' | 'right'

export class GameScene extends Phaser.Scene {
  private dynamicObjects: Phaser.GameObjects.GameObject[] = []
  private tableState: SceneTableState | null = null
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
    this.tableState = {
      ...state,
      playerHand: [...state.playerHand],
      players: [...state.players],
      dogCards: [...state.dogCards],
      currentPliCards: [...state.currentPliCards],
      kingChoices: [...state.kingChoices],
      selectableCardIds: [...state.selectableCardIds]
    }

    if (this.sceneReady) {
      this.renderTable()
    }
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

  private renderTable() {
    this.clearHoveredHandCard()
    this.dynamicObjects.forEach((gameObject) => gameObject.destroy())
    this.dynamicObjects = []

    if (!this.tableState) {
      return
    }

    this.renderStatusBanner()
    this.renderPlayers()
    this.renderCenterArea()
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
      const selfLabel = this.add.text(600, 620, `${myself.pseudo}  ${myself.score.toFixed(1)}`, {
        color: this.getPlayerColor(myself.num),
        fontFamily: 'Georgia',
        fontSize: '24px',
        fontStyle: 'bold'
      }).setOrigin(0.5)

      this.dynamicObjects.push(selfLabel)
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
      fontSize: '24px',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    const score = this.add.text(seatConfig.labelX, seatConfig.labelY + 26, `${player.score.toFixed(1)}  ${player.handCount} cartes`, {
      color: '#f1ead9',
      fontFamily: 'Georgia',
      fontSize: '18px'
    }).setOrigin(0.5)

    this.dynamicObjects.push(label, score)
  }

  private renderCenterArea() {
    if (!this.tableState) {
      return
    }

    if (this.tableState.currentPliCards.length > 0) {
      this.renderCurrentPliCards(this.tableState.currentPliCards)
    }

    if (this.tableState.dogCards.length > 0) {
      this.renderDogCards()
    }

    if (this.tableState.phase === 'CALLING' && this.tableState.kingChoices.length > 0) {
      this.renderKingChoices()
    }

    if (this.tableState.phase === 'DOG_EXCHANGE' && this.tableState.takerNum === this.tableState.myPlayerNum) {
      if (!this.tableState.dogRetrieved) {
        this.renderRetrieveDogButton()
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

  private renderCurrentPliCards(cards: CurrentPliCard[]) {
    const fallbackX = [480, 540, 600, 660, 720]

    cards.forEach((playedCard, index) => {
      const config = playedCard.playerNum
        ? this.getTrickSeatConfig(this.getSeatKey(playedCard.playerNum))
        : { x: fallbackX[index] ?? 600, y: 390, rotation: 0 }
      const cardImage = this.add.image(config.x, config.y, this.getCardKey(playedCard.card))

      cardImage.setDisplaySize(92, 138)
      cardImage.setRotation(config.rotation)
      cardImage.setDepth(30)
      this.dynamicObjects.push(cardImage)
    })
  }

  private renderDogCards() {
    if (!this.tableState) {
      return
    }

    const label = this.add.text(600, 284, 'Chien', {
      color: '#f3e6bf',
      fontFamily: 'Georgia',
      fontSize: '24px',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    this.dynamicObjects.push(label)

    const spacing = 86
    const firstX = 600 - ((this.tableState.dogCards.length - 1) * spacing) / 2

    this.tableState.dogCards.forEach((card, index) => {
      const image = this.add.image(firstX + index * spacing, 360, this.getCardKey(card))
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
      image.setAlpha(selectable ? 1 : disableAllCards || selectableIds.size > 0 ? 0.42 : 1)

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
          labelX: 160,
          labelY: 250
        }
      case 'topLeft':
        return {
          cardX: 362,
          cardY: 132,
          spreadX: 12,
          spreadY: 0,
          rotation: 0,
          labelX: 362,
          labelY: 78
        }
      case 'topRight':
        return {
          cardX: 838,
          cardY: 132,
          spreadX: 12,
          spreadY: 0,
          rotation: 0,
          labelX: 838,
          labelY: 78
        }
      case 'right':
        return {
          cardX: 1080,
          cardY: 402,
          spreadX: 0,
          spreadY: 10,
          rotation: Math.PI / 2,
          labelX: 1040,
          labelY: 250
        }
      default:
        return {
          cardX: 600,
          cardY: 0,
          spreadX: 0,
          spreadY: 0,
          rotation: 0,
          labelX: 600,
          labelY: 0
        }
    }
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

    if (this.tableState.takerNum !== null) {
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
