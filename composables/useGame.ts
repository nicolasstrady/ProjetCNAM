import type { Card, GameState, ContractType } from '~/types'

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
      
      return { success: false, error: 'Échec de la création de la partie' }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur de création' }
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
      
      return { success: false, error: 'Échec de rejoindre la partie' }
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
      const response = await $fetch(`/api/game/player-hand?userId=${userId}&partieId=${partieId}`)
      
      if (response.success) {
        playerHand.value = response.cards
        playerNum.value = response.playerNum
        return { success: true, cards: response.cards }
      }
      
      return { success: false, error: 'Échec de récupération des cartes' }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur de récupération' }
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
        return { success: true, partnerNum: response.partnerNum ?? undefined, couleur: response.couleur ?? undefined }
      }
      
      return { success: false, error: 'Échec d\'appel du roi' }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur d\'appel' }
    }
  }

  const playCard = async (userId: number, partieId: number, cardId: number, pliId: number, position: number) => {
    try {
      const response = await $fetch('/api/game/play-card', {
        method: 'POST',
        body: { userId, partieId, cardId, pliId, position }
      })
      
      if (response.success) {
        // Retirer la carte de la main du joueur
        playerHand.value = playerHand.value.filter(c => c.id !== cardId)
        return { success: true }
      }
      
      return { success: false, error: 'Carte non valide' }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur de jeu' }
    }
  }

  const getGameState = async (partieId: number) => {
    try {
      const response = await $fetch(`/api/game/state?partieId=${partieId}`) as any
      
      if (response.success) {
        return { success: true as const, data: response }
      }
      
      return { success: false as const, error: 'Échec de récupération de l\'état' }
    } catch (error: any) {
      return { success: false as const, error: error.data?.message || 'Erreur de récupération' }
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
    playCard,
    getGameState
  }
}
