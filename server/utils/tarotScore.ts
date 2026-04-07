import type {
  ContractType,
  TablePlayer,
  TarotFinalPlayerResult,
  TarotFinalResult,
  TarotPlayerRole,
  TarotTeamSide
} from '~/types'
import { query, queryOne } from '~/server/utils/db'
import { getCardsByIds } from '~/server/utils/gameData'
import { getContractLabel, getContractMultiplier, getRequiredPointsForBouts, isBoutCard } from '~/utils/tarot'

type SupportedContract = Extract<ContractType, 'PETITE' | 'GARDE' | 'GARDE_SANS' | 'GARDE_CONTRE'>

function normalizePartnerNum(takerNum: number, partnerNum: number | null) {
  if (!partnerNum || partnerNum === takerNum) {
    return null
  }

  return partnerNum
}

function getPlayerRole(playerNum: number, takerNum: number, partnerNum: number | null): TarotPlayerRole {
  if (playerNum === takerNum) {
    return 'TAKER'
  }

  if (partnerNum !== null && playerNum === partnerNum) {
    return 'PARTNER'
  }

  return 'DEFENDER'
}

function getRoleLabel(role: TarotPlayerRole) {
  switch (role) {
    case 'TAKER':
      return 'Preneur'
    case 'PARTNER':
      return 'Partenaire'
    default:
      return 'Defense'
  }
}

function getTeamSide(playerNum: number, takerNum: number, partnerNum: number | null): TarotTeamSide {
  return playerNum === takerNum || (partnerNum !== null && playerNum === partnerNum)
    ? 'ATTACK'
    : 'DEFENSE'
}

function getDogOwner(contract: SupportedContract): TarotTeamSide {
  return contract === 'GARDE_CONTRE' ? 'DEFENSE' : 'ATTACK'
}

async function getDogCardIdsForContract(partieId: number, contract: SupportedContract) {
  if (contract === 'PETITE' || contract === 'GARDE') {
    const dogPli = await queryOne<Record<string, any>>(
      `SELECT carte1, carte2, carte3
       FROM plis
       WHERE partie = ? AND pliChien = 1
       ORDER BY id DESC
       LIMIT 1`,
      [partieId]
    )

    return [dogPli?.carte1, dogPli?.carte2, dogPli?.carte3].filter(
      (cardId): cardId is number => cardId !== null && cardId !== undefined
    )
  }

  const dogRow = await queryOne<Record<string, any>>(
    `SELECT carte1, carte2, carte3
     FROM chien
     WHERE partie = ?
     ORDER BY id DESC
     LIMIT 1`,
    [partieId]
  )

  return [dogRow?.carte1, dogRow?.carte2, dogRow?.carte3].filter(
    (cardId): cardId is number => cardId !== null && cardId !== undefined
  )
}

export async function calculateTarotFinalResult(
  partieId: number,
  players: TablePlayer[],
  takerNum: number,
  contract: SupportedContract,
  partnerNum: number | null
): Promise<TarotFinalResult> {
  const normalizedPartnerNum = normalizePartnerNum(takerNum, partnerNum)
  const attackNums = new Set([takerNum, normalizedPartnerNum].filter((num): num is number => num !== null))
  const trickRows = await query<Record<string, any>>(
    `SELECT id, carte1, carte2, carte3, carte4, carte5, joueurGagnant
     FROM plis
     WHERE partie = ? AND pliChien = 0 AND joueurGagnant IS NOT NULL
     ORDER BY id`,
    [partieId]
  )
  const dogCardIds = await getDogCardIdsForContract(partieId, contract)
  const excludedTrickCardIds = new Set(dogCardIds)
  const allCardIds = Array.from(new Set([
    ...dogCardIds,
    ...trickRows.flatMap((trickRow) => [trickRow.carte1, trickRow.carte2, trickRow.carte3, trickRow.carte4, trickRow.carte5])
  ].filter((cardId): cardId is number => cardId !== null && cardId !== undefined)))
  const allCards = await getCardsByIds(allCardIds)
  const cardsById = new Map(allCards.map((card) => [card.id, card]))
  const playerTrickPoints = new Map(players.map((player) => [player.num, 0]))

  let attackPoints = 0
  let defensePoints = 0
  let bouts = 0

  trickRows.forEach((trickRow) => {
    const winnerNum = Number(trickRow.joueurGagnant)
    const keptCardIds = [trickRow.carte1, trickRow.carte2, trickRow.carte3, trickRow.carte4, trickRow.carte5].filter(
      (cardId): cardId is number =>
        cardId !== null &&
        cardId !== undefined &&
        !excludedTrickCardIds.has(cardId)
    )
    const trickCards = keptCardIds
      .map((cardId) => cardsById.get(cardId))
      .filter((card): card is NonNullable<typeof card> => Boolean(card))
    const trickPoints = trickCards.reduce((total, card) => total + card.points, 0)

    playerTrickPoints.set(winnerNum, (playerTrickPoints.get(winnerNum) ?? 0) + trickPoints)

    if (attackNums.has(winnerNum)) {
      attackPoints += trickPoints
      bouts += trickCards.filter((card) => isBoutCard(card)).length
      return
    }

    defensePoints += trickPoints
  })

  const dogCards = dogCardIds
    .map((cardId) => cardsById.get(cardId))
    .filter((card): card is NonNullable<typeof card> => Boolean(card))
  const dogPoints = dogCards.reduce((total, card) => total + card.points, 0)
  const dogOwner = getDogOwner(contract)

  if (dogOwner === 'ATTACK') {
    attackPoints += dogPoints
    bouts += dogCards.filter((card) => isBoutCard(card)).length
  } else {
    defensePoints += dogPoints
  }

  const requiredPoints = getRequiredPointsForBouts(bouts)
  const pointDifference = Number((attackPoints - requiredPoints).toFixed(1))
  const attackWon = pointDifference >= 0
  const basePoints = Number((25 + Math.abs(pointDifference)).toFixed(1))
  const multiplier = getContractMultiplier(contract)
  const totalScore = Number((basePoints * multiplier).toFixed(1))
  const playerResults: TarotFinalPlayerResult[] = players.map((player) => {
    const role = getPlayerRole(player.num, takerNum, normalizedPartnerNum)
    const side = getTeamSide(player.num, takerNum, normalizedPartnerNum)
    const share = role === 'TAKER'
      ? (normalizedPartnerNum === null ? 4 : 2)
      : role === 'PARTNER'
        ? 1
        : 1
    const signedShare = side === 'ATTACK'
      ? (attackWon ? share : -share)
      : (attackWon ? -share : share)

    return {
      playerNum: player.num,
      pseudo: player.pseudo,
      side,
      role,
      roleLabel: getRoleLabel(role),
      trickPoints: Number((playerTrickPoints.get(player.num) ?? 0).toFixed(1)),
      finalDelta: Number((signedShare * totalScore).toFixed(1))
    }
  })

  return {
    contract,
    contractLabel: getContractLabel(contract),
    multiplier,
    takerNum,
    partnerNum: normalizedPartnerNum,
    attackPoints: Number(attackPoints.toFixed(1)),
    defensePoints: Number(defensePoints.toFixed(1)),
    dogPoints: Number(dogPoints.toFixed(1)),
    dogOwner,
    bouts,
    requiredPoints,
    pointDifference,
    basePoints,
    totalScore,
    attackWon,
    bonusesHandled: false,
    playerResults
  }
}
