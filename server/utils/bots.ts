import { createError } from 'h3'
import { query, queryOne, txExecute, txQuery, txQueryOne, withTransaction } from '~/server/utils/db'
import {
  callKingAction,
  discardDogAction,
  playCardAction,
  retrieveDogAction,
  TRICK_COLLECTION_LOCK_MS,
  setPlayerContractAction
} from '~/server/utils/gameActions'
import { extractPlayerCardIds, getCardsByIds, getPlayerRowByNum } from '~/server/utils/gameData'
import { getGameSession } from '~/server/utils/gameSession'
import { hashPassword, migrateLegacyPasswords } from '~/server/utils/auth'
import { ensureLobbySchema } from '~/server/utils/lobbySchema'
import type { BotLevel, Card, ContractType, PlayerType, RoomMode, RoomStatus } from '~/types'
import {
  getCardRank,
  getCardNumericValue,
  getColorOrder,
  getEffectiveColor,
  getPlayableCardIds,
  isBoutCard,
  isDogDiscardForbidden,
  isExcuse,
  isKing,
  isTrump
} from '~/utils/tarot'

type BidContract = Extract<ContractType, 'PETITE' | 'GARDE' | 'GARDE_SANS' | 'GARDE_CONTRE' | 'REFUSE'>

interface BotPlayerRow {
  utilisateur: number
  num: number
  equipe: number
  reponse: ContractType
  playerType: PlayerType
  botLevel: BotLevel | null
  pseudo: string
  carte1?: number | null
  carte2?: number | null
  carte3?: number | null
  carte4?: number | null
  carte5?: number | null
  carte6?: number | null
  carte7?: number | null
  carte8?: number | null
  carte9?: number | null
  carte10?: number | null
  carte11?: number | null
  carte12?: number | null
  carte13?: number | null
  carte14?: number | null
  carte15?: number | null
}

interface RoomStateRow {
  status: RoomStatus
  mode: RoomMode
  fillWithBots: number
}

const BOT_POOL_SIZE = 20
const BOT_LEVEL: BotLevel = 'STANDARD'
const BOT_BID_DELAY_MS = 900
const BOT_CALL_KING_DELAY_MS = 1150
const BOT_DOG_RETRIEVE_DELAY_MS = 1150
const BOT_DOG_DISCARD_DELAY_MS = 900
const BOT_PLAY_DELAY_MS = 950
const BOT_POST_TRICK_DELAY_MS = 500
const BOT_POST_DOG_DELAY_MS = 350
const botActionTimers = new Map<number, ReturnType<typeof setTimeout>>()

interface BotTuningProfile {
  captureBias: number
  defenseBias: number
  conserveBias: number
  endgamePush: number
  honorConserveBias: number
  bidShift: number
}

function getBotLevel(botLevel: BotLevel | null | undefined): BotLevel {
  return botLevel === 'EASY' || botLevel === 'HARD' ? botLevel : 'STANDARD'
}

function getBotTuningProfile(botLevel: BotLevel | null | undefined): BotTuningProfile {
  const level = getBotLevel(botLevel)

  if (level === 'EASY') {
    return {
      captureBias: 0.82,
      defenseBias: 0.82,
      conserveBias: 0.78,
      endgamePush: 0.85,
      honorConserveBias: 0.8,
      bidShift: -1.6
    }
  }

  if (level === 'HARD') {
    return {
      captureBias: 1.18,
      defenseBias: 1.16,
      conserveBias: 1.14,
      endgamePush: 1.2,
      honorConserveBias: 1.2,
      bidShift: 1.2
    }
  }

  return {
    captureBias: 1,
    defenseBias: 1,
    conserveBias: 1,
    endgamePush: 1,
    honorConserveBias: 1,
    bidShift: 0
  }
}

function getContractRank(contract: string | null | undefined) {
  switch (String(contract ?? '').toUpperCase()) {
    case 'PETITE':
      return 1
    case 'GARDE':
      return 2
    case 'GARDE_SANS':
      return 3
    case 'GARDE_CONTRE':
      return 4
    default:
      return 0
  }
}

function getDiscardPriority(card: Card) {
  const color = getEffectiveColor(card)

  if (color === 'EXCUSE') {
    return 1000
  }

  if (isTrump(card)) {
    return 500 + getCardNumericValue(card.valeur)
  }

  return getCardNumericValue(card.valeur)
}

function getLeadPriority(card: Card) {
  const color = getEffectiveColor(card)

  if (color === 'EXCUSE') {
    return 1000
  }

  if (isTrump(card)) {
    return 400 + getCardNumericValue(card.valeur)
  }

  return getCardNumericValue(card.valeur) + getColorOrder(card.couleur) * 20
}

interface TrickLeader {
  playerNum: number
  color: string
  rank: number
}

interface BotMemoryContext {
  seenCardIds: Set<number>
  seenHonorsBySuit: Map<string, Set<number>>
  voidColorsByPlayer: Map<number, Set<string>>
  ledColorCount: Map<string, number>
  seenTrumpRanks: Set<number>
}

function normalizePlayerNum(playerNum: number) {
  return ((playerNum - 1 + 5 * 20) % 5) + 1
}

function getPlayerNumAtTrickIndex(firstPlayer: number, index: number) {
  return normalizePlayerNum(firstPlayer + index)
}

function getPlayerTrickOffset(firstPlayer: number, playerNum: number) {
  return (playerNum - firstPlayer + 5) % 5
}

function getFirstPlayerFromContext(sessionFirstPlayer: number | null, currentPlayerNum: number, playedCount: number) {
  if (sessionFirstPlayer) {
    return sessionFirstPlayer
  }

  return normalizePlayerNum(currentPlayerNum - playedCount)
}

function getMemoryWeight(botLevel: BotLevel | null | undefined) {
  const level = getBotLevel(botLevel)

  if (level === 'EASY') {
    return 0.4
  }

  if (level === 'HARD') {
    return 1.35
  }

  return 0.85
}

function getTarotConceptWeight(botLevel: BotLevel | null | undefined) {
  const level = getBotLevel(botLevel)

  if (level === 'EASY') {
    return 0.7
  }

  if (level === 'HARD') {
    return 1.35
  }

  return 1
}

function getSuitCounts(cards: Card[]) {
  const suitCounts = new Map<string, number>()

  cards.forEach((card) => {
    const color = getEffectiveColor(card)

    if (color !== 'ATOUT' && color !== 'EXCUSE') {
      suitCounts.set(color, (suitCounts.get(color) ?? 0) + 1)
    }
  })

  return suitCounts
}

