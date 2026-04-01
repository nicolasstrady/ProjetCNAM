import { query } from '~/server/utils/db'
import type { User, LoginCredentials } from '~/types'

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginCredentials>(event)
  
  if (!body.email || !body.password) {
    throw createError({
      statusCode: 400,
      message: 'Email et mot de passe requis'
    })
  }
  
  const users = await query<User>(
    'SELECT id, nom, prenom, email, pseudo FROM utilisateur WHERE email = ? AND motdepasse = ?',
    [body.email, body.password]
  )
  
  if (users.length === 0) {
    throw createError({
      statusCode: 401,
      message: 'Identifiants invalides'
    })
  }
  
  return {
    success: true,
    user: users[0]
  }
})
