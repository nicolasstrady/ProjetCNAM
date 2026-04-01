import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, partieId } = body
  
  if (!userId || !partieId) {
    throw createError({
      statusCode: 400,
      message: 'userId et partieId requis'
    })
  }
  
  // Compter le nombre de joueurs dans la partie
  const countResult = await query<{ count: number }>(
    'SELECT COUNT(*) as count FROM joueur WHERE partie = ?',
    [partieId]
  )
  
  const playerCount = countResult[0].count
  
  if (playerCount >= 5) {
    throw createError({
      statusCode: 400,
      message: 'La partie est complète'
    })
  }
  
  const playerNum = playerCount + 1
  
  // Ajouter le joueur à la partie
  await query(
    'INSERT INTO joueur (utilisateur, num, partie, reponse, equipe, score) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, playerNum, partieId, 'WAIT', 0, 0]
  )
  
  return {
    success: true,
    playerNum
  }
})