function getHighTrumpCount(cards: Card[]) {
  return cards.filter((card) => isTrump(card) && getCardRank(card) >= 16).length
}

function getOutstandingHighTrumpCount(handCards: Card[], memory: BotMemoryContext) {
  const myTrumpRanks = new Set(
    handCards
      .filter((card) => isTrump(card))
      .map((card) => getCardRank(card))
  )

  let count = 0

  for (let rank = 21; rank >= 15; rank -= 1) {
    if (memory.seenTrumpRanks.has(rank)) {
      continue
    }

    if (myTrumpRanks.has(rank)) {
      continue
    }

    count += 1
  }

  return count
}

function countUnseenHigherTrumps(card: Card, handCards: Card[], memory: BotMemoryContext) {
  if (!isTrump(card)) {
    return 0
  }

  const currentRank = getCardRank(card)
  const myTrumpRanks = new Set(
    handCards
      .filter((handCard) => isTrump(handCard))
      .map((handCard) => getCardRank(handCard))
  )

  let count = 0
  for (let rank = currentRank + 1; rank <= 21; rank += 1) {
    if (memory.seenTrumpRanks.has(rank)) {
      continue
    }

    if (myTrumpRanks.has(rank)) {
      continue
    }

    count += 1
  }

  return count
}

function countUnseenHigherHonors(card: Card, handCards: Card[], memory: BotMemoryContext) {
  if (isTrump(card) || isExcuse(card)) {
    return 0
  }

  const color = getEffectiveColor(card)
  const currentValue = getCardNumericValue(card.valeur)

  if (currentValue < 11) {
    return 0
  }

  const seenHonors = memory.seenHonorsBySuit.get(color) ?? new Set<number>()
  const mySuitHonorValues = new Set(
    handCards
      .filter((handCard) => !isTrump(handCard) && !isExcuse(handCard) && getEffectiveColor(handCard) === color)
      .map((handCard) => getCardNumericValue(handCard.valeur))
      .filter((value) => value >= 11)
  )

  let unseenHigher = 0

  for (let value = currentValue + 1; value <= 14; value += 1) {
    if (seenHonors.has(value)) {
      continue
    }

    if (mySuitHonorValues.has(value)) {
      continue
    }

    unseenHigher += 1
  }

  return unseenHigher
}

function countKnownVoidOpponentsForSuit(
  suit: string,
  myPlayerNum: number,
  teamByPlayerNum: Map<number, number>,
  memory: BotMemoryContext
) {
  let count = 0

  memory.voidColorsByPlayer.forEach((voidColors, playerNum) => {
    if (playerNum === myPlayerNum) {
      return
    }

    if (isSameTeam(teamByPlayerNum, playerNum, myPlayerNum)) {
      return
    }

    if (voidColors.has(suit)) {
      count += 1
    }
  })

  return count
}

async function buildBotMemoryContext(partieId: number, sessionFirstPlayer: number | null, takerNum: number | null) {
  const plis = await query<{
    id: number
    joueurGagnant: number | null
    carte1: number | null
    carte2: number | null
    carte3: number | null
    carte4: number | null
    carte5: number | null
  }>(
    `SELECT id, joueurGagnant, carte1, carte2, carte3, carte4, carte5
     FROM plis
     WHERE partie = ? AND pliChien = 0
     ORDER BY id ASC`,
    [partieId]
  )

  const allPlayedCardIds = plis.flatMap((pli) => [pli.carte1, pli.carte2, pli.carte3, pli.carte4, pli.carte5])
    .filter((cardId): cardId is number => cardId !== null && cardId !== undefined)
  const uniquePlayedCardIds = [...new Set(allPlayedCardIds)]
  const playedCards = uniquePlayedCardIds.length > 0 ? await getCardsByIds(uniquePlayedCardIds) : []
  const cardsById = new Map(playedCards.map((card) => [card.id, card]))

  const seenCardIds = new Set<number>()
  const seenHonorsBySuit = new Map<string, Set<number>>()
  const voidColorsByPlayer = new Map<number, Set<string>>()
  const ledColorCount = new Map<string, number>()
  const seenTrumpRanks = new Set<number>()

  let currentFirstPlayer = sessionFirstPlayer
  if (!currentFirstPlayer) {
    currentFirstPlayer = takerNum ? normalizePlayerNum(takerNum + 1) : 1
  }

  for (const pli of plis) {
    const cardIds = [pli.carte1, pli.carte2, pli.carte3, pli.carte4, pli.carte5].filter(
      (cardId): cardId is number => cardId !== null && cardId !== undefined
    )

    if (cardIds.length === 0) {
      continue
    }

    const cards = cardIds
      .map((cardId) => cardsById.get(cardId))
      .filter((card): card is Card => Boolean(card))

    cards.forEach((card) => {
      seenCardIds.add(card.id)

      if (isTrump(card)) {
        seenTrumpRanks.add(getCardRank(card))
      }

      if (!isTrump(card) && !isExcuse(card)) {
        const color = getEffectiveColor(card)
        const value = getCardNumericValue(card.valeur)

        if (value >= 11) {
          const suitHonors = seenHonorsBySuit.get(color) ?? new Set<number>()
          suitHonors.add(value)
          seenHonorsBySuit.set(color, suitHonors)
        }
      }
    })

    let ledColor = ''
    cards.forEach((card, index) => {
      const effectiveColor = getEffectiveColor(card)
      const playerNum = getPlayerNumAtTrickIndex(currentFirstPlayer!, index)

      if (!ledColor && effectiveColor !== 'EXCUSE') {
        ledColor = effectiveColor
        ledColorCount.set(ledColor, (ledColorCount.get(ledColor) ?? 0) + 1)
      }

      if (!ledColor || index === 0 || effectiveColor === 'EXCUSE') {
        return
      }

      if (effectiveColor !== ledColor) {
        const currentVoidColors = voidColorsByPlayer.get(playerNum) ?? new Set<string>()
        currentVoidColors.add(ledColor)
        voidColorsByPlayer.set(playerNum, currentVoidColors)
      }
    })

    if (cardIds.length === 5) {
      currentFirstPlayer = pli.joueurGagnant ? normalizePlayerNum(pli.joueurGagnant) : currentFirstPlayer
    }
  }

  return {
    seenCardIds,
    seenHonorsBySuit,
    voidColorsByPlayer,
    ledColorCount,
    seenTrumpRanks
  }
}

