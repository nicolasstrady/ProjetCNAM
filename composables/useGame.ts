import type {
  Card,
  ContractType,
  CreateRoomOptions,
  GameApiState,
  GameState,
  LobbyRoomsApiState,
  RoomActionResult
} from '~/types'

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

  const createGame = async (userId: number, options: Partial<CreateRoomOptions>) => {
    try {
      const response = await $fetch<RoomActionResult>('/api/game/create', {
        method: 'POST',
        body: {
          userId,
          options
        }
      })

      if (response.success) {
        if (response.partieId) {
          gameState.value.currentPartie = response.partieId
        }
        if (response.playerNum) {
          playerNum.value = response.playerNum
        }

        return {
          success: true as const,
          partieId: response.partieId,
          playerNum: response.playerNum,
          room: response.room,
          alreadyJoined: response.alreadyJoined ?? false
        }
      }

      return { success: false as const, error: 'Echec de la creation du salon' }
    } catch (error: any) {
      return { success: false as const, error: error.data?.message || 'Erreur de creation' }
    }
  }

  const joinGame = async (userId: number, roomRef: { partieId?: number; code?: string }) => {
    try {
      const response = await $fetch<RoomActionResult>('/api/game/join', {
        method: 'POST',
        body: { userId, ...roomRef }
      })

      if (response.success) {
        if (response.playerNum) {
          playerNum.value = response.playerNum
        }
        if (response.partieId) {
          gameState.value.currentPartie = response.partieId
        }

        return {
          success: true as const,
          playerNum: response.playerNum,
          partieId: response.partieId,
          room: response.room,
          alreadyJoined: response.alreadyJoined ?? false
        }
      }

      return { success: false as const, error: 'Echec de rejoindre le salon' }
    } catch (error: any) {
      return { success: false as const, error: error.data?.message || 'Erreur pour rejoindre' }
    }
  }

  const quickMatch = async (userId: number) => {
    try {
      const response = await $fetch<RoomActionResult>('/api/game/quick-match', {
        method: 'POST',
        body: { userId }
      })

      if (response.success) {
        if (response.playerNum) {
          playerNum.value = response.playerNum
        }
        if (response.partieId) {
          gameState.value.currentPartie = response.partieId
        }

        return {
          success: true as const,
          playerNum: response.playerNum,
          partieId: response.partieId,
          room: response.room,
          alreadyJoined: response.alreadyJoined ?? false
        }
      }

      return { success: false as const, error: 'Echec de recherche rapide' }
    } catch (error: any) {
      return { success: false as const, error: error.data?.message || 'Erreur de recherche rapide' }
    }
  }

  const listRooms = async (userId?: number) => {
    try {
      const searchParams = new URLSearchParams()
      if (userId) {
        searchParams.set('userId', String(userId))
      }

      const queryString = searchParams.toString()
      const url = queryString ? `/api/game/rooms?${queryString}` : '/api/game/rooms'
      const response = await $fetch<LobbyRoomsApiState>(url)

      if (response.success) {
        return {
          success: true as const,
          activeRoom: response.activeRoom,
          publicRooms: response.publicRooms
        }
      }

      return { success: false as const, error: 'Echec de recuperation des salons' }
    } catch (error: any) {
      return { success: false as const, error: error.data?.message || 'Erreur de recuperation des salons' }
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

  const leaveGame = async (userId: number, partieId: number) => {
    try {
      const response = await $fetch<{ success: boolean; closedRoom?: boolean }>('/api/game/leave', {
        method: 'POST',
        body: { userId, partieId }
      })

      return {
        success: response.success,
        closedRoom: response.closedRoom ?? false
      }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur de sortie' }
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
    quickMatch,
    listRooms,
    dealCards,
    leaveGame,
    getPlayerHand,
    setContract,
    callKing,
    retrieveDog,
    discardDog,
    playCard,
    getGameState
  }
}
