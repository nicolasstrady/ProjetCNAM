import { destroyUserSession } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await destroyUserSession(event)

  return {
    success: true
  }
})