function getLeadPositionalVoidRisk(
  suit: string,
  myPlayerNum: number,
  teamByPlayerNum: Map<number, number>,
  memory: BotMemoryContext
) {
  const nextPlayer = normalizePlayerNum(myPlayerNum + 1)
  const secondPlayer = normalizePlayerNum(myPlayerNum + 2)
  const nextVoid = memory.voidColorsByPlayer.get(nextPlayer)?.has(suit) ?? false
  const secondVoid = memory.voidColorsByPlayer.get(secondPlayer)?.has(suit) ?? false

  let risk = 0

  if (nextVoid && !isSameTeam(teamByPlayerNum, nextPlayer, myPlayerNum)) {
    risk += 1.5
  }

  if (secondVoid && !isSameTeam(teamByPlayerNum, secondPlayer, myPlayerNum)) {
    risk += 0.8
  }

  return risk
}

function getPlayerVoidCount(memory: BotMemoryContext, playerNum: number) {
  return memory.voidColorsByPlayer.get(playerNum)?.size ?? 0
}

function getTrumpHuntPressure(
  myPlayerNum: number,
  teamByPlayerNum: Map<number, number>,
  memory: BotMemoryContext,
  takerNum: number | null,
  trickCount: number
) {
  if (!takerNum || trickCount >= 10) {
    return 0
  }

  const isTakerSide = isSameTeam(teamByPlayerNum, myPlayerNum, takerNum)
  const takerVoidCount = getPlayerVoidCount(memory, takerNum)
  let pressure = 0

  if (isTakerSide) {
    let defenderVoidCount = 0

    memory.voidColorsByPlayer.forEach((voidColors, playerNum) => {
      if (playerNum === myPlayerNum) {
        return
      }

      if (isSameTeam(teamByPlayerNum, playerNum, takerNum)) {
        return
      }

      defenderVoidCount += Math.min(voidColors.size, 2)
    })

    pressure += defenderVoidCount * 0.35
    pressure += takerVoidCount * 0.2
  } else {
    pressure += takerVoidCount * 0.95
  }

  if (trickCount <= 4) {
    pressure *= 1.2
  }

  return pressure
}

function evaluateDogDiscardCard(candidate: Card, currentCards: Card[], botLevel: BotLevel | null) {
  const conceptWeight = getTarotConceptWeight(botLevel)
  const memoryWeight = getMemoryWeight(botLevel)
  const remainingCards = currentCards.filter((card) => card.id !== candidate.id)
  const suitCountsBefore = getSuitCounts(currentCards)
  const suitCountsAfter = getSuitCounts(remainingCards)
  const candidateColor = getEffectiveColor(candidate)
  const candidateValue = getCardNumericValue(candidate.valeur)
  const trumpCountAfter = remainingCards.filter((card) => isTrump(card)).length
  const highTrumpCountAfter = getHighTrumpCount(remainingCards)

  let score = -getDiscardPriority(candidate)

  if (isTrump(candidate)) {
    const trumpPenalty = candidateValue >= 16 ? 26 : candidateValue >= 12 ? 18 : 10
    score -= trumpPenalty * conceptWeight
    return score
  }

  score += (11 - Math.min(candidateValue, 11)) * 1.5

  if (candidateValue >= 11) {
    score -= (candidateValue === 14 ? 22 : candidateValue === 13 ? 16 : candidateValue === 12 ? 12 : 8) * conceptWeight
  }

  const countBefore = suitCountsBefore.get(candidateColor) ?? 0
  const countAfter = suitCountsAfter.get(candidateColor) ?? 0

  if (countBefore >= 2 && countAfter === 1) {
    const singletonBonus = trumpCountAfter >= 6 ? 12 : trumpCountAfter >= 4 ? 8 : 4
    score += singletonBonus * conceptWeight
  }

  if (countBefore >= 1 && countAfter === 0) {
    const coupeFrancheBonus = trumpCountAfter >= 6
      ? 20
      : trumpCountAfter >= 4
        ? 13
        : 7
    const highTrumpBoost = highTrumpCountAfter >= 2 ? 1.2 : 1
    score += coupeFrancheBonus * highTrumpBoost * conceptWeight
  }

  if (countBefore >= 5 && countAfter >= 4) {
    score -= 4 * memoryWeight
  }

  return score
}

function getTrickLeader(cards: Card[], firstPlayer: number): TrickLeader | null {
  let ledColor = ''
  let leader: TrickLeader | null = null

  cards.forEach((card, index) => {
    const effectiveColor = getEffectiveColor(card)

    if (effectiveColor === 'EXCUSE') {
      return
    }

    if (!ledColor) {
      ledColor = effectiveColor
    }

    const rank = getCardRank(card)
    const playerNum = getPlayerNumAtTrickIndex(firstPlayer, index)

    if (!leader) {
      leader = {
        playerNum,
        color: effectiveColor,
        rank
      }
      return
    }

    if (leader.color === 'ATOUT') {
      if (effectiveColor === 'ATOUT' && rank > leader.rank) {
        leader = {
          playerNum,
          color: effectiveColor,
          rank
        }
      }
      return
    }

    if (effectiveColor === 'ATOUT') {
      leader = {
        playerNum,
        color: effectiveColor,
        rank
      }
      return
    }

    if (effectiveColor === ledColor && rank > leader.rank) {
      leader = {
        playerNum,
        color: effectiveColor,
        rank
      }
    }
  })

  return leader
}

function getTrickPoints(cards: Card[]) {
  return cards.reduce((total, card) => {
    if (isExcuse(card)) {
      return total
    }

    return total + card.points
  }, 0)
}

function isSameTeam(teamByPlayerNum: Map<number, number>, playerA: number, playerB: number) {
  const teamA = teamByPlayerNum.get(playerA)
  const teamB = teamByPlayerNum.get(playerB)
  return teamA !== undefined && teamB !== undefined && teamA > 0 && teamA === teamB
}

