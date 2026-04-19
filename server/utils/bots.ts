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
import { extractPlayerCardIds, getCardsByIds, getDogCardIds, getPlayerRowByNum } from '~/server/utils/gameData'
import { getGameSession } from '~/server/utils/gameSession'
import { hashPassword, migrateLegacyPasswords } from '~/server/utils/auth'
import { ensureLobbySchema } from '~/server/utils/lobbySchema'
import type { BotLevel, Card, ContractType, PlayerType, RoomMode, RoomStatus } from '~/types'
import {
  getCardNumericValue,
  getColorOrder,
  getEffectiveColor,
  getLedColorFromCards,
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
     ORDER BY id ASC`
  )
}

async function getRoomPlayers(partieId: number) {
  return query<BotPlayerRow>(
    `SELECT j.utilisateur, j.num, j.reponse, j.playerType, j.botLevel, u.pseudo,
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

async function selectBotContract(cards: Card[], highestRank: number): Promise<BidContract> {
  const trumpCount = cards.filter((card) => isTrump(card)).length
  const boutCount = cards.filter((card) => isBoutCard(card)).length
  const kingCount = cards.filter((card) => isKing(card)).length
  const queenCount = cards.filter((card) => !isTrump(card) && getCardNumericValue(card.valeur) === 13).length

  const strength = trumpCount * 1.2 + boutCount * 3 + kingCount * 1.4 + queenCount * 0.7

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
     ORDER BY id ASC`
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

  const candidates = cards
    .filter((card) => !session.discardedDogCardIds.includes(card.id))
    .filter((card) => !isDogDiscardForbidden(card))
    .sort((cardA, cardB) => getDiscardPriority(cardA) - getDiscardPriority(cardB))

  return candidates[0]?.id ?? null
}

async function selectPlayableCardId(partieId: number, player: BotPlayerRow) {
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

  const sortedCards = [...playableCards].sort((cardA, cardB) => {
    const priorityDelta = (trickCards.length === 0 ? getLeadPriority(cardA) - getLeadPriority(cardB) : getFollowPriority(cardA) - getFollowPriority(cardB))
    if (priorityDelta !== 0) {
      return priorityDelta
    }

    return cardA.id - cardB.id
  })

  const nonExcuse = sortedCards.find((card) => !isExcuse(card))
  return (nonExcuse ?? sortedCards[0])?.id ?? null
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

  let phase: 'BIDDING' | 'CALLING' | 'DOG_EXCHANGE' | 'PLAYING' = 'BIDDING'
  let currentPlayerNum: number | null = null
  let delayMs = 0

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
  const contract = await selectBotContract(cards, highestRank)

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

async function handleBotPlay(partieId: number, currentBot: BotPlayerRow) {
  const session = getGameSession(partieId)

  if (session.finTour && session.finTourEndsAt && Date.now() < session.finTourEndsAt) {
    return false
  }

  const cardId = await selectPlayableCardId(partieId, currentBot)

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
      'SELECT utilisateur, num FROM joueur WHERE partie = ? ORDER BY num ASC',
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

    await handleBotPlay(partieId, currentBot)
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
