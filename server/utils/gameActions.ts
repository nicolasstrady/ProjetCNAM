import { query, queryOne } from '~/server/utils/db'
import {
  extractPlayerCardIds,
  getCardById,
  getCardsByIds,
  getDogCardIds,
  getFirstEmptyPliPosition,
  getPlayerRow,
  writePlayerCardIds
} from '~/server/utils/gameData'
import { getGameSession } from '~/server/utils/gameSession'
import { ensureLobbySchema } from '~/server/utils/lobbySchema'
import {
  getCardPlayError,
  getCardRank,
  getEffectiveColor,
  getLedColorFromCards,
  isDogDiscardForbidden,
  isExcuse,
  normalizeCardColor
} from '~/utils/tarot'

export const DOG_EXCHANGE_COMPLETION_DELAY_MS = 1800
export const TRICK_COLLECTION_DELAY_MS = 1500
export const TRICK_COLLECTION_ANIMATION_DURATION_MS = 760
export const TRICK_COLLECTION_LOCK_MS = TRICK_COLLECTION_DELAY_MS + TRICK_COLLECTION_ANIMATION_DURATION_MS

async function getCurrentPli(partieId: number, pliId: number | null) {
  if (!pliId) {
    return null
  }

  return queryOne<Record<string, any>>(
    `SELECT id, carte1, carte2, carte3, carte4, carte5, joueurGagnant
     FROM plis
     WHERE partie = ? AND pliChien = 0 AND id = ?`,
    [partieId, pliId]
  )
}

async function determineWinner(partieId: number, pliId: number, firstPlayer: number, ledColor: string) {
  const pli = await getCurrentPli(partieId, pliId)

  if (!pli) {
    return firstPlayer
  }

  const playedIds = [pli.carte1, pli.carte2, pli.carte3, pli.carte4, pli.carte5] as number[]
  const cards = await getCardsByIds(playedIds)
  const cardsById = new Map(cards.map((card) => [card.id, card]))

  let winner = firstPlayer
  let bestColor = ledColor
  let bestRank = -1
  let currentPlayer = firstPlayer

  for (const cardId of playedIds) {
    const card = cardsById.get(cardId)

    if (!card) {
      currentPlayer = currentPlayer === 5 ? 1 : currentPlayer + 1
      continue
    }

    const effectiveColor = getEffectiveColor(card)
    const rank = getCardRank(card)

    if (bestRank === -1) {
      bestColor = effectiveColor === 'EXCUSE' ? ledColor : effectiveColor
      bestRank = rank
      winner = currentPlayer
    } else if (effectiveColor !== 'EXCUSE') {
      if (bestColor === 'ATOUT') {
        if (effectiveColor === 'ATOUT' && rank > bestRank) {
          bestRank = rank
          winner = currentPlayer
        }
      } else if (effectiveColor === 'ATOUT') {
        bestColor = 'ATOUT'
        bestRank = rank
        winner = currentPlayer
      } else if (effectiveColor === ledColor && rank > bestRank) {
        bestRank = rank
        winner = currentPlayer
      }
    }

    currentPlayer = currentPlayer === 5 ? 1 : currentPlayer + 1
  }

  return winner
}

async function calculatePoints(partieId: number, pliId: number, firstPlayer: number) {
  const pli = await getCurrentPli(partieId, pliId)

  if (!pli) {
    return {
      total: 0,
      lastExcusePlayer: null as number | null,
      lastExcusePoints: 0
    }
  }

  const playedIds = [pli.carte1, pli.carte2, pli.carte3, pli.carte4, pli.carte5].filter(
    (cardId): cardId is number => cardId !== null && cardId !== undefined
  )
  const cards = await getCardsByIds(playedIds)
  const cardsById = new Map(cards.map((card) => [card.id, card]))

  let total = 0
  let lastExcusePlayer: number | null = null
  let lastExcusePoints = 0

  playedIds.forEach((cardId, index) => {
    const card = cardsById.get(cardId)

    if (!card) {
      return
    }

    if (isExcuse(card)) {
      lastExcusePlayer = ((firstPlayer + index - 1) % 5) + 1
      lastExcusePoints = card.points
      return
    }

    total += card.points
  })

  return {
    total,
    lastExcusePlayer,
    lastExcusePoints
  }
}

