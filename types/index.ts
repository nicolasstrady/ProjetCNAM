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

export type CardColor =
  | 'SPADE'
  | 'HEART'
  | 'DIAMOND'
  | 'CLOVER'
  | 'ATOUT'
  | 'BOUT'
  | 'PIQUE'
  | 'COEUR'
  | 'CARREAU'
  | 'TREFLE'

export type ContractType =
  | 'PETITE'
  | 'GARDE'
  | 'GARDE_SANS'
  | 'GARDE_CONTRE'
  | 'WAIT'
  | 'REFUSE'

export type RoomVisibility = 'PRIVATE' | 'PUBLIC' | 'UNLISTED'
export type RoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED'
export type RoomMode = 'CLASSIC' | 'QUICK_MATCH' | 'SOLO'
export type PlayerType = 'HUMAN' | 'BOT'
export type BotLevel = 'STANDARD'

export interface CreateRoomOptions {
  visibility: RoomVisibility
  allowQuickJoin: boolean
  fillWithBots: boolean
  mode: RoomMode
}

export interface LobbyRoomPlayer {
  userId: number
  pseudo: string
  playerNum: number
  playerType: PlayerType
}

export interface LobbyRoomSummary {
  id: number
  code: string | null
  visibility: RoomVisibility
  status: RoomStatus
  mode: RoomMode
  allowQuickJoin: boolean
  fillWithBots: boolean
  ownerUserId: number | null
  playerCount: number
  openSlots: number
  createdAt: string | null
  startedAt: string | null
  players: LobbyRoomPlayer[]
  myPlayerNum: number | null
}

export interface LobbyRoomsApiState {
  success: true
  activeRoom: LobbyRoomSummary | null
  publicRooms: LobbyRoomSummary[]
}

export interface RoomActionResult {
  success: boolean
  partieId?: number
  playerNum?: number
  room?: LobbyRoomSummary
  alreadyJoined?: boolean
  error?: string
}

export interface Player {
  id: number
  utilisateur: number
  num: number
  partie: number
  reponse: ContractType
  equipe: number
  score: number
  cards: number[]
  playerType: PlayerType
  botLevel: BotLevel | null
}

export interface TablePlayer {
  id: number
  utilisateur: number
  num: number
  partie: number
  reponse: ContractType
  equipe: number
  score: number
  pseudo: string
  handCount: number
  playerType: PlayerType
  botLevel: BotLevel | null
}

export interface CurrentPliCard {
  position: number
  playerNum: number | null
  card: Card
}

export interface CurrentPliState {
  id: number
  joueurGagnant: number | null
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
export type TarotTeamSide = 'ATTACK' | 'DEFENSE'
export type TarotPlayerRole = 'TAKER' | 'PARTNER' | 'DEFENDER'

export interface TarotFinalPlayerResult {
  playerNum: number
  pseudo: string
  side: TarotTeamSide
  role: TarotPlayerRole
  roleLabel: string
  trickPoints: number
  finalDelta: number
}

export interface TarotFinalResult {
  contract: Extract<ContractType, 'PETITE' | 'GARDE' | 'GARDE_SANS' | 'GARDE_CONTRE'>
  contractLabel: string
  multiplier: number
  takerNum: number
  partnerNum: number | null
  attackPoints: number
  defensePoints: number
  dogPoints: number
  dogOwner: TarotTeamSide
  bouts: number
  requiredPoints: number
  pointDifference: number
  basePoints: number
  totalScore: number
  attackWon: boolean
  bonusesHandled: boolean
  playerResults: TarotFinalPlayerResult[]
}

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

export interface GameApiState {
  success: true
  roomStatus: RoomStatus
  players: TablePlayer[]
  answerCount: number
  taker: { num: number; reponse: ContractType } | null
  currentTurn: number | null
  trickCount: number
  currentPli: CurrentPliState | null
  currentPliCards: CurrentPliCard[]
  discardedDogCards: Card[]
  partnerNum: number | null
  teamsRevealed: boolean
  calledKingColor: string | null
  dogCards: Card[]
  dogRetrieved: boolean
  dogDiscardCount: number
  finTour: boolean
  finPartie: boolean
  phase: GamePhase
  finalResult: TarotFinalResult | null
}

export interface SceneTableState {
  phase: GamePhase
  playerHand: Card[]
  players: TablePlayer[]
  myPlayerNum: number
  currentTurn: number | null
  currentPliId: number | null
  currentPliWinnerNum: number | null
  finTour: boolean
  takerNum: number | null
  partnerNum: number | null
  teamsRevealed: boolean
  dogCards: Card[]
  discardedDogCards: Card[]
  dogRetrieved: boolean
  dogDiscardCount: number
  currentPliCards: CurrentPliCard[]
  kingChoices: Card[]
  selectableCardIds: number[]
  statusText: string
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