function evaluateLeadCard(
  card: Card,
  handCards: Card[],
  trickCount: number,
  botLevel: BotLevel | null,
  myPlayerNum: number,
  teamByPlayerNum: Map<number, number>,
  memory: BotMemoryContext,
  takerNum: number | null
) {
  const tuning = getBotTuningProfile(botLevel)
  const memoryWeight = getMemoryWeight(botLevel)
  const conceptWeight = getTarotConceptWeight(botLevel)
  const effectiveColor = getEffectiveColor(card)
  const cardRank = getCardRank(card)
  const cardNumericValue = getCardNumericValue(card.valeur)
  const isEarlyGame = trickCount <= 4
  const isMidGame = trickCount >= 6 && trickCount < 10
  const isLateGame = trickCount >= 10
  const suitCounts = new Map<string, number>()

  handCards.forEach((handCard) => {
    const color = getEffectiveColor(handCard)

    if (color !== 'ATOUT' && color !== 'EXCUSE') {
      suitCounts.set(color, (suitCounts.get(color) ?? 0) + 1)
    }
  })

  if (effectiveColor === 'EXCUSE') {
    return -100
  }

  let score = 0
  const outstandingHighTrumps = getOutstandingHighTrumpCount(handCards, memory)
  const trumpCountInHand = handCards.filter((handCard) => isTrump(handCard)).length
  const isTakerSide = takerNum ? isSameTeam(teamByPlayerNum, myPlayerNum, takerNum) : false
  const trumpHuntPressure = getTrumpHuntPressure(myPlayerNum, teamByPlayerNum, memory, takerNum, trickCount)

  if (isTrump(card)) {
    score -= 7 * tuning.conserveBias

    if (isMidGame) {
      score += 1
    }

    if (isLateGame) {
      score += 4 * tuning.endgamePush
    }

    if (cardRank >= 16) {
      score -= 6 * tuning.conserveBias
    }

    const unseenHigherTrumps = countUnseenHigherTrumps(card, handCards, memory)

    if (!isLateGame && unseenHigherTrumps > 0 && cardRank >= 15) {
      score -= unseenHigherTrumps * 4.5 * memoryWeight
    }

    if (cardRank <= 10 && outstandingHighTrumps <= 1) {
      score += 5 * conceptWeight
    }

    if (cardRank >= 18 && outstandingHighTrumps >= 3 && !isLateGame) {
      score -= 7 * memoryWeight
    }

    if (trumpHuntPressure > 0) {
      if (cardRank >= 9 && cardRank <= 16) {
        score += trumpHuntPressure * 5 * conceptWeight
      }

      if (cardRank <= 8) {
        score += trumpHuntPressure * 2.5 * conceptWeight
      }

      if (cardRank >= 18 && outstandingHighTrumps >= 2 && !isLateGame) {
        score -= trumpHuntPressure * 2.5 * memoryWeight
      }
    }

    if (takerNum && isEarlyGame) {
      if (isTakerSide) {
        if (trumpCountInHand >= 5 && cardRank >= 9 && cardRank <= 16 && outstandingHighTrumps <= 3) {
          score += 8 * conceptWeight
        }

        if (cardRank <= 8 && outstandingHighTrumps >= 3) {
          score -= 4 * memoryWeight
        }
      } else {
        if (trumpCountInHand >= 4 && cardRank >= 11 && cardRank <= 17 && outstandingHighTrumps <= 2) {
          score += 5 * conceptWeight
        }

        if (trumpCountInHand <= 2 && cardRank >= 17) {
          score -= 6 * memoryWeight
        }
      }
    }

    if (cardRank <= 8) {
      score += 3
    }
  } else {
    const sameSuitCount = suitCounts.get(effectiveColor) ?? 0
    const highHonorPenalty = (isLateGame ? 2 : isMidGame ? 4 : 6) * tuning.honorConserveBias
    const sameSuitCards = handCards.filter((handCard) => getEffectiveColor(handCard) === effectiveColor)
    const hasSuitKing = sameSuitCards.some((handCard) => !isTrump(handCard) && getCardNumericValue(handCard.valeur) === 14)

    score += sameSuitCount * 2
    score -= cardNumericValue * 0.4

    if (cardNumericValue >= 12) {
      score -= highHonorPenalty
    }

    if (cardNumericValue >= 11) {
      const baseHonorRisk = cardNumericValue === 14 ? 7 : cardNumericValue === 13 ? 11 : cardNumericValue === 12 ? 9 : 7
      const honorWindowFactor = isEarlyGame ? 1.25 : isMidGame ? 0.95 : 0.65
      const shortSuitRisk = sameSuitCount <= 2 ? 1.2 : 1
      const protectionFactor = hasSuitKing && cardNumericValue < 14 ? 0.82 : 1
      score -= baseHonorRisk * honorWindowFactor * shortSuitRisk * protectionFactor * tuning.honorConserveBias

      const unseenHigherHonors = countUnseenHigherHonors(card, handCards, memory)
      if (unseenHigherHonors > 0) {
        const unseenPenalty = (isEarlyGame ? 6 : isMidGame ? 4 : 2.5) * unseenHigherHonors
        score -= unseenPenalty * memoryWeight
      }

      const knownVoidOpponents = countKnownVoidOpponentsForSuit(effectiveColor, myPlayerNum, teamByPlayerNum, memory)
      if (knownVoidOpponents > 0) {
        const voidPenalty = (isEarlyGame ? 7 : isMidGame ? 4.5 : 2.5) * knownVoidOpponents
        score -= voidPenalty * memoryWeight
      }
    }

    const suitLeadCount = memory.ledColorCount.get(effectiveColor) ?? 0
    const knownVoidRisk = getLeadPositionalVoidRisk(effectiveColor, myPlayerNum, teamByPlayerNum, memory)
    const nextPlayer = normalizePlayerNum(myPlayerNum + 1)
    const nextIsAlly = isSameTeam(teamByPlayerNum, nextPlayer, myPlayerNum)
    const takerVoidInSuit = takerNum
      ? (memory.voidColorsByPlayer.get(takerNum)?.has(effectiveColor) ?? false)
      : false

    if (suitLeadCount === 0 && cardNumericValue <= 10) {
      let openNewSuitBonus = sameSuitCount >= 3 ? 7 : sameSuitCount === 2 ? 4 : 2

      if (nextIsAlly) {
        openNewSuitBonus += 2
      }

      score += openNewSuitBonus * conceptWeight
    }

    if (knownVoidRisk > 0) {
      const riskPenalty = (cardNumericValue >= 11 ? 8 : 5) * knownVoidRisk
      score -= riskPenalty * memoryWeight
    }

    if (takerVoidInSuit) {
      if (!isTakerSide) {
        score -= (cardNumericValue >= 11 ? 12 : 8) * conceptWeight
      } else if (cardNumericValue <= 9) {
        score += 3.5 * conceptWeight
      }
    }

    if (cardNumericValue <= 8) {
      score += 3
    }
  }

  if (isBoutCard(card)) {
    score -= (isLateGame ? 10 : isMidGame ? 15 : 22) * tuning.conserveBias
  }

  return score
}

