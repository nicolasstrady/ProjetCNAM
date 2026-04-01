import { query } from '~/server/utils/db'
import type { RegisterData, User } from '~/types'

export default defineEventHandler(async (event) => {
  const body = await readBody<RegisterData>(event)
  
  if (!body.email || !body.password || !body.pseudo) {
    throw createError({
      statusCode: 400,
      message: 'Données incomplètes'
    })
  }
  
  // Vérifier si l'utilisateur existe déjà
  const existing = await query<User>(
    'SELECT id FROM utilisateur WHERE email = ? OR pseudo = ?',
    [body.email, body.pseudo]
  )
  
  if (existing.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'Email ou pseudo déjà utilisé'
    })
  }
  
  // Créer l'utilisateur
  await query(
    'INSERT INTO utilisateur (nom, prenom, email, pseudo, motdepasse) VALUES (?, ?, ?, ?, ?)',
    [body.nom, body.prenom, body.email, body.pseudo, body.motdepasse]
  )
  
  // Récupérer l'utilisateur créé
  const users = await query<User>(
    'SELECT id, nom, prenom, email, pseudo FROM utilisateur WHERE email = ?',
    [body.email]
  )
  
  return {
    success: true,
    user: users[0]
  }
})
