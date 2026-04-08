import { query, queryOne } from '~/server/utils/db'
import {
  extractPlayerCardIds,
  getCardById,
  getCardsByIds,
  getFirstEmptyPliPosition,
  getPlayerRow
} from '~/server/utils/gameData'
import { getGameSession } from '~/server/utils/gameSession'
import { ensureLobbySchema } from '~/server/utils/lobbySchema'
import { getCardPlayError, getCardRank, getEffectiveColor, getLedColorFromCards, isExcuse } from '~/utils/tarot'

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

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const userId = Number(body.userId)
  const partieId = Number(body.partieId)
  const cardId = Number(body.cardId)

  if (!userId || !partieId || !cardId) {
    throw createError({
      statusCode: 400,
      message: 'Donnees incompletes'
    })
  }

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
  }

  return {
    success: true,
    message: 'Carte jouee',
    currentTurn: session.currentTurn,
    finTour: session.finTour,
    finPartie: session.finPartie
  }
})
