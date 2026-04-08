import type mysql from 'mysql2/promise'
import { createError } from 'h3'
import { query, queryOne, txExecute, txQuery, txQueryOne, withTransaction } from '~/server/utils/db'
import { ensureLobbySchema } from '~/server/utils/lobbySchema'
import type { CreateRoomOptions, LobbyRoomPlayer, LobbyRoomSummary, RoomMode, RoomVisibility } from '~/types'

interface RoomRow {
  id: number
  code: string | null
  visibility: RoomVisibility
  status: 'WAITING' | 'PLAYING' | 'FINISHED'
  mode: RoomMode
  allowQuickJoin: number
  fillWithBots: number
  ownerUserId: number | null
  createdAt: string | null
  startedAt: string | null
  playerCount: number
  myPlayerNum: number | null
}

interface UserRoomRow {
  id: number
  playerNum: number
}

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function buildPlaceholders(length: number) {
  return Array.from({ length }, () => '?').join(', ')
}

function randomRoomCode(length = 6) {
  let code = ''

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)
    code += ROOM_CODE_ALPHABET[randomIndex]
  }

  return code
}

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return new Date(value).toISOString()
}

function mapRoomRow(row: RoomRow, players: LobbyRoomPlayer[]): LobbyRoomSummary {
  return {
    id: row.id,
    code: row.code,
    visibility: row.visibility,
    status: row.status,
    mode: row.mode,
    allowQuickJoin: row.allowQuickJoin === 1,
    fillWithBots: row.fillWithBots === 1,
    ownerUserId: row.ownerUserId,
    playerCount: row.playerCount,
    openSlots: Math.max(0, 5 - row.playerCount),
    createdAt: normalizeDate(row.createdAt),
    startedAt: normalizeDate(row.startedAt),
    players,
    myPlayerNum: row.myPlayerNum
  }
}

async function getPlayersForRooms(roomIds: number[]) {
  if (roomIds.length === 0) {
    return new Map<number, LobbyRoomPlayer[]>()
  }

  const players = await query<{
    partie: number
    userId: number
    pseudo: string
    playerNum: number
  }>(
    `SELECT j.partie, j.utilisateur AS userId, u.pseudo, j.num AS playerNum
     FROM joueur j
     JOIN utilisateur u ON u.id = j.utilisateur
     WHERE j.partie IN (${buildPlaceholders(roomIds.length)})
     ORDER BY j.partie, j.num`,
    roomIds
  )

  const playersByRoom = new Map<number, LobbyRoomPlayer[]>()

  for (const player of players) {
    const current = playersByRoom.get(player.partie) ?? []
    current.push({
      userId: player.userId,
      pseudo: player.pseudo,
      playerNum: player.playerNum
    })
    playersByRoom.set(player.partie, current)
  }

  return playersByRoom
}

async function fetchRoomSummaries(roomIds: number[], userId?: number) {
  if (roomIds.length === 0) {
    return []
  }

  const params: Array<number | null> = []
  const myPlayerNumSql = userId
    ? `MAX(CASE WHEN j.utilisateur = ? THEN j.num ELSE NULL END) AS myPlayerNum`
    : 'NULL AS myPlayerNum'

  if (userId) {
    params.push(userId)
  }

  params.push(...roomIds)

  const rows = await query<RoomRow>(
    `SELECT
       p.id,
       p.code,
       p.visibility,
       p.status,
       p.mode,
       p.allowQuickJoin,
       p.fillWithBots,
       p.ownerUserId,
       p.createdAt,
       p.startedAt,
       COUNT(DISTINCT j.id) AS playerCount,
       ${myPlayerNumSql}
     FROM partie p
     LEFT JOIN joueur j ON j.partie = p.id
     WHERE p.id IN (${buildPlaceholders(roomIds.length)})
     GROUP BY
       p.id,
       p.code,
       p.visibility,
       p.status,
       p.mode,
       p.allowQuickJoin,
       p.fillWithBots,
       p.ownerUserId,
       p.createdAt,
       p.startedAt
     ORDER BY p.createdAt ASC, p.id ASC`,
    params
  )

  const playersByRoom = await getPlayersForRooms(roomIds)

  return rows.map((row) => mapRoomRow(row, playersByRoom.get(row.id) ?? []))
}

function validateVisibility(visibility?: string): RoomVisibility {
  if (visibility === 'PUBLIC' || visibility === 'UNLISTED' || visibility === 'PRIVATE') {
    return visibility
  }

  return 'PRIVATE'
}

function validateMode(mode?: string): RoomMode {
  if (mode === 'CLASSIC' || mode === 'QUICK_MATCH' || mode === 'SOLO') {
    return mode
  }

  return 'CLASSIC'
}

