export interface User {
  id: number
  nom: string
  prenom: string
  email: string
  pseudo: string
}

export interface Card {
  id: number
  lien: string
  couleur: CardColor
  valeur: string
  points: number
}

export type CardColor = 'SPADE' | 'HEART' | 'DIAMOND' | 'CLOVER' | 'ATOUT' | 'BOUT' | 'PIQUE' | 'COEUR' | 'CARREAU' | 'TREFLE'

export type ContractType = 'PETITE' | 'GARDE' | 'GARDE_SANS' | 'GARDE_CONTRE' | 'WAIT' | 'REFUSE'

export interface Player {
  id: number
  utilisateur: number
  num: number
  partie: number
  reponse: ContractType
  equipe: number
  score: number
  cards: number[]
}

export interface Game {
  id: number
  players: Player[]
  currentPlayer: number
  phase: GamePhase
  calledKingColor?: CardColor
  takerNum?: number
  partnerNum?: number
}

export type GamePhase = 'BIDDING' | 'CALLING' | 'DOG_EXCHANGE' | 'PLAYING' | 'FINISHED'

export interface Pli {
  id: number
  partie: number
  pliChien: boolean
  carte1?: number
  carte2?: number
  carte3?: number
  carte4?: number
  carte5?: number
  joueurGagnant?: number
}

export interface Chien {
  id: number
  partie: number
  carte1: number
  carte2: number
  carte3: number
}

export interface WSMessage {
  type: WSMessageType
  data?: any
}

export type WSMessageType = 
  | 'SUBSCRIBE'
  | 'ANSWER_UPDATE'
  | 'CALL_INFO'
  | 'DOG_READY'
  | 'TOUR_UPDATE'
  | 'KING_PLAYED'
  | 'PLAY'
  | 'PLAYTOUR'
  | 'CHIEN'
  | 'REFUSE'
  | 'CALL'
  | 'ADDDOG'
  | 'BEGIN'
  | 'WAITANSWER'
  | 'WAITCALL'
  | 'WAITDOG'
  | 'WAITTOUR'
  | 'ROIS'

export interface GameState {
  currentPartie: number
  currentJoueurTour: number
  currentPlis: number
  couleurTour: string
  couleurAppel?: string
  finPartie: boolean
  finTour: boolean
  plisCount: number
  takerNum?: number
  partnerNum?: number
  scores: number[]
  playerNames: string[]
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  nom: string
  prenom: string
  email: string
  pseudo: string
  motdepasse: string
}
