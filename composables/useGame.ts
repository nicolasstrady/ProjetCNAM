import type { Card, ContractType, GameApiState, GameState } from '~/types'

export const useGame = () => {
  const gameState = useState<GameState>('gameState', () => ({
    currentPartie: 1,
    currentJoueurTour: -1,
    currentPlis: 0,
    couleurTour: '',
    couleurAppel: undefined,
    finPartie: false,
    finTour: false,
    plisCount: 0,
    takerNum: undefined,
    partnerNum: undefined,
    scores: [0, 0, 0, 0, 0],
    playerNames: []
  }))

  const playerHand = useState<Card[]>('playerHand', () => [])
  const playerNum = useState<number>('playerNum', () => 0)

  const createGame = async () => {
    try {
      const response = await $fetch('/api/game/create', {
        method: 'POST'
      })

      if (response.success) {
        gameState.value.currentPartie = response.partieId
        return { success: true, partieId: response.partieId }
      }

      return { success: false, error: 'Echec de la creation de la partie' }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur de creation' }
    }
  }

  const joinGame = async (userId: number, partieId: number) => {
    try {
      const response = await $fetch('/api/game/join', {
        method: 'POST',
        body: { userId, partieId }
      })

      if (response.success) {
        playerNum.value = response.playerNum
        gameState.value.currentPartie = partieId
        return { success: true, playerNum: response.playerNum }
      }

      return { success: false, error: 'Echec de rejoindre la partie' }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur pour rejoindre' }
    }
  }

  const dealCards = async (partieId: number) => {
    try {
      const response = await $fetch('/api/game/deal', {
        method: 'POST',
        body: { partieId }
      })

      return { success: response.success }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur de distribution' }
    }
  }

  const getPlayerHand = async (userId: number, partieId: number) => {
    try {
      const url = `/api/game/player-hand?userId=${userId}&partieId=${partieId}` as string
      const response = await $fetch<{ success: boolean; playerNum: number; cards: Card[] }>(url)

      if (response.success) {
        playerHand.value = response.cards
        playerNum.value = response.playerNum
        return { success: true, cards: response.cards }
      }

      return { success: false, error: 'Echec de recuperation des cartes' }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur de recuperation' }
    }
  }

  const setContract = async (userId: number, partieId: number, contract: ContractType) => {
    try {
      const response = await $fetch('/api/game/contract', {
        method: 'POST',
        body: { userId, partieId, contract }
      })

      return { success: response.success }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur de contrat' }
    }
  }

  const callKing = async (partieId: number, cardId: number) => {
    try {
      const response = await $fetch('/api/game/call-king', {
        method: 'POST',
        body: { partieId, cardId }
      })

      if (response.success) {
        gameState.value.partnerNum = response.partnerNum ?? undefined
        gameState.value.couleurAppel = response.couleur ?? undefined

        return {
          success: true,
          partnerNum: response.partnerNum ?? undefined,
          couleur: response.couleur ?? undefined,
          dogCards: response.dogCards ?? []
        }
      }

      return { success: false, error: "Echec d'appel du roi" }
    } catch (error: any) {
      return { success: false, error: error.data?.message || "Erreur d'appel" }
    }
  }

  const retrieveDog = async (userId: number, partieId: number) => {
    try {
      const response = await $fetch('/api/game/retrieve-dog', {
        method: 'POST',
        body: { userId, partieId }
      })

      return { success: response.success }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur de recuperation du chien' }
    }
  }

  const discardDog = async (userId: number, partieId: number, cardId: number) => {
    try {
      const response = await $fetch('/api/game/discard-dog', {
        method: 'POST',
        body: { userId, partieId, cardId }
      })

      return {
        success: response.success,
        dogDone: response.dogDone ?? false,
        dogDiscardCount: response.dogDiscardCount ?? 0
      }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur de chien' }
    }
  }

  const playCard = async (userId: number, partieId: number, cardId: number) => {
    try {
      const response = await $fetch<{ success: boolean; message?: string; finTour?: boolean; finPartie?: boolean }>('/api/game/play-card', {
        method: 'POST',
        body: { userId, partieId, cardId }
      })

      if (response.success) {
        playerHand.value = playerHand.value.filter((card) => card.id !== cardId)
        return { success: true, finTour: response.finTour ?? false, finPartie: response.finPartie ?? false }
      }

      return { success: false, error: response.message || 'Carte non valide' }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur de jeu' }
    }
  }

  const getGameState = async (partieId: number, userId?: number) => {
    try {
      const searchParams = new URLSearchParams({ partieId: String(partieId) })
      if (userId) {
        searchParams.set('userId', String(userId))
      }

      const url = `/api/game/state?${searchParams.toString()}` as string
      const response = await $fetch<GameApiState>(url)

      if (response.success) {
        return { success: true as const, data: response }
      }

      return { success: false as const, error: "Echec de recuperation de l'etat" }
    } catch (error: any) {
      return { success: false as const, error: error.data?.message || 'Erreur de recuperation' }
    }
  }

  return {
    gameState,
    playerHand,
    playerNum,
    createGame,
    joinGame,
    dealCards,
    getPlayerHand,
    setContract,
    callKing,
    retrieveDog,
    discardDog,
    playCard,
    getGameState
  }
}