export async function setPlayerContractAction(userId: number, partieId: number, contract: string) {
  const equipe = contract === 'REFUSE' ? 2 : 1

  await query(
    'UPDATE joueur SET reponse = ?, equipe = ? WHERE utilisateur = ? AND partie = ?',
    [contract, equipe, userId, partieId]
  )

  if (contract !== 'REFUSE') {
    const takerRows = await query<{ num: number }>(
      'SELECT num FROM joueur WHERE utilisateur = ? AND partie = ? LIMIT 1',
      [userId, partieId]
    )

    const session = getGameSession(partieId)
    session.takerNum = takerRows[0]?.num ?? null
  }

  return {
    success: true as const,
    message: 'Contrat enregistre'
  }
}

export async function callKingAction(partieId: number, cardId: number) {
  const takerRows = await query<{ num: number }>(
    `SELECT num
     FROM joueur
     WHERE partie = ? AND reponse NOT IN ('WAIT', 'REFUSE')
     ORDER BY FIELD(reponse, 'PETITE', 'GARDE', 'GARDE_SANS', 'GARDE_CONTRE') DESC, num DESC
     LIMIT 1`,
    [partieId]
  )

  if (takerRows.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Aucun preneur trouve'
    })
  }

  const takerNum = takerRows[0].num

  const partnerRows = await query<{ num: number }>(
    `SELECT num
     FROM joueur
     WHERE partie = ? AND (
       carte1 = ? OR carte2 = ? OR carte3 = ? OR carte4 = ? OR carte5 = ? OR
       carte6 = ? OR carte7 = ? OR carte8 = ? OR carte9 = ? OR carte10 = ? OR
       carte11 = ? OR carte12 = ? OR carte13 = ? OR carte14 = ? OR carte15 = ?
     )`,
    [partieId, ...Array(15).fill(cardId)]
  )

  const partnerNum = partnerRows[0]?.num ?? null

  const cardRows = await query<{ couleur: string }>(
    'SELECT couleur FROM carte WHERE id = ? LIMIT 1',
    [cardId]
  )

  const couleur = cardRows[0] ? normalizeCardColor(cardRows[0].couleur) : null
  const dogCardIds = await getDogCardIds(partieId)
  const dogCards = await getCardsByIds(dogCardIds)

  await query('UPDATE joueur SET equipe = 2 WHERE partie = ?', [partieId])
  await query('UPDATE joueur SET equipe = 1 WHERE partie = ? AND num = ?', [partieId, takerNum])

  if (partnerNum !== null) {
    await query('UPDATE joueur SET equipe = 1 WHERE partie = ? AND num = ?', [partieId, partnerNum])
  }

  const session = getGameSession(partieId)
  session.takerNum = takerNum
  session.partnerNum = partnerNum
  session.calledKingCardId = cardId
  session.calledKingColor = couleur
  session.dogCardIds = dogCardIds
  session.dogRetrieved = false
  session.discardedDogCardIds = []
  session.dogExchangeEndsAt = null
  session.currentPliId = null
  session.currentTurn = takerNum
  session.firstPlayer = null
  session.ledColor = ''
  session.trickCount = 0
  session.finTour = false
  session.finTourEndsAt = null
  session.finPartie = false

  return {
    success: true as const,
    partnerNum,
    couleur,
    cardId,
    dogCards
  }
}

export async function retrieveDogAction(userId: number, partieId: number) {
  const playerRows = await query<{ num: number }>(
    'SELECT num FROM joueur WHERE utilisateur = ? AND partie = ? LIMIT 1',
    [userId, partieId]
  )

  if (playerRows.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Joueur introuvable'
    })
  }

  const session = getGameSession(partieId)

  if (session.takerNum !== playerRows[0].num) {
    throw createError({
      statusCode: 403,
      message: 'Seul le preneur peut recuperer le chien'
    })
  }

  if (session.dogCardIds.length === 0) {
    session.dogCardIds = await getDogCardIds(partieId)
  }

  session.dogRetrieved = true

  return {
    success: true as const,
    dogCardIds: session.dogCardIds
  }
}