function evaluateFollowCard(
  card: Card,
  handCards: Card[],
  trickCards: Card[],
  firstPlayer: number,
  myPlayerNum: number,
  teamByPlayerNum: Map<number, number>,
  trickCount: number,
  botLevel: BotLevel | null,
  memory: BotMemoryContext,
  takerNum: number | null
) {
  const tuning = getBotTuningProfile(botLevel)
  const memoryWeight = getMemoryWeight(botLevel)
  const conceptWeight = getTarotConceptWeight(botLevel)
  const beforeLeader = getTrickLeader(trickCards, firstPlayer)
  const trickAfterPlay = [...trickCards, card]
  const afterLeader = getTrickLeader(trickAfterPlay, firstPlayer)
  const pointsBefore = getTrickPoints(trickCards)
  const pointsAfter = getTrickPoints(trickAfterPlay)
  const effectiveColor = getEffectiveColor(card)
  const cardNumericValue = getCardNumericValue(card.valeur)
  const cardRank = getCardRank(card)
  const isMidGame = trickCount >= 6 && trickCount < 10
  const isLateGame = trickCount >= 10
  const conserveFactor = (isLateGame ? 0.55 : isMidGame ? 0.85 : 1) * tuning.conserveBias
  const highValueTrick = pointsAfter >= 6
  const outstandingHighTrumps = getOutstandingHighTrumpCount(handCards, memory)
  const isTakerSide = takerNum ? isSameTeam(teamByPlayerNum, myPlayerNum, takerNum) : false
  const trumpHuntPressure = getTrumpHuntPressure(myPlayerNum, teamByPlayerNum, memory, takerNum, trickCount)
  const ledColor = trickCards.find((playedCard) => !isExcuse(playedCard))
    ? getEffectiveColor(trickCards.find((playedCard) => !isExcuse(playedCard)) as Card)
    : ''
  const takerOffset = takerNum ? getPlayerTrickOffset(firstPlayer, takerNum) : -1
  const takerPlaysAfterMe = takerNum ? takerOffset > trickCards.length : false
  let score = 0

  if (!afterLeader) {
    return isExcuse(card) ? -3 : 0
  }

  const allyLeadingBefore = beforeLeader ? isSameTeam(teamByPlayerNum, beforeLeader.playerNum, myPlayerNum) : false
  const allyLeadingAfter = isSameTeam(teamByPlayerNum, afterLeader.playerNum, myPlayerNum)
  const doesCardTakeLead = allyLeadingAfter && (!beforeLeader || !allyLeadingBefore)

  if (doesCardTakeLead) {
    score += (18 + pointsAfter * (highValueTrick ? 6 : 4)) * tuning.captureBias
  }

  score += allyLeadingAfter ? pointsAfter * 2.5 * tuning.defenseBias : -pointsAfter * 3 * tuning.captureBias

  if (!isTrump(card) && !isExcuse(card) && cardNumericValue >= 11) {
    const unseenHigherHonors = countUnseenHigherHonors(card, handCards, memory)

    if (allyLeadingBefore && allyLeadingAfter && !doesCardTakeLead) {
      const honorDumpPenalty = cardNumericValue === 14 ? 12 : cardNumericValue === 13 ? 11 : cardNumericValue === 12 ? 9 : 7
      score -= honorDumpPenalty * conserveFactor
      score -= unseenHigherHonors * 2.5 * conserveFactor * memoryWeight
    }

    if (!allyLeadingAfter && !doesCardTakeLead) {
      const failedHonorPenalty = cardNumericValue === 14 ? 10 : cardNumericValue === 13 ? 9 : cardNumericValue === 12 ? 8 : 6
      score -= failedHonorPenalty * conserveFactor
      score -= unseenHigherHonors * 2 * conserveFactor * memoryWeight
    }
  }

  if (allyLeadingBefore && beforeLeader && beforeLeader.playerNum !== afterLeader.playerNum) {
    score -= pointsBefore <= 2 ? 18 : 12
  }

  if (effectiveColor === 'ATOUT') {
    const unseenHigherTrumps = countUnseenHigherTrumps(card, handCards, memory)

    if (!doesCardTakeLead && !allyLeadingBefore) {
      score -= 6
    }

    if (doesCardTakeLead && pointsAfter <= 2) {
      score -= 8 * conserveFactor
    }

    if (cardRank >= 18 && pointsAfter < 4) {
      score -= 10 * conserveFactor
    }

    if (cardRank <= 8 && doesCardTakeLead) {
      score += 4
    }

    if (doesCardTakeLead && unseenHigherTrumps > 0) {
      const overtrumpRiskPenalty = (pointsAfter >= 6 ? 2 : 4) * unseenHigherTrumps
      score -= overtrumpRiskPenalty * memoryWeight
    }

    if (doesCardTakeLead && unseenHigherTrumps === 0 && cardRank >= 14) {
      score += 8 * tuning.captureBias
    }

    if (doesCardTakeLead && outstandingHighTrumps <= 1 && cardRank <= 12) {
      score += 4 * conceptWeight
    }

    if (!doesCardTakeLead && cardRank >= 17 && !allyLeadingAfter) {
      score -= 9 * conserveFactor
    }

    if (trumpHuntPressure > 0 && trickCount <= 8) {
      if (doesCardTakeLead && cardRank >= 9 && cardRank <= 15) {
        score += trumpHuntPressure * 3.5 * conceptWeight
      }

      if (!doesCardTakeLead && cardRank >= 18 && outstandingHighTrumps >= 2) {
        score -= trumpHuntPressure * 2 * memoryWeight
      }
    }

    if (takerNum && trickCount <= 6) {
      if (isTakerSide) {
        if (doesCardTakeLead && unseenHigherTrumps === 0 && cardRank >= 9 && cardRank <= 14) {
          score += 5 * conceptWeight
        }
      } else {
        if (doesCardTakeLead && unseenHigherTrumps === 0 && cardRank >= 10 && cardRank <= 15 && pointsAfter <= 5) {
          score += 4 * conceptWeight
        }

        if (!doesCardTakeLead && cardRank >= 18 && outstandingHighTrumps >= 2) {
          score -= 5 * memoryWeight
        }
      }
    }
  }

  if (!isTrump(card) && !isExcuse(card)) {
    const knownVoidOpponents = countKnownVoidOpponentsForSuit(effectiveColor, myPlayerNum, teamByPlayerNum, memory)
    const takerVoidOnLedColor = takerNum && ledColor
      ? (memory.voidColorsByPlayer.get(takerNum)?.has(ledColor) ?? false)
      : false

    if (cardNumericValue >= 12) {
      if (allyLeadingAfter && !doesCardTakeLead) {
        score -= 8 * conserveFactor
      } else if (doesCardTakeLead && pointsAfter >= 5) {
        score += 3 * tuning.captureBias
      } else {
        score -= 12 * conserveFactor
      }

      if (knownVoidOpponents > 0 && doesCardTakeLead) {
        score -= knownVoidOpponents * 3.5 * memoryWeight
      }
    }

    if (cardNumericValue === 11 && allyLeadingAfter && !doesCardTakeLead) {
      score -= 5 * conserveFactor
    }

    if (!isTakerSide && takerVoidOnLedColor && takerPlaysAfterMe && !doesCardTakeLead) {
      score -= (cardNumericValue >= 11 ? 8 : 4) * conceptWeight
    }

    if (cardNumericValue <= 8 && !doesCardTakeLead) {
      score += 3
    }
  }

  if (isBoutCard(card)) {
    if (allyLeadingAfter && pointsAfter >= 3) {
      score += 4
    } else {
      score -= 20 * conserveFactor
    }
  }

  if (isExcuse(card)) {
    score += allyLeadingAfter ? -2 : 5
  }

  return score
}

