import { extractPlayerCardIds, getCardsByIds, getPlayerRow } from '~/server/utils/gameData'
import { getGameSession } from '~/server/utils/gameSession'

export default defineEventHandler(async (event) => {
  const queryParams = getQuery(event)
  const userId = Number(queryParams.userId)
  const partieId = Number(queryParams.partieId)

  if (!userId || !partieId) {
    throw createError({
      statusCode: 400,
      message: 'userId et partieId requis'
    })
  }

  const player = await getPlayerRow(userId, partieId)

  if (!player) {
    throw createError({
      statusCode: 404,
      message: 'Joueur non trouve'
    })
  }

  const session = getGameSession(partieId)
  const cardIds = extractPlayerCardIds(player)

  if (session.takerNum === player.num && session.dogRetrieved && session.discardedDogCardIds.length < 3) {
    for (const dogCardId of session.dogCardIds) {
      if (!session.discardedDogCardIds.includes(dogCardId)) {
        cardIds.push(dogCardId)
      }
    }
  }

  const cards = await getCardsByIds(cardIds)

  return {
    success: true as const,
    playerNum: player.num as number,
    cards
  }
})
