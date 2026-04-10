import { setPlayerContractAction } from '~/server/utils/gameActions'
import { scheduleBotsIfNeeded } from '~/server/utils/bots'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const userId = Number(body.userId)
  const partieId = Number(body.partieId)
  const contract = String(body.contract ?? '')

  if (!userId || !partieId || !contract) {
    throw createError({
      statusCode: 400,
      message: 'Donnees incompletes'
    })
  }

  const result = await setPlayerContractAction(userId, partieId, contract)
  await scheduleBotsIfNeeded(partieId)
  return result
})