function getFollowPriority(card: Card) {
  const color = getEffectiveColor(card)

  if (color === 'EXCUSE') {
    return 1000
  }

  if (color === 'ATOUT') {
    return 300 + getCardNumericValue(card.valeur)
  }

  return getCardNumericValue(card.valeur) + getColorOrder(card.couleur) * 20
}

async function ensureBotUsers(requiredCount = BOT_POOL_SIZE) {
  await ensureLobbySchema()
  await migrateLegacyPasswords()

  const desiredCount = Math.max(requiredCount, BOT_POOL_SIZE)

  for (let index = 1; index <= desiredCount; index += 1) {
    const email = `bot${index}@tarot.local`
    const pseudo = `Bot ${index}`
    const passwordHash = await hashPassword('bot')

    await query(
      `INSERT INTO utilisateur (nom, prenom, email, pseudo, motdepasse)
       SELECT ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM utilisateur WHERE email = ?
       )`,
      ['Bot', String(index), email, pseudo, passwordHash, email]
    )
  }

  return query<{ id: number; pseudo: string }>(
    `SELECT id, pseudo
     FROM utilisateur
     WHERE email LIKE 'bot%@tarot.local'
     ORDER BY id`
  )
}

async function getRoomPlayers(partieId: number) {
  // noinspection SqlResolve
  return query<BotPlayerRow>(
    `SELECT j.utilisateur, j.num, j.equipe, j.reponse, j.playerType, j.botLevel, u.pseudo,
            j.carte1, j.carte2, j.carte3, j.carte4, j.carte5,
            j.carte6, j.carte7, j.carte8, j.carte9, j.carte10,
            j.carte11, j.carte12, j.carte13, j.carte14, j.carte15
     FROM joueur j
     JOIN utilisateur u ON u.id = j.utilisateur
     WHERE j.partie = ?
     ORDER BY j.num`,
    [partieId]
  )
}

async function selectBotContract(cards: Card[], highestRank: number, botLevel: BotLevel | null): Promise<BidContract> {
  const tuning = getBotTuningProfile(botLevel)
  const trumpCount = cards.filter((card) => isTrump(card)).length
  const boutCount = cards.filter((card) => isBoutCard(card)).length
  const kingCount = cards.filter((card) => isKing(card)).length
  const queenCount = cards.filter((card) => !isTrump(card) && getCardNumericValue(card.valeur) === 13).length

  const strength = trumpCount * 1.2 + boutCount * 3 + kingCount * 1.4 + queenCount * 0.7 + tuning.bidShift

  let contract: BidContract = 'REFUSE'

  if (strength >= 24) {
    contract = 'GARDE_CONTRE'
  } else if (strength >= 19) {
    contract = 'GARDE_SANS'
  } else if (strength >= 14) {
    contract = 'GARDE'
  } else if (strength >= 10) {
    contract = 'PETITE'
  }

  if (getContractRank(contract) <= highestRank) {
    return 'REFUSE'
  }

  return contract
}

async function selectCalledKingCardId(cards: Card[]) {
  const handCardIds = new Set(cards.map((card) => card.id))
  const kingCards = await query<Card>(
    `SELECT id, lien, couleur, valeur, points
     FROM carte
     WHERE valeur = '14' AND couleur NOT IN ('ATOUT', 'BOUT')
     ORDER BY id`
  )

  const suitCounts = new Map<string, number>()
  for (const card of cards) {
    const color = getEffectiveColor(card)
    if (color !== 'ATOUT' && color !== 'EXCUSE') {
      suitCounts.set(color, (suitCounts.get(color) ?? 0) + 1)
    }
  }

  const candidates = kingCards
    .filter((card) => !handCardIds.has(card.id))
    .sort((cardA, cardB) => {
      const suitDelta = (suitCounts.get(getEffectiveColor(cardA)) ?? 0) - (suitCounts.get(getEffectiveColor(cardB)) ?? 0)
      if (suitDelta !== 0) {
        return suitDelta
      }

      return cardA.id - cardB.id
    })

  return (candidates[0] ?? kingCards[0])?.id ?? null
}

async function selectDogDiscardCard(partieId: number, playerNum: number) {
  const session = getGameSession(partieId)
  const playerRow = await getPlayerRowByNum(partieId, playerNum)

  if (!playerRow) {
    return null
  }

  const originalHandIds = extractPlayerCardIds(playerRow)
  const availableDogIds = session.dogCardIds.filter(
    (dogCardId) => !session.discardedDogCardIds.includes(dogCardId)
  )
  const cards = await getCardsByIds([...originalHandIds, ...availableDogIds])
  const currentCards = cards.filter((card) => !session.discardedDogCardIds.includes(card.id))
  const botLevel = playerRow.botLevel

  const candidates = currentCards
    .filter((card) => !isDogDiscardForbidden(card))
    .map((card) => ({
      card,
      score: evaluateDogDiscardCard(card, currentCards, botLevel),
      fallbackPriority: getDiscardPriority(card)
    }))
    .sort((entryA, entryB) => {
      if (entryB.score !== entryA.score) {
        return entryB.score - entryA.score
      }

      if (entryA.fallbackPriority !== entryB.fallbackPriority) {
        return entryA.fallbackPriority - entryB.fallbackPriority
      }

      return entryA.card.id - entryB.card.id
    })

  return candidates[0]?.card.id ?? null
}

