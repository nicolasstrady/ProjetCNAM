import { query } from '~/server/utils/db'
import type { ContractType } from '~/types'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, partieId, contract } = body
  
  if (!userId || !partieId || !contract) {
    throw createError({
      statusCode: 400,
      message: 'Données incomplètes'
    })
  }
  
  const equipe = contract === 'REFUSE' ? 2 : 1
  
  await query(
    'UPDATE joueur SET reponse = ?, equipe = ? WHERE utilisateur = ? AND partie = ?',
    [contract, equipe, userId, partieId]
  )
  
  return {
    success: true,
    message: 'Contrat enregistré'
  }
})
