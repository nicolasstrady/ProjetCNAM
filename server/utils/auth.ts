import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { deleteCookie, getCookie, setCookie, type H3Event } from 'h3'
import type { User } from '~/types'
import { execute, query, queryOne } from '~/server/utils/db'

const scrypt = promisify(scryptCallback)

const SESSION_COOKIE_NAME = 'tarot-session'
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30
const PASSWORD_HASH_PREFIX = 'scrypt'
const COOKIE_SECURE = process.env.NODE_ENV === 'production'

type UserRow = User & {
  motdepasse: string
}

let authSchemaPromise: Promise<void> | null = null
let legacyPasswordMigrationPromise: Promise<void> | null = null

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: COOKIE_SECURE,
    path: '/',
    maxAge: SESSION_DURATION_SECONDS
  }
}

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function isHashedPassword(value: string | null | undefined) {
  return typeof value === 'string' && value.startsWith(`${PASSWORD_HASH_PREFIX}$`)
}

function sanitizeUser(user: Pick<User, 'id' | 'nom' | 'prenom' | 'email' | 'pseudo'>): User {
  return {
    id: user.id,
    nom: user.nom,
    prenom: user.prenom,
    email: user.email,
    pseudo: user.pseudo
  }
}

async function cleanupExpiredSessions() {
  // noinspection SqlResolve
  await execute('DELETE FROM auth_session WHERE expiresAt <= NOW()')
}

export async function ensureAuthSchema() {
  if (!authSchemaPromise) {
    authSchemaPromise = (async () => {
      // noinspection SqlResolve
      await execute(
        `CREATE TABLE IF NOT EXISTS auth_session (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          tokenHash CHAR(64) NOT NULL UNIQUE,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          lastSeenAt DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
          expiresAt DATETIME NOT NULL,
          INDEX idx_auth_session_userId (userId),
          INDEX idx_auth_session_expiresAt (expiresAt)
        )`
      )

      await cleanupExpiredSessions()
    })()
  }

  await authSchemaPromise
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, 64) as Buffer
  return `${PASSWORD_HASH_PREFIX}$${salt}$${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, storedPassword: string) {
  if (!storedPassword) {
    return { valid: false, needsUpgrade: false }
  }

  if (!isHashedPassword(storedPassword)) {
    const valid = password === storedPassword
    return { valid, needsUpgrade: valid }
  }

  const [, salt, storedHashHex] = storedPassword.split('$')
  if (!salt || !storedHashHex) {
    return { valid: false, needsUpgrade: false }
  }

  const storedHash = Buffer.from(storedHashHex, 'hex')
  const derivedKey = await scrypt(password, salt, storedHash.length) as Buffer

  if (storedHash.length !== derivedKey.length) {
    return { valid: false, needsUpgrade: false }
  }

  return {
    valid: timingSafeEqual(storedHash, derivedKey),
    needsUpgrade: false
  }
}

export async function migrateLegacyPasswords() {
  await ensureAuthSchema()

  if (!legacyPasswordMigrationPromise) {
    legacyPasswordMigrationPromise = (async () => {
      const legacyUsers = await query<{ id: number; motdepasse: string }>(
        "SELECT id, motdepasse FROM utilisateur WHERE motdepasse IS NOT NULL AND motdepasse NOT LIKE 'scrypt$%'"
      )

      for (const user of legacyUsers) {
        const passwordHash = await hashPassword(user.motdepasse)
        await execute('UPDATE utilisateur SET motdepasse = ? WHERE id = ?', [passwordHash, user.id])
      }
    })()
  }

  await legacyPasswordMigrationPromise
}

export async function createUserSession(event: H3Event, userId: number) {
  await ensureAuthSchema()

  const token = randomBytes(32).toString('hex')
  const tokenHash = hashSessionToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000)

  // noinspection SqlResolve
  await execute(
    'INSERT INTO auth_session (userId, tokenHash, expiresAt) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  )

  setCookie(event, SESSION_COOKIE_NAME, token, getSessionCookieOptions())
}

export async function destroyUserSession(event: H3Event) {
  await ensureAuthSchema()

  const token = getCookie(event, SESSION_COOKIE_NAME)
  if (token) {
    // noinspection SqlResolve
    await execute('DELETE FROM auth_session WHERE tokenHash = ?', [hashSessionToken(token)])
  }

  deleteCookie(event, SESSION_COOKIE_NAME, {
    path: '/',
    sameSite: 'lax',
    secure: COOKIE_SECURE
  })
}

export async function getSessionUser(event: H3Event) {
  await ensureAuthSchema()

  const token = getCookie(event, SESSION_COOKIE_NAME)
  if (!token) {
    return null
  }

  // noinspection SqlResolve
  const sessionUser = await queryOne<User & { expiresAt: string | Date }>(
    `SELECT u.id, u.nom, u.prenom, u.email, u.pseudo, s.expiresAt
     FROM auth_session s
     JOIN utilisateur u ON u.id = s.userId
     WHERE s.tokenHash = ?
     LIMIT 1`,
    [hashSessionToken(token)]
  )

  if (!sessionUser) {
    deleteCookie(event, SESSION_COOKIE_NAME, {
      path: '/',
      sameSite: 'lax',
      secure: COOKIE_SECURE
    })
    return null
  }

  const expiresAt = new Date(sessionUser.expiresAt).getTime()
  if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
    await destroyUserSession(event)
    return null
  }

  // noinspection SqlResolve
  await execute(
    'UPDATE auth_session SET lastSeenAt = CURRENT_TIMESTAMP WHERE tokenHash = ?',
    [hashSessionToken(token)]
  )

  return sanitizeUser(sessionUser)
}

export async function findUserForLogin(email: string) {
  await migrateLegacyPasswords()

  return queryOne<UserRow>(
    'SELECT id, nom, prenom, email, pseudo, motdepasse FROM utilisateur WHERE email = ? LIMIT 1',
    [email]
  )
}

export async function upgradePasswordHashIfNeeded(userId: number, password: string, needsUpgrade: boolean) {
  if (!needsUpgrade) {
    return
  }

  const passwordHash = await hashPassword(password)
  await execute('UPDATE utilisateur SET motdepasse = ? WHERE id = ?', [passwordHash, userId])
}

export function toSafeUser(user: Pick<User, 'id' | 'nom' | 'prenom' | 'email' | 'pseudo'>) {
  return sanitizeUser(user)
}
