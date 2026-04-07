import { query, queryOne } from '~/server/utils/db'
import { getCardsByIds, getDogCardIds } from '~/server/utils/gameData'
import { getGameSession } from '~/server/utils/gameSession'
import { calculateTarotFinalResult } from '~/server/utils/tarotScore'
import type { ContractType, TarotFinalResult } from '~/types'

const SCORABLE_CONTRACTS = ['PETITE', 'GARDE', 'GARDE_SANS', 'GARDE_CONTRE'] as const

export default defineEventHandler(async (event) => {
  const queryParams = getQuery(event)
  const partieId = Number(queryParams.partieId)
  const userId = Number(queryParams.userId)

  if (!partieId) {
    throw createError({
      statusCode: 400,
      message: 'partieId requis'
    })
  }

  const session = getGameSession(partieId)
  const viewerPlayer = userId
    ? await queryOne<{ num: number }>(
        'SELECT num FROM joueur WHERE utilisateur = ? AND partie = ? LIMIT 1',
        [userId, partieId]
      )
    : null

  const players = await query(
    `SELECT j.id, j.utilisateur, j.num, j.partie, j.reponse, j.equipe, j.score,
            u.pseudo,
            ((j.carte1 IS NOT NULL) + (j.carte2 IS NOT NULL) + (j.carte3 IS NOT NULL) + (j.carte4 IS NOT NULL) +
             (j.carte5 IS NOT NULL) + (j.carte6 IS NOT NULL) + (j.carte7 IS NOT NULL) + (j.carte8 IS NOT NULL) +
             (j.carte9 IS NOT NULL) + (j.carte10 IS NOT NULL) + (j.carte11 IS NOT NULL) + (j.carte12 IS NOT NULL) +
             (j.carte13 IS NOT NULL) + (j.carte14 IS NOT NULL) + (j.carte15 IS NOT NULL)) AS handCount
     FROM joueur j
     JOIN utilisateur u ON j.utilisateur = u.id
     WHERE j.partie = ?
     ORDER BY j.num`,
    [partieId]
  )

  const answerCount = await query<{ count: number }>(
    "SELECT COUNT(*) as count FROM joueur WHERE partie = ? AND reponse != 'WAIT'",
    [partieId]
  )

  const taker = await queryOne<{ num: number; reponse: ContractType }>(
    `SELECT num, reponse
     FROM joueur
     WHERE partie = ? AND reponse NOT IN ('WAIT', 'REFUSE')
     ORDER BY FIELD(reponse, 'PETITE', 'GARDE', 'GARDE_SANS', 'GARDE_CONTRE') DESC, num DESC
     LIMIT 1`,
    [partieId]
  )

  if (taker) {
    session.takerNum = taker.num
  }

  let currentPli = session.currentPliId
    ? await queryOne<Record<string, any>>(
        `SELECT id, carte1, carte2, carte3, carte4, carte5, joueurGagnant
         FROM plis
         WHERE partie = ? AND pliChien = 0 AND id = ?`,
        [partieId, session.currentPliId]
      )
    : null

  if (!currentPli) {
    currentPli = await queryOne<Record<string, any>>(
      `SELECT id, carte1, carte2, carte3, carte4, carte5, joueurGagnant
       FROM plis
       WHERE partie = ? AND pliChien = 0
       ORDER BY id DESC
       LIMIT 1`,
      [partieId]
    )

    session.currentPliId = currentPli?.id ?? null
  }

  if (session.calledKingColor && session.dogCardIds.length === 0) {
    session.dogCardIds = await getDogCardIds(partieId)
  }

  const currentPliCardIds = currentPli
    ? [currentPli.carte1, currentPli.carte2, currentPli.carte3, currentPli.carte4, currentPli.carte5].filter(
        (cardId): cardId is number => cardId !== null && cardId !== undefined
      )
    : []
  const currentPliCardsData = await getCardsByIds(currentPliCardIds)
  const currentPliCards = currentPliCardsData.map((card, index) => ({
    position: index + 1,
    playerNum: session.firstPlayer
      ? ((session.firstPlayer - 1 + index) % 5) + 1
      : null,
    card
  }))

  const calledKingPlayedCount = session.calledKingCardId
    ? await query<{ count: number }>(
        `SELECT COUNT(*) as count
         FROM plis
         WHERE partie = ? AND pliChien = 0 AND (
           carte1 = ? OR carte2 = ? OR carte3 = ? OR carte4 = ? OR carte5 = ?
         )`,
        [partieId, session.calledKingCardId, session.calledKingCardId, session.calledKingCardId, session.calledKingCardId, session.calledKingCardId]
      )
    : [{ count: 0 }]
  const teamsRevealed = (calledKingPlayedCount[0]?.count ?? 0) > 0

  let phase: 'BIDDING' | 'CALLING' | 'DOG_EXCHANGE' | 'PLAYING' | 'FINISHED' = 'BIDDING'

  if (taker) {
    if (!session.calledKingColor) {
      phase = 'CALLING'
    } else if (session.discardedDogCardIds.length < 3) {
      phase = 'DOG_EXCHANGE'
    } else if (session.dogExchangeEndsAt && Date.now() < session.dogExchangeEndsAt) {
      phase = 'DOG_EXCHANGE'
    } else if (session.finPartie) {
      phase = 'FINISHED'
    } else {
      session.dogExchangeEndsAt = null
      phase = 'PLAYING'
    }
  }

  const dogCards = phase === 'DOG_EXCHANGE'
    ? await getCardsByIds(session.dogCardIds)
    : []
  const viewerIsTaker = viewerPlayer?.num !== undefined && viewerPlayer.num === taker?.num
  const discardedDogCards = phase === 'DOG_EXCHANGE' && viewerIsTaker
    ? await getCardsByIds(session.discardedDogCardIds)
    : []

  const currentTurn = phase === 'BIDDING'
    ? ((answerCount[0]?.count ?? 0) % 5) + 1
    : phase === 'CALLING' || phase === 'DOG_EXCHANGE'
      ? taker?.num ?? session.currentTurn
      : session.currentTurn ?? (taker ? (taker.num % 5) + 1 : null)
  const finalResult: TarotFinalResult | null =
    phase === 'FINISHED' && taker && SCORABLE_CONTRACTS.includes(taker.reponse as (typeof SCORABLE_CONTRACTS)[number])
      ? await calculateTarotFinalResult(
          partieId,
          players,
          taker.num,
          taker.reponse as (typeof SCORABLE_CONTRACTS)[number],
          session.partnerNum
        )
      : null

  return {
    success: true as const,
    players,
    answerCount: answerCount[0]?.count || 0,
    taker,
    currentTurn,
    trickCount: session.trickCount,
    currentPli: currentPli
      ? {
          id: currentPli.id,
          joueurGagnant: currentPli.joueurGagnant ?? null
        }
      : null,
    currentPliCards,
    discardedDogCards,
    partnerNum: session.partnerNum,
    teamsRevealed,
    calledKingColor: session.calledKingColor,
    dogCards,
    dogRetrieved: session.dogRetrieved,
    dogDiscardCount: session.discardedDogCardIds.length,
    finTour: session.finTour,
    finPartie: session.finPartie,
    phase,
    finalResult
  }
})
