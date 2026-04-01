import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  // Créer une nouvelle partie
  const result = await query(
    'INSERT INTO partie () VALUES ()'
  )
  
  const partieId = (result as any).insertId
  
  return {
    success: true,
    partieId
  }
})
