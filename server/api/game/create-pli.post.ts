import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { partieId, pliChien = 0 } = body
  
  if (!partieId) {
    throw createError({
      statusCode: 400,
      message: 'partieId requis'
    })
  }
  
  const result = await query(
    'INSERT INTO plis (partie, pliChien) VALUES (?, ?)',
    [partieId, pliChien]
  ) as any
  
  const pliId = result.insertId as number
  
  return {
    success: true as const,
    pliId
  }
})
