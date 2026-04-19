import type { LoginCredentials } from '~/types'
import {
  createUserSession,
  findUserForLogin,
  toSafeUser,
  upgradePasswordHashIfNeeded,
  verifyPassword
} from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginCredentials>(event)
  
  if (!body.email || !body.password) {
    throw createError({
      statusCode: 400,
      message: 'Email et mot de passe requis'
    })
  }
  
  const user = await findUserForLogin(body.email)

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Identifiants invalides'
    })
  }

  const passwordCheck = await verifyPassword(body.password, user.motdepasse)

  if (!passwordCheck.valid) {
    throw createError({
      statusCode: 401,
      message: 'Identifiants invalides'
    })
  }

  await upgradePasswordHashIfNeeded(user.id, body.password, passwordCheck.needsUpgrade)
  await createUserSession(event, user.id)

  return {
    success: true,
    user: toSafeUser(user)
  }
})
