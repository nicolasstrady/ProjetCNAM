import { callKingAction } from '~/server/utils/gameActions'
import { scheduleBotsIfNeeded } from '~/server/utils/bots'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const partieId = Number(body.partieId)
  const cardId = Number(body.cardId)

  if (!partieId || !cardId) {
    throw createError({
      statusCode: 400,
      message: 'Donnees incompletes'
    })
  }

  const result = await callKingAction(partieId, cardId)
  await scheduleBotsIfNeeded(partieId)
  return result
})