export function normalizeCreateRoomOptions(input: Partial<CreateRoomOptions> | null | undefined): CreateRoomOptions {
  return {
    visibility: validateVisibility(input?.visibility),
    allowQuickJoin: Boolean(input?.allowQuickJoin),
    fillWithBots: Boolean(input?.fillWithBots),
    mode: validateMode(input?.mode)
  }
}

export async function findUserActiveRoom(userId: number) {
  await ensureLobbySchema()

  const activeRoom = await queryOne<UserRoomRow>(
    `SELECT p.id, j.num AS playerNum
     FROM joueur j
     JOIN partie p ON p.id = j.partie
     WHERE j.utilisateur = ?
       AND p.status IN ('WAITING', 'PLAYING')
     ORDER BY FIELD(p.status, 'PLAYING', 'WAITING'), p.createdAt DESC, p.id DESC
     LIMIT 1`,
    [userId]
  )

  if (!activeRoom) {
    return null
  }

  const rooms = await fetchRoomSummaries([activeRoom.id], userId)
  return rooms[0] ?? null
}

export async function listLobbyRooms(userId?: number) {
  await ensureLobbySchema()

  const publicRoomRows = await query<{ id: number }>(
    `SELECT p.id
     FROM partie p
     LEFT JOIN joueur j ON j.partie = p.id
     WHERE p.status = 'WAITING'
       AND p.visibility = 'PUBLIC'
     GROUP BY p.id, p.createdAt
     HAVING COUNT(j.id) < 5
     ORDER BY p.createdAt ASC, p.id ASC`
  )

  const publicRooms = await fetchRoomSummaries(
    publicRoomRows.map((room) => room.id),
    userId
  )
  const activeRoom = userId ? await findUserActiveRoom(userId) : null

  return {
    activeRoom,
    publicRooms: activeRoom
      ? publicRooms.filter((room) => room.id !== activeRoom.id)
      : publicRooms
  }
}

async function createRoomRow(
  connection: mysql.PoolConnection,
  userId: number,
  options: CreateRoomOptions
) {
  let code = randomRoomCode()

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const existing = await txQueryOne<{ id: number }>(
      connection,
      'SELECT id FROM partie WHERE code = ? LIMIT 1',
      [code]
    )

    if (!existing) {
      break
    }

    code = randomRoomCode()
  }

  const result = await txExecute<{ insertId: number }>(
    connection,
    `INSERT INTO partie (code, visibility, status, ownerUserId, allowQuickJoin, fillWithBots, mode)
     VALUES (?, ?, 'WAITING', ?, ?, ?, ?)`,
    [code, options.visibility, userId, options.allowQuickJoin ? 1 : 0, options.fillWithBots ? 1 : 0, options.mode]
  )

  return {
    partieId: result.insertId as number,
    code
  }
}

async function findPlayerNum(connection: mysql.PoolConnection, partieId: number) {
  const rows = await txQuery<{ num: number }>(
    connection,
    'SELECT num FROM joueur WHERE partie = ? ORDER BY num ASC',
    [partieId]
  )

  const usedNums = new Set(rows.map((row) => row.num))

  for (let playerNum = 1; playerNum <= 5; playerNum += 1) {
    if (!usedNums.has(playerNum)) {
      return playerNum
    }
  }

  return null
}

async function joinRoomWithConnection(connection: mysql.PoolConnection, userId: number, partieId: number) {
  const room = await txQueryOne<{
    id: number
    status: 'WAITING' | 'PLAYING' | 'FINISHED'
  }>(
    connection,
    `SELECT id, status
     FROM partie
     WHERE id = ?
     FOR UPDATE`,
    [partieId]
  )

  if (!room) {
    throw createError({
      statusCode: 404,
      message: 'Salon introuvable'
    })
  }

  if (room.status !== 'WAITING') {
    throw createError({
      statusCode: 400,
      message: 'Ce salon nest plus en attente'
    })
  }

  const existingPlayer = await txQueryOne<{ num: number }>(
    connection,
    `SELECT num
     FROM joueur
     WHERE utilisateur = ? AND partie = ?
     LIMIT 1`,
    [userId, partieId]
  )

  if (existingPlayer) {
    return {
      partieId,
      playerNum: existingPlayer.num,
      alreadyJoined: true
    }
  }

  const playerNum = await findPlayerNum(connection, partieId)

  if (!playerNum) {
    throw createError({
      statusCode: 400,
      message: 'La partie est complete'
    })
  }

  await txExecute(
    connection,
    `INSERT INTO joueur (utilisateur, num, partie, reponse, equipe, score)
     VALUES (?, ?, ?, 'WAIT', 0, 0)`,
    [userId, playerNum, partieId]
  )

  return {
    partieId,
    playerNum,
    alreadyJoined: false
  }
}

