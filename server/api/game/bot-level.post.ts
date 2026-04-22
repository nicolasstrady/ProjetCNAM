import type { BotLevel } from '~/types'
import { updateLobbyBotLevel } from '~/server/utils/lobby'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    userId?: number
    partieId?: number
    botUserId?: number
    botLevel?: BotLevel
  }>(event)

  const userId = Number(body.userId)
  const partieId = Number(body.partieId)
  const botUserId = Number(body.botUserId)
  const botLevel = String(body.botLevel ?? '').toUpperCase() as BotLevel

  if (!userId || !partieId || !botUserId || !botLevel) {
    throw createError({
      statusCode: 400,
      message: 'userId, partieId, botUserId et botLevel requis'
    })
  }

  return updateLobbyBotLevel(userId, partieId, botUserId, botLevel)
})
