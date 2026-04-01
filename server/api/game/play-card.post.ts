import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, partieId, cardId, pliId, position } = body
  
  if (!userId || !partieId || !cardId || !pliId || !position) {
    throw createError({
      statusCode: 400,
      message: 'Données incomplètes'
    })
  }
  
  // Ajouter la carte au pli
  await query(
    `UPDATE plis SET carte${position} = ? WHERE id = ? AND partie = ?`,
    [cardId, pliId, partieId]
  )
  
  // Retirer la carte de la main du joueur
  const playerData = await query(
    `SELECT carte1, carte2, carte3, carte4, carte5, carte6, carte7, carte8, carte9, carte10,
            carte11, carte12, carte13, carte14, carte15
     FROM joueur WHERE utilisateur = ? AND partie = ?`,
    [userId, partieId]
  )
  
  if (playerData.length > 0) {
    const player = playerData[0] as any
    for (let i = 1; i <= 15; i++) {
      if (player[`carte${i}`] === cardId) {
        await query(
          `UPDATE joueur SET carte${i} = NULL WHERE utilisateur = ? AND partie = ?`,
          [userId, partieId]
        )
        break
      }
    }
  }
  
  return {
    success: true,
    message: 'Carte jouée'
  }
})
