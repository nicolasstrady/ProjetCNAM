import type { Card } from '~/types'

export const PLAYER_COUNT = 5
export const PLAYER_HAND_SIZE = 15

const COLOR_ALIASES: Record<string, string> = {
  SPADE: 'PIQUE',
  PIQUE: 'PIQUE',
  HEART: 'COEUR',
  COEUR: 'COEUR',
  DIAMOND: 'CARREAU',
  CARREAU: 'CARREAU',
  CLOVER: 'TREFLE',
  TREFLE: 'TREFLE',
  ATOUT: 'ATOUT',
  BOUT: 'BOUT'
}

export function normalizeCardColor(color?: string | null) {
  if (!color) {
    return ''
  }

  return COLOR_ALIASES[color.toUpperCase().trim()] ?? color.toUpperCase().trim()
}

export function getCardNumericValue(value?: string | number | null) {
  if (typeof value === 'number') {
    return value
  }

  const parsedValue = parseInt(String(value ?? '').trim(), 10)
  return Number.isNaN(parsedValue) ? 0 : parsedValue
}

export function getColorOrder(color?: string | null) {
  switch (normalizeCardColor(color)) {
    case 'ATOUT':
    case 'BOUT':
      return 0
    case 'PIQUE':
      return 1
    case 'COEUR':
      return 2
    case 'TREFLE':
      return 3
    case 'CARREAU':
      return 4
    default:
      return 5
  }
}

export function sortHandCards(cards: Card[]) {
  return [...cards].sort((cardA, cardB) => {
    const colorDelta = getColorOrder(cardA.couleur) - getColorOrder(cardB.couleur)
    if (colorDelta !== 0) {
      return colorDelta
    }

    return getCardNumericValue(cardB.valeur) - getCardNumericValue(cardA.valeur)
  })
}

export function isExcuse(card: Pick<Card, 'couleur' | 'valeur'>) {
  return normalizeCardColor(card.couleur) === 'BOUT' && String(card.valeur).toUpperCase() === 'E'
}

export function isTrump(card: Pick<Card, 'couleur' | 'valeur'>) {
  const normalizedColor = normalizeCardColor(card.couleur)
  return normalizedColor === 'ATOUT' || (normalizedColor === 'BOUT' && !isExcuse(card))
}

export function isKing(card: Pick<Card, 'couleur' | 'valeur'>) {
  return !isTrump(card) && getCardNumericValue(card.valeur) === 14
}

export function isDogDiscardForbidden(card: Pick<Card, 'couleur' | 'valeur'>) {
  return normalizeCardColor(card.couleur) === 'BOUT' || isKing(card)
}

export function getEffectiveColor(card: Pick<Card, 'couleur' | 'valeur'>) {
  const normalizedColor = normalizeCardColor(card.couleur)

  if (normalizedColor === 'BOUT') {
    return isExcuse(card) ? 'EXCUSE' : 'ATOUT'
  }

  return normalizedColor
}

export function getCardRank(card: Pick<Card, 'couleur' | 'valeur'>) {
  if (getEffectiveColor(card) === 'EXCUSE') {
    return -1
  }

  return getCardNumericValue(card.valeur)
}

export function getLedColorFromCards(cards: Array<Pick<Card, 'couleur' | 'valeur'>>) {
  for (const card of cards) {
    const effectiveColor = getEffectiveColor(card)

    if (effectiveColor !== 'EXCUSE') {
      return effectiveColor
    }
  }

  return ''
}

export function getHighestTrumpRank(cards: Array<Pick<Card, 'couleur' | 'valeur'>>) {
  return cards.reduce((highestRank, card) => {
    if (getEffectiveColor(card) !== 'ATOUT') {
      return highestRank
    }

    return Math.max(highestRank, getCardRank(card))
  }, 0)
}

export function getCardPlayError(
  handCards: Card[],
  cardToPlay: Card,
  trickCards: Array<Pick<Card, 'couleur' | 'valeur'>>,
  trickCount: number
) {
  const effectiveColor = getEffectiveColor(cardToPlay)
  const cardRank = getCardRank(cardToPlay)

  if (trickCount >= 14 && effectiveColor === 'EXCUSE') {
    return 'Lexcuse ne peut pas etre jouee au dernier pli'
  }

  if (effectiveColor === 'EXCUSE') {
    return null
  }

  const ledColor = getLedColorFromCards(trickCards)

  if (!ledColor) {
    return null
  }

  const highestTrumpRank = getHighestTrumpRank(trickCards)
  const remainingHandCards = handCards.filter((card) => card.id !== cardToPlay.id)
  let hasLedColor = effectiveColor === ledColor
  let hasTrump = false
  let hasHigherTrump = false

  for (const handCard of remainingHandCards) {
    const handCardEffectiveColor = getEffectiveColor(handCard)

    if (handCardEffectiveColor === ledColor) {
      hasLedColor = true
    }

    if (handCardEffectiveColor === 'ATOUT') {
      hasTrump = true

      if (getCardRank(handCard) > highestTrumpRank) {
        hasHigherTrump = true
      }
    }
  }

  if (hasLedColor) {
    if (effectiveColor !== ledColor) {
      return `Vous devez fournir ${ledColor.toLowerCase()}`
    }

    if (ledColor === 'ATOUT' && highestTrumpRank > 0 && hasHigherTrump && cardRank < highestTrumpRank) {
      return 'Vous devez monter a latout'
    }

    return null
  }

  if (hasTrump) {
    if (effectiveColor !== 'ATOUT') {
      return 'Vous devez couper'
    }

    if (highestTrumpRank > 0 && hasHigherTrump && cardRank < highestTrumpRank) {
      return 'Vous devez couper plus haut'
    }
  }

  return null
}

export function getPlayableCardIds(
  handCards: Card[],
  trickCards: Array<Pick<Card, 'couleur' | 'valeur'>>,
  trickCount: number
) {
  return handCards
    .filter((card) => !getCardPlayError(handCards, card, trickCards, trickCount))
    .map((card) => card.id)
}

export function getRelativePlayerOffset(myPlayerNum: number, playerNum: number) {
  return (playerNum - myPlayerNum + PLAYER_COUNT) % PLAYER_COUNT
}
