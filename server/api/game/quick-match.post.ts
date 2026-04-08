import { quickMatch } from '~/server/utils/lobby'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ userId?: number }>(event)
  const userId = Number(body.userId)

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'userId requis'
    })
  }

  const result = await quickMatch(userId)

  return {
    success: true as const,
    partieId: result.partieId,
    playerNum: result.playerNum ?? null,
    room: result.room,
    alreadyJoined: result.alreadyJoined
  }
})
