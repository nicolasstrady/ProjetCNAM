import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { partieId, cardId } = body
  
  if (!partieId || !cardId) {
    throw createError({
      statusCode: 400,
      message: 'Données incomplètes'
    })
  }
  
  // Trouver le joueur qui a cette carte
  const players = await query(
    `SELECT num FROM joueur WHERE partie = ? AND (
      carte1 = ? OR carte2 = ? OR carte3 = ? OR carte4 = ? OR carte5 = ? OR
      carte6 = ? OR carte7 = ? OR carte8 = ? OR carte9 = ? OR carte10 = ? OR
      carte11 = ? OR carte12 = ? OR carte13 = ? OR carte14 = ? OR carte15 = ?
    )`,
    [partieId, ...Array(15).fill(cardId)]
  )
  
  const partnerNum = players.length > 0 ? (players[0] as any).num : null
  
  // Récupérer la couleur de la carte
  const cardData = await query(
    'SELECT couleur FROM carte WHERE id = ?',
    [cardId]
  )
  
  const couleur = cardData.length > 0 ? (cardData[0] as any).couleur : null
  
  return {
    success: true as const,
    partnerNum: partnerNum as number | null,
    couleur: couleur as string | null,
    cardId
  }
})
