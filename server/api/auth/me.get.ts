import { getSessionUser, migrateLegacyPasswords } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await migrateLegacyPasswords()
  const user = await getSessionUser(event)

  return {
    success: Boolean(user),
    user
  }
})