export async function createRoomAndJoin(userId: number, rawOptions: Partial<CreateRoomOptions> | null | undefined) {
  await ensureLobbySchema()

  const existingRoom = await findUserActiveRoom(userId)

  if (existingRoom) {
    return {
      partieId: existingRoom.id,
      playerNum: existingRoom.myPlayerNum ?? undefined,
      room: existingRoom,
      alreadyJoined: true
    }
  }

  const options = normalizeCreateRoomOptions(rawOptions)

  const roomId = await withTransaction(async (connection) => {
    const createdRoom = await createRoomRow(connection, userId, options)
    await joinRoomWithConnection(connection, userId, createdRoom.partieId)
    return createdRoom.partieId
  })

  const room = await fetchRoomSummaries([roomId], userId)

  return {
    partieId: roomId,
    playerNum: room[0]?.myPlayerNum ?? undefined,
    room: room[0] ?? null,
    alreadyJoined: false
  }
}

export async function joinRoomByReference(
  userId: number,
  roomRef: { partieId?: number | null; code?: string | null }
) {
  await ensureLobbySchema()

  const existingRoom = await findUserActiveRoom(userId)

  if (existingRoom) {
    if (roomRef.partieId && existingRoom.id !== roomRef.partieId) {
      throw createError({
        statusCode: 400,
        message: 'Vous etes deja dans un autre salon actif'
      })
    }

    if (roomRef.code && existingRoom.code !== roomRef.code.trim().toUpperCase()) {
      throw createError({
        statusCode: 400,
        message: 'Vous etes deja dans un autre salon actif'
      })
    }

    return {
      partieId: existingRoom.id,
      playerNum: existingRoom.myPlayerNum ?? undefined,
      room: existingRoom,
      alreadyJoined: true
    }
  }

  const normalizedCode = roomRef.code?.trim().toUpperCase()
  const roomLookup = roomRef.partieId
    ? await queryOne<{ id: number }>('SELECT id FROM partie WHERE id = ?', [roomRef.partieId])
    : normalizedCode
      ? await queryOne<{ id: number }>('SELECT id FROM partie WHERE code = ?', [normalizedCode])
      : null

  if (!roomLookup) {
    throw createError({
      statusCode: 404,
      message: 'Salon introuvable'
    })
  }

  const joinResult = await withTransaction((connection) => joinRoomWithConnection(connection, userId, roomLookup.id))
  const room = await fetchRoomSummaries([joinResult.partieId], userId)

  return {
    ...joinResult,
    room: room[0] ?? null
  }
}

export async function quickMatch(userId: number) {
  await ensureLobbySchema()

  const existingRoom = await findUserActiveRoom(userId)

  if (existingRoom) {
    return {
      partieId: existingRoom.id,
      playerNum: existingRoom.myPlayerNum ?? undefined,
      room: existingRoom,
      alreadyJoined: true
    }
  }

  const joinedRoomId = await withTransaction(async (connection) => {
    const lock = await txQueryOne<{ acquired: number }>(
      connection,
      "SELECT GET_LOCK('tarot_quick_match_queue', 10) AS acquired"
    )

    if (!lock || lock.acquired !== 1) {
      throw createError({
        statusCode: 503,
        message: 'La file de recherche rapide est occupee, reessayez'
      })
    }

    try {
      while (true) {
        const candidate = await txQueryOne<{ id: number }>(
          connection,
          `SELECT id
           FROM partie
           WHERE status = 'WAITING'
             AND allowQuickJoin = 1
             AND visibility IN ('PUBLIC', 'UNLISTED')
           ORDER BY createdAt ASC, id ASC
           LIMIT 1`
        )

        if (!candidate) {
          const createdRoom = await createRoomRow(connection, userId, {
            visibility: 'PUBLIC',
            allowQuickJoin: true,
            fillWithBots: false,
            mode: 'QUICK_MATCH'
          })
          await joinRoomWithConnection(connection, userId, createdRoom.partieId)
          return createdRoom.partieId
        }

        try {
          const joined = await joinRoomWithConnection(connection, userId, candidate.id)
          return joined.partieId
        } catch (error: any) {
          if (error?.statusCode === 400 && `${error.message}`.includes('complete')) {
            continue
          }

          throw error
        }
      }
    } finally {
      await txQuery(connection, "SELECT RELEASE_LOCK('tarot_quick_match_queue')")
    }
  })

  const room = await fetchRoomSummaries([joinedRoomId], userId)

  return {
    partieId: joinedRoomId,
    playerNum: room[0]?.myPlayerNum ?? undefined,
    room: room[0] ?? null,
    alreadyJoined: false
  }
}
