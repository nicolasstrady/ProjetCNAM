import { retrieveDogAction } from '~/server/utils/gameActions'
import { scheduleBotsIfNeeded } from '~/server/utils/bots'

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

  const result = await retrieveDogAction(userId, partieId)
  await scheduleBotsIfNeeded(partieId)
  return result
})