async function selectPlayableCardId(partieId: number, player: BotPlayerRow, players: BotPlayerRow[]) {
  const session = getGameSession(partieId)
  const handCards = await getCardsByIds(extractPlayerCardIds(player))

  let trickCards: Card[] = []
  if (session.currentPliId && !session.finTour) {
    const pli = await queryOne<Record<string, any>>(
      `SELECT carte1, carte2, carte3, carte4, carte5
       FROM plis
       WHERE id = ? AND partie = ?`,
      [session.currentPliId, partieId]
    )

    if (pli) {
      const cardIds = [pli.carte1, pli.carte2, pli.carte3, pli.carte4, pli.carte5].filter(
        (cardId): cardId is number => cardId !== null && cardId !== undefined
      )
      trickCards = await getCardsByIds(cardIds)
    }
  }

  const playableIds = new Set(getPlayableCardIds(handCards, trickCards, session.trickCount))
  const playableCards = handCards.filter((card) => playableIds.has(card.id))

  if (playableCards.length === 0) {
    return null
  }

  const teamByPlayerNum = new Map(players.map((currentPlayer) => [currentPlayer.num, currentPlayer.equipe]))
  const firstPlayer = getFirstPlayerFromContext(session.firstPlayer, player.num, trickCards.length)
  const memory = await buildBotMemoryContext(partieId, session.firstPlayer, session.takerNum)
  const takerNum = session.takerNum ?? null

  const evaluatedCards = playableCards
    .map((card) => {
      const heuristicScore = trickCards.length === 0
        ? evaluateLeadCard(
            card,
            handCards,
            session.trickCount,
            player.botLevel,
            player.num,
            teamByPlayerNum,
            memory,
            takerNum
          )
        : evaluateFollowCard(
            card,
            handCards,
            trickCards,
            firstPlayer,
            player.num,
            teamByPlayerNum,
            session.trickCount,
            player.botLevel,
            memory,
            takerNum
          )

      const fallbackPriority = trickCards.length === 0 ? getLeadPriority(card) : getFollowPriority(card)

      return {
        card,
        heuristicScore,
        fallbackPriority
      }
    })
    .sort((entryA, entryB) => {
      if (entryB.heuristicScore !== entryA.heuristicScore) {
        return entryB.heuristicScore - entryA.heuristicScore
      }

      if (entryA.fallbackPriority !== entryB.fallbackPriority) {
        return entryA.fallbackPriority - entryB.fallbackPriority
      }

      return entryA.card.id - entryB.card.id
    })

  return evaluatedCards[0]?.card.id ?? null
}

async function getBotPhaseContext(partieId: number) {
  const room = await queryOne<RoomStateRow>(
    'SELECT status, mode, fillWithBots FROM partie WHERE id = ?',
    [partieId]
  )

  if (!room) {
    return null
  }

  const players = await getRoomPlayers(partieId)
  const answerCountRow = await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM joueur WHERE partie = ? AND reponse != 'WAIT'",
    [partieId]
  )
  // noinspection SqlResolve
  const taker = await queryOne<{ num: number; utilisateur: number; reponse: ContractType; playerType: PlayerType }>(
    `SELECT num, utilisateur, reponse, playerType
     FROM joueur
     WHERE partie = ? AND reponse NOT IN ('WAIT', 'REFUSE')
     ORDER BY FIELD(reponse, 'PETITE', 'GARDE', 'GARDE_SANS', 'GARDE_CONTRE') DESC, num DESC
     LIMIT 1`,
    [partieId]
  )

  return {
    room,
    players,
    answerCount: answerCountRow?.count ?? 0,
    taker
  }
}

async function getBotTurnPlan(partieId: number) {
  const context = await getBotPhaseContext(partieId)

  if (!context || context.room.status === 'FINISHED') {
    return null
  }

  if (context.players.length < 5) {
    return null
  }

  const session = getGameSession(partieId)
  const now = Date.now()

  if (context.answerCount >= 5 && !context.taker) {
    return {
      phase: 'FINISHED' as const,
      currentPlayer: null,
      delayMs: 0
    }
  }

  let phase: 'BIDDING' | 'CALLING' | 'DOG_EXCHANGE' | 'PLAYING'
  let currentPlayerNum: number
  let delayMs: number

  if (!context.taker) {
    phase = 'BIDDING'
    currentPlayerNum = (context.answerCount % 5) + 1
    delayMs = BOT_BID_DELAY_MS
  } else if (!session.calledKingColor) {
    phase = 'CALLING'
    currentPlayerNum = context.taker.num
    delayMs = BOT_CALL_KING_DELAY_MS
  } else if (session.discardedDogCardIds.length < 3) {
    phase = 'DOG_EXCHANGE'
    currentPlayerNum = context.taker.num
    delayMs = session.dogRetrieved ? BOT_DOG_DISCARD_DELAY_MS : BOT_DOG_RETRIEVE_DELAY_MS
  } else if (session.dogExchangeEndsAt && now < session.dogExchangeEndsAt) {
    phase = 'PLAYING'
    currentPlayerNum = session.currentTurn ?? ((context.taker.num % 5) + 1)
    delayMs = (session.dogExchangeEndsAt - now) + BOT_POST_DOG_DELAY_MS
  } else {
    phase = 'PLAYING'
    currentPlayerNum = session.currentTurn ?? ((context.taker.num % 5) + 1)
    delayMs = BOT_PLAY_DELAY_MS

    if (session.finTour) {
      const remainingCollectionDelay = Math.max((session.finTourEndsAt ?? (now + TRICK_COLLECTION_LOCK_MS)) - now, 0)
      delayMs = remainingCollectionDelay + BOT_POST_TRICK_DELAY_MS
    }
  }

  const currentPlayer = context.players.find((player) => player.num === currentPlayerNum) ?? null

  if (!currentPlayer || currentPlayer.playerType !== 'BOT') {
    return null
  }

  return {
    phase,
    currentPlayer,
    delayMs: Math.max(0, delayMs)
  }
}

