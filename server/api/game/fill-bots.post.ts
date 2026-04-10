import { fillRoomWithBots } from '~/server/utils/bots'
import { listLobbyRooms } from '~/server/utils/lobby'
import { queryOne } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ partieId?: number; userId?: number }>(event)
  const partieId = Number(body.partieId)
  const userId = Number(body.userId)

  if (!partieId || !userId) {
    throw createError({
      statusCode: 400,
      message: 'partieId et userId requis'
    })
  }

  const membership = await queryOne<{ id: number }>(
    'SELECT id FROM joueur WHERE utilisateur = ? AND partie = ? LIMIT 1',
    [userId, partieId]
  )

  if (!membership) {
    throw createError({
      statusCode: 403,
      message: 'Vous devez etre present dans le salon pour y ajouter des bots'
    })
  }

  const result = await fillRoomWithBots(partieId)
  const rooms = await listLobbyRooms(userId)

  return {
    success: true as const,
    addedCount: result.addedCount,
    activeRoom: rooms.activeRoom
  }
})
