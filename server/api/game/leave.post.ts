import { query, queryOne, txExecute, txQuery, txQueryOne, withTransaction } from '~/server/utils/db'
import { clearScheduledBotAction } from '~/server/utils/bots'
import { resetGameSession } from '~/server/utils/gameSession'
import { ensureLobbySchema } from '~/server/utils/lobbySchema'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ userId?: number; partieId?: number }>(event)
  const userId = Number(body.userId)
  const partieId = Number(body.partieId)

  if (!userId || !partieId) {
    throw createError({
      statusCode: 400,
      message: 'userId et partieId requis'
    })
  }

  await ensureLobbySchema()

  const room = await queryOne<{ status: string; ownerUserId: number | null }>(
    'SELECT status, ownerUserId FROM partie WHERE id = ?',
    [partieId]
  )

  if (!room) {
    throw createError({
      statusCode: 404,
      message: 'Salon introuvable'
    })
  }

  if (room.status === 'WAITING') {
    await withTransaction(async (connection) => {
      const player = await txQueryOne<{ id: number }>(
        connection,
        'SELECT id FROM joueur WHERE utilisateur = ? AND partie = ? LIMIT 1',
        [userId, partieId]
      )

      if (!player) {
        return
      }

      await txExecute(
        connection,
        'DELETE FROM joueur WHERE utilisateur = ? AND partie = ?',
        [userId, partieId]
      )

      const remainingPlayers = await txQuery<{ utilisateur: number; playerType: string }>(
        connection,
        'SELECT utilisateur, playerType FROM joueur WHERE partie = ? ORDER BY num ASC',
        [partieId]
      )

      const remainingHumans = remainingPlayers.filter((player) => player.playerType !== 'BOT')

      if (remainingHumans.length === 0) {
        clearScheduledBotAction(partieId)
        await txExecute(
          connection,
          "UPDATE partie SET status = 'FINISHED' WHERE id = ?",
          [partieId]
        )
        return
      }

      if (room.ownerUserId === userId) {
        await txExecute(
          connection,
          'UPDATE partie SET ownerUserId = ? WHERE id = ?',
          [remainingHumans[0].utilisateur, partieId]
        )
      }
    })

    return {
      success: true as const,
      closedRoom: false
    }
  }

  if (room.status === 'PLAYING') {
    clearScheduledBotAction(partieId)
    await query(
      "UPDATE partie SET status = 'FINISHED' WHERE id = ?",
      [partieId]
    )
    resetGameSession(partieId)

    return {
      success: true as const,
      closedRoom: true
    }
  }

  return {
    success: true as const,
    closedRoom: room.status === 'FINISHED'
  }
})
