import { getDogCardIds } from '~/server/utils/gameData'
import { getGameSession } from '~/server/utils/gameSession'
import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const userId = Number(body.userId)
  const partieId = Number(body.partieId)

  if (!userId || !partieId) {
    throw createError({
      statusCode: 400,
      message: 'Donnees incompletes'
    })
  }

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
})
