import { query } from '~/server/utils/db'
import type { Card } from '~/types'

export default defineEventHandler(async () => {
  const cards = await query<Card>(
    'SELECT id, lien, couleur, valeur, points FROM carte ORDER BY id'
  )
  
  return {
    success: true,
    cards
  }
})
