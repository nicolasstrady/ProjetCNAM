import { execute, query } from '~/server/utils/db'
import type { RegisterData, User } from '~/types'
import { createUserSession, hashPassword, migrateLegacyPasswords, toSafeUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody<RegisterData>(event)

  if (!body.email || !body.motdepasse || !body.pseudo) {
    throw createError({
      statusCode: 400,
      message: 'Donnees incompletes'
    })
  }

  await migrateLegacyPasswords()

  const existing = await query<User>(
    'SELECT id FROM utilisateur WHERE email = ? OR pseudo = ?',
    [body.email, body.pseudo]
  )

  if (existing.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'Email ou pseudo deja utilise'
    })
  }

  const passwordHash = await hashPassword(body.motdepasse)

  await execute(
    'INSERT INTO utilisateur (nom, prenom, email, pseudo, motdepasse) VALUES (?, ?, ?, ?, ?)',
    [body.nom, body.prenom, body.email, body.pseudo, passwordHash]
  )

  const users = await query<User>(
    'SELECT id, nom, prenom, email, pseudo FROM utilisateur WHERE email = ?',
    [body.email]
  )

  if (!users[0]) {
    throw createError({
      statusCode: 500,
      message: 'Utilisateur cree mais introuvable'
    })
  }

  await createUserSession(event, users[0].id)

  return {
    success: true,
    user: toSafeUser(users[0])
  }
})
