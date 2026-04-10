import type { Card } from '~/types'
import { query, queryOne } from '~/server/utils/db'
import { PLAYER_HAND_SIZE } from '~/utils/tarot'

export const PLAYER_CARD_COLUMNS = Array.from({ length: PLAYER_HAND_SIZE }, (_, index) => `carte${index + 1}`)

export function extractPlayerCardIds(row: Record<string, any> | null | undefined) {
  if (!row) {
    return [] as number[]
  }

  return PLAYER_CARD_COLUMNS
    .map((column) => row[column])
    .filter((cardId): cardId is number => cardId !== null && cardId !== undefined)
}

export async function getCardById(cardId: number) {
  return queryOne<Card>(
    'SELECT id, lien, couleur, valeur, points FROM carte WHERE id = ?',
    [cardId]
  )
}

export async function getCardsByIds(cardIds: number[]) {
  if (cardIds.length === 0) {
    return [] as Card[]
  }

  const placeholders = cardIds.map(() => '?').join(', ')
  const cards = await query<Card>(
    `SELECT id, lien, couleur, valeur, points FROM carte WHERE id IN (${placeholders})`,
    cardIds
  )

  const cardsById = new Map(cards.map((card) => [card.id, card]))
  return cardIds
    .map((cardId) => cardsById.get(cardId))
    .filter((card): card is Card => Boolean(card))
}

export async function getPlayerRow(userId: number, partieId: number) {
  return queryOne<Record<string, any>>(
    `SELECT num, ${PLAYER_CARD_COLUMNS.join(', ')}
     FROM joueur
     WHERE utilisateur = ? AND partie = ?`,
    [userId, partieId]
  )
}

export async function getPlayerRowByNum(partieId: number, playerNum: number) {
  return queryOne<Record<string, any>>(
    `SELECT utilisateur, num, ${PLAYER_CARD_COLUMNS.join(', ')}
     FROM joueur
     WHERE partie = ? AND num = ?`,
    [partieId, playerNum]
  )
}

export async function getPlayerCards(userId: number, partieId: number) {
  const playerRow = await getPlayerRow(userId, partieId)
  return getCardsByIds(extractPlayerCardIds(playerRow))
}

export async function getDogCardIds(partieId: number) {
  const dogRow = await queryOne<Record<string, any>>(
    'SELECT carte1, carte2, carte3 FROM chien WHERE partie = ? ORDER BY id DESC LIMIT 1',
    [partieId]
  )

  if (!dogRow) {
    return [] as number[]
  }

  return [dogRow.carte1, dogRow.carte2, dogRow.carte3].filter(
    (cardId): cardId is number => cardId !== null && cardId !== undefined
  )
}

export async function writePlayerCardIds(userId: number, partieId: number, cardIds: number[]) {
  const values = Array.from(
    { length: PLAYER_HAND_SIZE },
    (_, index) => cardIds[index] ?? null
  )
  const assignments = PLAYER_CARD_COLUMNS.map((column) => `${column} = ?`).join(', ')

  await query(
    `UPDATE joueur SET ${assignments} WHERE utilisateur = ? AND partie = ?`,
    [...values, userId, partieId]
  )
}

export function getFirstEmptyPliPosition(pliRow: Record<string, any> | null | undefined) {
  for (let position = 1; position <= 5; position += 1) {
    if (!pliRow?.[`carte${position}`]) {
      return position
    }
  }

  return null
}
