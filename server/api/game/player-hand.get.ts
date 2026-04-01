import { query } from '~/server/utils/db'
import type { Card } from '~/types'

export default defineEventHandler(async (event) => {
  const queryParams = getQuery(event)
  const { userId, partieId } = queryParams
  
  if (!userId || !partieId) {
    throw createError({
      statusCode: 400,
      message: 'userId et partieId requis'
    })
  }
  
  // Récupérer les cartes du joueur
  const playerData = await query(
    `SELECT num, carte1, carte2, carte3, carte4, carte5, carte6, carte7, carte8, carte9, carte10,
            carte11, carte12, carte13, carte14, carte15
     FROM joueur WHERE utilisateur = ? AND partie = ?`,
    [userId, partieId]
  )
  
  if (playerData.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Joueur non trouvé'
    })
  }
  
  const player = playerData[0] as any
  const cardIds: number[] = []
  
  for (let i = 1; i <= 15; i++) {
    const cardId = player[`carte${i}`]
    if (cardId) {
      cardIds.push(cardId)
    }
  }
  
  // Récupérer les détails des cartes
  const cards: Card[] = []
  for (const cardId of cardIds) {
    const cardData = await query<Card>(
      'SELECT id, lien, couleur, valeur, points FROM carte WHERE id = ?',
      [cardId]
    )
    if (cardData.length > 0) {
      cards.push(cardData[0])
    }
  }
  
  return {
    success: true,
    playerNum: player.num,
    cards
  }
})
