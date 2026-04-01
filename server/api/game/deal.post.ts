import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { partieId } = body
  
  if (!partieId) {
    throw createError({
      statusCode: 400,
      message: 'partieId requis'
    })
  }
  
  // Récupérer toutes les cartes et les mélanger
  const cards = await query<{ id: number }>(
    'SELECT id FROM carte ORDER BY RAND()'
  )
  
  const cardIds = cards.map(c => c.id)
  
  // Distribuer 15 cartes à chaque joueur (5 joueurs)
  for (let playerNum = 1; playerNum <= 5; playerNum++) {
    const playerCards = cardIds.slice((playerNum - 1) * 15, playerNum * 15)
    
    const updateQuery = `
      UPDATE joueur SET 
        carte1 = ?, carte2 = ?, carte3 = ?, carte4 = ?, carte5 = ?,
        carte6 = ?, carte7 = ?, carte8 = ?, carte9 = ?, carte10 = ?,
        carte11 = ?, carte12 = ?, carte13 = ?, carte14 = ?, carte15 = ?
      WHERE num = ? AND partie = ?
    `
    
    await query(updateQuery, [...playerCards, playerNum, partieId])
  }
  
  // Les 3 dernières cartes vont au chien
  const dogCards = cardIds.slice(75, 78)
  await query(
    'INSERT INTO chien (partie, carte1, carte2, carte3) VALUES (?, ?, ?, ?)',
    [partieId, ...dogCards]
  )
  
  return {
    success: true,
    message: 'Cartes distribuées'
  }
})
