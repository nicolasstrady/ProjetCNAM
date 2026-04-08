import { joinRoomByReference } from '~/server/utils/lobby'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    userId?: number
    partieId?: number
    code?: string
  }>(event)

  const userId = Number(body.userId)
  const partieId = body.partieId ? Number(body.partieId) : null
  const code = body.code?.trim() || null

  if (!userId || (!partieId && !code)) {
    throw createError({
      statusCode: 400,
      message: 'userId et partieId ou code requis'
    })
  }

  const result = await joinRoomByReference(userId, {
    partieId,
    code
  })

  return {
    success: true as const,
    partieId: result.partieId,
    playerNum: result.playerNum ?? null,
    room: result.room,
    alreadyJoined: result.alreadyJoined
  }
})