async function handleBotBid(partieId: number, players: BotPlayerRow[], currentBot: BotPlayerRow) {
  const cards = await getCardsByIds(extractPlayerCardIds(currentBot))
  const highestRank = players.reduce((rank, player) => Math.max(rank, getContractRank(player.reponse)), 0)
  const contract = await selectBotContract(cards, highestRank, currentBot.botLevel)

  await setPlayerContractAction(currentBot.utilisateur, partieId, contract)
}

async function handleBotCallKing(partieId: number, currentBot: BotPlayerRow) {
  const cards = await getCardsByIds(extractPlayerCardIds(currentBot))
  const cardId = await selectCalledKingCardId(cards)

  if (!cardId) {
    throw createError({
      statusCode: 400,
      message: 'Aucun roi callable pour le bot'
    })
  }

  await callKingAction(partieId, cardId)
}

async function handleBotDogExchange(partieId: number, currentBot: BotPlayerRow) {
  const session = getGameSession(partieId)

  if (!session.dogRetrieved) {
    await retrieveDogAction(currentBot.utilisateur, partieId)
    return true
  }

  if (session.discardedDogCardIds.length >= 3) {
    return false
  }

  const cardId = await selectDogDiscardCard(partieId, currentBot.num)

  if (!cardId) {
    throw createError({
      statusCode: 400,
      message: 'Le bot ne trouve aucune carte a jeter au chien'
    })
  }

  const result = await discardDogAction(currentBot.utilisateur, partieId, cardId)
  return !result.dogDone
}

async function handleBotPlay(partieId: number, currentBot: BotPlayerRow, players: BotPlayerRow[]) {
  const session = getGameSession(partieId)

  if (session.finTour && session.finTourEndsAt && Date.now() < session.finTourEndsAt) {
    return false
  }

  const cardId = await selectPlayableCardId(partieId, currentBot, players)

  if (!cardId) {
    throw createError({
      statusCode: 400,
      message: 'Le bot ne trouve aucune carte jouable'
    })
  }

  await playCardAction(currentBot.utilisateur, partieId, cardId)
  return true
}

export async function fillRoomWithBots(partieId: number) {
  const botUsers = await ensureBotUsers()

  return withTransaction(async (connection) => {
    await ensureLobbySchema()

    const room = await txQueryOne<{ status: RoomStatus }>(
      connection,
      'SELECT status FROM partie WHERE id = ? FOR UPDATE',
      [partieId]
    )

    if (!room) {
      throw createError({
        statusCode: 404,
        message: 'Salon introuvable'
      })
    }

    if (room.status !== 'WAITING') {
      throw createError({
        statusCode: 400,
        message: 'Les bots ne peuvent etre ajoutes que sur un salon en attente'
      })
    }

    const roomPlayers = await txQuery<{ utilisateur: number; num: number }>(
      connection,
      'SELECT utilisateur, num FROM joueur WHERE partie = ? ORDER BY num',
      [partieId]
    )

    const playerCount = roomPlayers.length
    const missingSlots = Math.max(0, 5 - playerCount)

    if (missingSlots === 0) {
      return { addedCount: 0 }
    }

    const usedUserIds = new Set(roomPlayers.map((player) => player.utilisateur))
    const availableBots = botUsers.filter((botUser) => !usedUserIds.has(botUser.id)).slice(0, missingSlots)

    if (availableBots.length < missingSlots) {
      throw createError({
        statusCode: 500,
        message: 'Reserve de bots insuffisante'
      })
    }

    const usedNums = new Set(roomPlayers.map((player) => player.num))
    let addedCount = 0

    for (const botUser of availableBots) {
      let playerNum = 1
      while (usedNums.has(playerNum) && playerNum <= 5) {
        playerNum += 1
      }

      if (playerNum > 5) {
        break
      }

      // noinspection SqlResolve
      await txExecute(
        connection,
        `INSERT INTO joueur (utilisateur, num, partie, reponse, equipe, score, playerType, botLevel)
         VALUES (?, ?, ?, 'WAIT', 0, 0, 'BOT', ?)`,
        [botUser.id, playerNum, partieId, BOT_LEVEL]
      )

      usedNums.add(playerNum)
      addedCount += 1
    }

    if (addedCount > 0) {
      await txExecute(
        connection,
        'UPDATE partie SET fillWithBots = 1 WHERE id = ?',
        [partieId]
      )
    }

    return { addedCount }
  })
}

async function runSingleBotAction(partieId: number) {
  await ensureLobbySchema()

  const lockName = `tarot_bot_loop_${partieId}`
  const lock = await queryOne<{ acquired: number }>(
    'SELECT GET_LOCK(?, 0) AS acquired',
    [lockName]
  )

  if (!lock || lock.acquired !== 1) {
    return
  }

  try {
    const context = await getBotPhaseContext(partieId)

    if (!context || context.room.status === 'FINISHED') {
      return
    }

    const session = getGameSession(partieId)

    if (context.answerCount >= 5 && !context.taker) {
      session.finPartie = true
      await query(
        "UPDATE partie SET status = 'FINISHED' WHERE id = ?",
        [partieId]
      )
      return
    }

    const plan = await getBotTurnPlan(partieId)

    if (!plan) {
      return
    }

    if (!plan.currentPlayer) {
      return
    }

    const currentBot = plan.currentPlayer

    if (plan.phase === 'BIDDING') {
      await handleBotBid(partieId, context.players, currentBot)
      return
    }

    if (plan.phase === 'CALLING') {
      await handleBotCallKing(partieId, currentBot)
      return
    }

    if (plan.phase === 'DOG_EXCHANGE') {
      await handleBotDogExchange(partieId, currentBot)
      return
    }

    await handleBotPlay(partieId, currentBot, context.players)
  } finally {
    await query('SELECT RELEASE_LOCK(?)', [lockName])
  }
}

export function clearScheduledBotAction(partieId: number) {
  const existingTimer = botActionTimers.get(partieId)

  if (existingTimer) {
    clearTimeout(existingTimer)
    botActionTimers.delete(partieId)
  }
}

export async function scheduleBotsIfNeeded(partieId: number) {
  if (botActionTimers.has(partieId)) {
    return
  }

  const plan = await getBotTurnPlan(partieId)

  if (!plan) {
    return
  }

  const timer = setTimeout(async () => {
    botActionTimers.delete(partieId)

    try {
      await runSingleBotAction(partieId)
    } finally {
      await scheduleBotsIfNeeded(partieId)
    }
  }, plan.delayMs)

  botActionTimers.set(partieId, timer)
}
