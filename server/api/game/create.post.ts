import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  // Créer une nouvelle partie
  const result = await query(
    'INSERT INTO partie () VALUES ()'
  ) as any
  
  const partieId = result.insertId as number
  
  return {
    success: true as const,
    partieId
  }
})
