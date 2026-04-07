import {
  extractPlayerCardIds,
  getCardById,
  getCardsByIds,
  getPlayerRow,
  writePlayerCardIds
} from '~/server/utils/gameData'
import { getGameSession } from '~/server/utils/gameSession'
import { query } from '~/server/utils/db'
import { isDogDiscardForbidden } from '~/utils/tarot'

const DOG_EXCHANGE_COMPLETION_DELAY_MS = 1800

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
})
