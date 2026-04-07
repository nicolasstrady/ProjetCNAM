import { queryOne } from '~/server/utils/db'

export default defineEventHandler(async () => {
  try {
    await queryOne<{ ok: number }>('SELECT 1 as ok')

    return {
      ok: true,
      database: 'reachable',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Database unavailable',
      message: error instanceof Error ? error.message : 'Database unavailable'
    })
  }
})
