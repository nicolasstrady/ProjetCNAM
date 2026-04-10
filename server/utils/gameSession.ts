export interface GameSession {
  partieId: number
  takerNum: number | null
  partnerNum: number | null
  calledKingCardId: number | null
  calledKingColor: string | null
  dogCardIds: number[]
  dogRetrieved: boolean
  discardedDogCardIds: number[]
  dogExchangeEndsAt: number | null
  currentPliId: number | null
  currentTurn: number | null
  firstPlayer: number | null
  ledColor: string
  trickCount: number
  finTour: boolean
  finTourEndsAt: number | null
  finPartie: boolean
}

const sessions = new Map<number, GameSession>()

function createSession(partieId: number): GameSession {
  return {
    partieId,
    takerNum: null,
    partnerNum: null,
    calledKingCardId: null,
    calledKingColor: null,
    dogCardIds: [],
    dogRetrieved: false,
    discardedDogCardIds: [],
    dogExchangeEndsAt: null,
    currentPliId: null,
    currentTurn: null,
    firstPlayer: null,
    ledColor: '',
    trickCount: 0,
    finTour: false,
    finTourEndsAt: null,
    finPartie: false
  }
}

export function getGameSession(partieId: number) {
  let session = sessions.get(partieId)

  if (!session) {
    session = createSession(partieId)
    sessions.set(partieId, session)
  }

  return session
}

export function resetGameSession(partieId: number) {
  sessions.delete(partieId)
}