export async function discardDogAction(userId: number, partieId: number, cardId: number) {
  const session = getGameSession(partieId)
  const player = await getPlayerRow(userId, partieId)

  if (!player) {
    throw createError({
      statusCode: 404,
      message: 'Joueur introuvable'
    })
  }

  if (session.takerNum !== player.num) {
    throw createError({
      statusCode: 403,
      message: 'Seul le preneur peut faire le chien'
    })
  }

  if (!session.dogRetrieved) {
    throw createError({
      statusCode: 400,
      message: 'Le chien na pas encore ete recupere'
    })
  }

  if (session.discardedDogCardIds.includes(cardId)) {
    throw createError({
      statusCode: 400,
      message: 'Cette carte a deja ete mise au chien'
    })
  }

  const card = await getCardById(cardId)

  if (!card) {
    throw createError({
      statusCode: 404,
      message: 'Carte introuvable'
    })
  }

  if (isDogDiscardForbidden(card)) {
    throw createError({
      statusCode: 400,
      message: 'Cette carte ne peut pas aller au chien'
    })
  }

  const originalHandIds = extractPlayerCardIds(player)
  const availableDogIds = session.dogCardIds.filter(
    (dogCardId) => !session.discardedDogCardIds.includes(dogCardId)
  )
  const availableIds = new Set([...originalHandIds, ...availableDogIds])

  if (!availableIds.has(cardId)) {
    throw createError({
      statusCode: 400,
      message: 'Cette carte nest pas disponible pour le chien'
    })
  }

  session.discardedDogCardIds.push(cardId)

  let dogPli = await query<{ id: number }>(
    'SELECT id FROM plis WHERE partie = ? AND pliChien = 1 ORDER BY id DESC LIMIT 1',
    [partieId]
  )
  let dogPliId = dogPli[0]?.id

  if (!dogPliId) {
    const insertResult = await query(
      'INSERT INTO plis (partie, pliChien) VALUES (?, 1)',
      [partieId]
    ) as any
    dogPliId = insertResult.insertId as number
  }

  await query(
    `UPDATE plis SET carte${session.discardedDogCardIds.length} = ? WHERE id = ? AND partie = ?`,
    [cardId, dogPliId, partieId]
  )

  if (session.discardedDogCardIds.length === 3) {
    const keptDogIds = session.dogCardIds.filter((dogCardId) => !session.discardedDogCardIds.includes(dogCardId))
    const keptOriginalIds = originalHandIds.filter((handCardId) => !session.discardedDogCardIds.includes(handCardId))

    await writePlayerCardIds(userId, partieId, [...keptOriginalIds, ...keptDogIds])

    session.currentTurn = session.takerNum === 5 ? 1 : (session.takerNum ?? 0) + 1
    session.firstPlayer = session.currentTurn
    session.currentPliId = null
    session.ledColor = ''
    session.finTour = false
    session.finTourEndsAt = null
    session.finPartie = false
    session.trickCount = 0
    session.dogExchangeEndsAt = Date.now() + DOG_EXCHANGE_COMPLETION_DELAY_MS
  }

  return {
    success: true as const,
    dogDone: session.discardedDogCardIds.length === 3,
    dogDiscardCount: session.discardedDogCardIds.length,
    discardedCards: await getCardsByIds(session.discardedDogCardIds)
  }
}

