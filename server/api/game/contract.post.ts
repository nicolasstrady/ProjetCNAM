import { query } from '~/server/utils/db'
import { getGameSession } from '~/server/utils/gameSession'

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

  const equipe = contract === 'REFUSE' ? 2 : 1

  await query(
    'UPDATE joueur SET reponse = ?, equipe = ? WHERE utilisateur = ? AND partie = ?',
    [contract, equipe, userId, partieId]
  )

  if (contract !== 'REFUSE') {
    const takerRows = await query<{ num: number }>(
      'SELECT num FROM joueur WHERE utilisateur = ? AND partie = ? LIMIT 1',
      [userId, partieId]
    )

    const session = getGameSession(partieId)
    session.takerNum = takerRows[0]?.num ?? null
  }

  return {
    success: true,
    message: 'Contrat enregistre'
  }
})
