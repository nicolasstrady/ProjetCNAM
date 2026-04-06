import { query } from '~/server/utils/db'
import { getCardsByIds, getDogCardIds } from '~/server/utils/gameData'
import { getGameSession } from '~/server/utils/gameSession'
import { normalizeCardColor } from '~/utils/tarot'

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

  const takerRows = await query<{ num: number }>(
    `SELECT num
     FROM joueur
     WHERE partie = ? AND reponse NOT IN ('WAIT', 'REFUSE')
     ORDER BY FIELD(reponse, 'PETITE', 'GARDE', 'GARDE_SANS', 'GARDE_CONTRE') DESC, num DESC
     LIMIT 1`,
    [partieId]
  )

  if (takerRows.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Aucun preneur trouve'
    })
  }

  const takerNum = takerRows[0].num

  const partnerRows = await query<{ num: number }>(
    `SELECT num
     FROM joueur
     WHERE partie = ? AND (
       carte1 = ? OR carte2 = ? OR carte3 = ? OR carte4 = ? OR carte5 = ? OR
       carte6 = ? OR carte7 = ? OR carte8 = ? OR carte9 = ? OR carte10 = ? OR
       carte11 = ? OR carte12 = ? OR carte13 = ? OR carte14 = ? OR carte15 = ?
     )`,
    [partieId, ...Array(15).fill(cardId)]
  )

  const partnerNum = partnerRows[0]?.num ?? null

  const cardRows = await query<{ couleur: string }>(
    'SELECT couleur FROM carte WHERE id = ? LIMIT 1',
    [cardId]
  )

  const couleur = cardRows[0] ? normalizeCardColor(cardRows[0].couleur) : null
  const dogCardIds = await getDogCardIds(partieId)
  const dogCards = await getCardsByIds(dogCardIds)

  await query('UPDATE joueur SET equipe = 2 WHERE partie = ?', [partieId])
  await query('UPDATE joueur SET equipe = 1 WHERE partie = ? AND num = ?', [partieId, takerNum])

  if (partnerNum !== null) {
    await query('UPDATE joueur SET equipe = 1 WHERE partie = ? AND num = ?', [partieId, partnerNum])
  }

  const session = getGameSession(partieId)
  session.takerNum = takerNum
  session.partnerNum = partnerNum
  session.calledKingCardId = cardId
  session.calledKingColor = couleur
  session.dogCardIds = dogCardIds
  session.dogRetrieved = false
  session.discardedDogCardIds = []
  session.currentPliId = null
  session.currentTurn = takerNum
  session.firstPlayer = null
  session.ledColor = ''
  session.trickCount = 0
  session.finTour = false
  session.finPartie = false

  return {
    success: true as const,
    partnerNum,
    couleur,
    cardId,
    dogCards
  }
})