export async function playCardAction(userId: number, partieId: number, cardId: number) {
  await ensureLobbySchema()

  const session = getGameSession(partieId)

  if (!session.calledKingColor || session.discardedDogCardIds.length < 3) {
    return {
      success: false as const,
      message: 'Le jeu nest pas encore en phase de pli'
    }
  }

  if (session.dogExchangeEndsAt && Date.now() < session.dogExchangeEndsAt) {
    return {
      success: false as const,
      message: 'Le chien est en cours de validation'
    }
  }

  const player = await getPlayerRow(userId, partieId)

  if (!player) {
    return {
      success: false as const,
      message: 'Joueur introuvable'
    }
  }

  if (session.currentTurn !== null && session.currentTurn !== player.num) {
    return {
      success: false as const,
      message: 'Ce nest pas votre tour'
    }
  }

  const card = await getCardById(cardId)

  if (!card) {
    return {
      success: false as const,
      message: 'Carte introuvable'
    }
  }

  const playerCardIds = extractPlayerCardIds(player)

  if (!playerCardIds.includes(cardId)) {
    return {
      success: false as const,
      message: 'Cette carte nest pas dans votre main'
    }
  }

  let pli = await getCurrentPli(partieId, session.currentPliId)
  const existingCards = pli
    ? [pli.carte1, pli.carte2, pli.carte3, pli.carte4, pli.carte5].filter(
        (currentCardId): currentCardId is number => currentCardId !== null && currentCardId !== undefined
      )
    : []

  if (!pli || existingCards.length === 5 || session.finTour) {
    const result = await query(
      'INSERT INTO plis (partie, pliChien) VALUES (?, 0)',
      [partieId]
    ) as any

    session.currentPliId = result.insertId as number
    session.firstPlayer = session.currentTurn ?? player.num
    session.ledColor = ''
    session.finTour = false
    session.finTourEndsAt = null
    pli = await getCurrentPli(partieId, session.currentPliId)
  }

  const position = getFirstEmptyPliPosition(pli)

  if (!position || !session.currentPliId) {
    return {
      success: false as const,
      message: 'Aucune position disponible dans le pli'
    }
  }

  const effectiveColor = getEffectiveColor(card)
  const playerCards = await getCardsByIds(playerCardIds)
  const currentTrickCards = position === 1 ? [] : await getCardsByIds(existingCards)

  if (position === 1) {
    const playError = getCardPlayError(playerCards, card, [], session.trickCount)

    if (playError) {
      return {
        success: false as const,
        message: playError
      }
    }

    session.firstPlayer = player.num
    session.ledColor = effectiveColor === 'EXCUSE' ? '' : effectiveColor
  } else {
    const playError = getCardPlayError(playerCards, card, currentTrickCards, session.trickCount)

    if (playError) {
      return {
        success: false as const,
        message: playError
      }
    }

    session.ledColor = getLedColorFromCards([...currentTrickCards, card])
  }

  await query(
    `UPDATE plis SET carte${position} = ? WHERE id = ? AND partie = ?`,
    [cardId, session.currentPliId, partieId]
  )

  for (let slotIndex = 1; slotIndex <= 15; slotIndex += 1) {
    if (player[`carte${slotIndex}`] === cardId) {
      await query(
        `UPDATE joueur SET carte${slotIndex} = NULL WHERE utilisateur = ? AND partie = ?`,
        [userId, partieId]
      )
      break
    }
  }

  const updatedPli = await getCurrentPli(partieId, session.currentPliId)
  const filledCount = updatedPli
    ? [updatedPli.carte1, updatedPli.carte2, updatedPli.carte3, updatedPli.carte4, updatedPli.carte5].filter(
        (currentCardId): currentCardId is number => currentCardId !== null && currentCardId !== undefined
      ).length
    : 0

  if (filledCount === 5 && session.currentPliId) {
    const winner = await determineWinner(
      partieId,
      session.currentPliId,
      session.firstPlayer ?? player.num,
      session.ledColor
    )
    const points = await calculatePoints(
      partieId,
      session.currentPliId,
      session.firstPlayer ?? player.num
    )

    await query(
      'UPDATE joueur SET score = score + ? WHERE num = ? AND partie = ?',
      [points.total, winner, partieId]
    )

    if (points.lastExcusePlayer !== null) {
      await query(
        'UPDATE joueur SET score = score + ? WHERE num = ? AND partie = ?',
        [points.lastExcusePoints, points.lastExcusePlayer, partieId]
      )
    }

    await query(
      'UPDATE plis SET joueurGagnant = ? WHERE id = ? AND partie = ?',
      [winner, session.currentPliId, partieId]
    )

    session.currentTurn = winner
    session.ledColor = ''
    session.finTour = true
    session.finTourEndsAt = Date.now() + TRICK_COLLECTION_LOCK_MS
    session.trickCount += 1
    session.finPartie = session.trickCount >= 15

    if (session.finPartie) {
      await query(
        "UPDATE partie SET status = 'FINISHED' WHERE id = ?",
        [partieId]
      )
    }
  } else {
    session.currentTurn = player.num === 5 ? 1 : player.num + 1
    session.finTour = false
    session.finTourEndsAt = null
  }

  return {
    success: true as const,
    message: 'Carte jouee',
    currentTurn: session.currentTurn,
    finTour: session.finTour,
    finPartie: session.finPartie
  }
}
