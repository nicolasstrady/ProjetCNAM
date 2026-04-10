import { query } from '~/server/utils/db'
import { clearScheduledBotAction, fillRoomWithBots, scheduleBotsIfNeeded } from '~/server/utils/bots'
import { resetGameSession } from '~/server/utils/gameSession'
import { ensureLobbySchema } from '~/server/utils/lobbySchema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const partieId = Number(body.partieId)

  if (!partieId) {
    throw createError({
      statusCode: 400,
      message: 'partieId requis'
    })
  }

  await ensureLobbySchema()

  const room = await query<{ fillWithBots: number; mode: string }>(
    'SELECT fillWithBots, mode FROM partie WHERE id = ? LIMIT 1',
    [partieId]
  )

  if (room[0] && (room[0].fillWithBots === 1 || room[0].mode === 'SOLO')) {
    await fillRoomWithBots(partieId)
  }

  const playerCountRows = await query<{ count: number }>(
    'SELECT COUNT(*) as count FROM joueur WHERE partie = ?',
    [partieId]
  )

  if ((playerCountRows[0]?.count ?? 0) !== 5) {
    throw createError({
      statusCode: 400,
      message: 'Il faut 5 joueurs pour lancer la partie'
    })
  }

  clearScheduledBotAction(partieId)
  resetGameSession(partieId)

  await query('DELETE FROM plis WHERE partie = ?', [partieId])
  await query('DELETE FROM chien WHERE partie = ?', [partieId])
  await query(
    "UPDATE joueur SET reponse = 'WAIT', equipe = 0, score = 0 WHERE partie = ?",
    [partieId]
  )

  const cards = await query<{ id: number }>(
    'SELECT id FROM carte ORDER BY RAND()'
  )
  const cardIds = cards.map((card) => card.id)

  for (let playerNum = 1; playerNum <= 5; playerNum += 1) {
    const playerCards = cardIds.slice((playerNum - 1) * 15, playerNum * 15)

    await query(
      `UPDATE joueur SET
         carte1 = ?, carte2 = ?, carte3 = ?, carte4 = ?, carte5 = ?,
         carte6 = ?, carte7 = ?, carte8 = ?, carte9 = ?, carte10 = ?,
         carte11 = ?, carte12 = ?, carte13 = ?, carte14 = ?, carte15 = ?
       WHERE num = ? AND partie = ?`,
      [...playerCards, playerNum, partieId]
    )
  }

  const dogCards = cardIds.slice(75, 78)
  await query(
    'INSERT INTO chien (partie, carte1, carte2, carte3) VALUES (?, ?, ?, ?)',
    [partieId, ...dogCards]
  )
  await query(
    "UPDATE partie SET status = 'PLAYING', startedAt = NOW() WHERE id = ?",
    [partieId]
  )
  await scheduleBotsIfNeeded(partieId)

  return {
    success: true,
    message: 'Cartes distribuees'
  }
})
