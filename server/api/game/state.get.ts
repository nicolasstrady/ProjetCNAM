import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const queryParams = getQuery(event)
  const { partieId } = queryParams
  
  if (!partieId) {
    throw createError({
      statusCode: 400,
      message: 'partieId requis'
    })
  }
  
  // Récupérer les joueurs de la partie
  const players = await query(
    `SELECT j.id, j.utilisateur, j.num, j.partie, j.reponse, j.equipe, j.score,
            u.pseudo
     FROM joueur j
     JOIN utilisateur u ON j.utilisateur = u.id
     WHERE j.partie = ?
     ORDER BY j.num`,
    [partieId]
  )
  
  // Récupérer le nombre de réponses
  const answerCount = await query<{ count: number }>(
    "SELECT COUNT(*) as count FROM joueur WHERE partie = ? AND reponse != 'WAIT'",
    [partieId]
  )
  
  // Récupérer le preneur (taker)
  const taker = await query(
    "SELECT num, reponse FROM joueur WHERE partie = ? AND reponse NOT IN ('WAIT', 'REFUSE')",
    [partieId]
  )
  
  // Récupérer le pli actuel
  const currentPli = await query(
    `SELECT id, carte1, carte2, carte3, carte4, carte5, joueurGagnant
     FROM plis WHERE partie = ? AND pliChien = 0
     ORDER BY id DESC LIMIT 1`,
    [partieId]
  )
  
  return {
    success: true as const,
    players,
    answerCount: answerCount[0]?.count || 0,
    taker: taker.length > 0 ? taker[0] : null,
    currentPli: currentPli.length > 0 ? currentPli[0] : null
  }
})
