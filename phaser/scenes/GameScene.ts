import Phaser from 'phaser'
import type { Card } from '~/types'

export class GameScene extends Phaser.Scene {
  private cards: Phaser.GameObjects.Image[] = []
  private centerCards: Phaser.GameObjects.Image[] = []
  private playerHand: Card[] = []
  private onCardClick?: (card: Card) => void
  private sceneReady = false

  constructor() {
    super({ key: 'GameScene' })
  }

  init(data: any) {
    this.onCardClick = data.onCardClick
  }

  preload() {
    this.load.image('cardback', '/cards/cardback.png')

    for (let i = 1; i <= 14; i++) {
      this.load.image(`spade_${i}`, `/cards/Spade/card_${i}_spade.png`)
      this.load.image(`heart_${i}`, `/cards/Heart/card_${i}_heart.png`)
      this.load.image(`diamond_${i}`, `/cards/Diamond/card_${i}_diamond.png`)
      this.load.image(`clover_${i}`, `/cards/Clover/card_${i}_clover.png`)
    }

    for (let i = 1; i <= 21; i++) {
      this.load.image(`atout_${i}`, `/cards/Atout/card_${i}_atout.png`)
    }
    this.load.image('atout_E', '/cards/Atout/card_E_atout.png')
    this.load.image('background', '/background.jpg')
  }

  create() {
    this.sceneReady = true

    const bg = this.add.image(600, 400, 'background')
    bg.setDisplaySize(1200, 800)
    bg.setAlpha(0.3)

    this.createPlayerZones()

    if (this.playerHand.length > 0) {
      this.renderPlayerHand()
    }
  }

  createPlayerZones() {
    this.add.rectangle(600, 700, 1000, 150, 0x000000, 0.2)
    this.add.rectangle(100, 400, 150, 600, 0x000000, 0.1)
    this.add.rectangle(300, 100, 300, 150, 0x000000, 0.1)
    this.add.rectangle(900, 100, 300, 150, 0x000000, 0.1)
    this.add.rectangle(1100, 400, 150, 600, 0x000000, 0.1)
    this.add.rectangle(600, 400, 400, 300, 0x000000, 0.15)
  }

  displayPlayerHand(cards: Card[]) {
    console.log('GameScene.displayPlayerHand appele avec', cards.length, 'cartes')
    this.playerHand = cards

    if (!this.sceneReady) {
      return
    }

    this.renderPlayerHand()
  }

  private renderPlayerHand() {
    this.cards.forEach(card => card.destroy())
    this.cards = []

    const cardWidth = 80
    const cardHeight = 120
    const spacing = 10
    const totalWidth = this.playerHand.length * (cardWidth + spacing)
    const startX = (1200 - totalWidth) / 2

    this.playerHand.forEach((card, index) => {
      console.log('Affichage carte:', card.couleur, card.valeur)
      const x = startX + index * (cardWidth + spacing) + cardWidth / 2
      const y = 700

      const cardKey = this.getCardKey(card)
      const cardImage = this.add.image(x, y, cardKey)
      cardImage.setDisplaySize(cardWidth, cardHeight)
      cardImage.setInteractive({ useHandCursor: true })

      cardImage.on('pointerover', () => {
        cardImage.setScale(1.2)
        cardImage.setDepth(1)
      })

      cardImage.on('pointerout', () => {
        cardImage.setScale(1)
        cardImage.setDepth(0)
      })

      cardImage.on('pointerdown', () => {
        if (this.onCardClick) {
          this.onCardClick(card)
        }
      })

      this.cards.push(cardImage)
    })
  }

  displayCenterCards(cards: Card[], positions: number[]) {
    this.centerCards.forEach(card => card.destroy())
    this.centerCards = []

    const cardWidth = 80
    const cardHeight = 120
    const centerX = 600
    const centerY = 400
    const angleStep = (Math.PI * 2) / 5
    const radius = 120

    cards.forEach((card, index) => {
      const angle = angleStep * positions[index]
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius

      const cardKey = this.getCardKey(card)
      const cardImage = this.add.image(x, y, cardKey)
      cardImage.setDisplaySize(cardWidth, cardHeight)
      cardImage.setRotation(angle + Math.PI / 2)

      this.centerCards.push(cardImage)
    })
  }

  displayOpponentCards(playerPosition: number, cardCount: number) {
    const cardWidth = 60
    const cardHeight = 90

    let x = 0
    let y = 0
    let rotation = 0

    switch (playerPosition) {
      case 1:
        x = 100
        y = 400
        rotation = Math.PI / 2
        break
      case 2:
        x = 300
        y = 100
        break
      case 3:
        x = 900
        y = 100
        break
      case 4:
        x = 1100
        y = 400
        rotation = -Math.PI / 2
        break
    }

    for (let i = 0; i < cardCount; i++) {
      const cardImage = this.add.image(x + i * 5, y + i * 2, 'cardback')
      cardImage.setDisplaySize(cardWidth, cardHeight)
      cardImage.setRotation(rotation)
    }
  }

  private getCardKey(card: Card): string {
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

  clearCenterCards() {
    this.centerCards.forEach(card => card.destroy())
    this.centerCards = []
  }

  override update() {
  }
}
