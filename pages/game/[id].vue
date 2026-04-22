<template>
  <div class="game-page">
    <div class="game-layout">
      <div class="table-stage">
        <div id="phaser-game" class="phaser-container"></div>

        <div class="game-top-actions">
          <button @click="handleLeaveGame" class="btn btn-secondary btn-compact">Quitter</button>
        </div>

        <aside v-if="showActionPanel" class="action-hud">
          <section class="action-panel">
            <p v-if="actionHint" class="action-hint">{{ actionHint }}</p>

            <div v-if="gamePhase === 'BIDDING'" class="actions-list">
              <button @click="handleContract('PETITE')" class="btn btn-primary" :disabled="!isMyTurn">Petite</button>
              <button @click="handleContract('GARDE')" class="btn btn-primary" :disabled="!isMyTurn">Garde</button>
              <button @click="handleContract('GARDE_SANS')" class="btn btn-primary" :disabled="!isMyTurn">Garde sans</button>
              <button @click="handleContract('GARDE_CONTRE')" class="btn btn-primary" :disabled="!isMyTurn">Garde contre</button>
              <button @click="handleContract('REFUSE')" class="btn btn-danger" :disabled="!isMyTurn">Passer</button>
            </div>

          </section>
        </aside>

        <section v-if="showRotateOverlay" class="rotate-overlay">
          <div class="rotate-card">
            <h2>Tournez votre téléphone</h2>
            <p>Le tapis est optimisé pour le paysage. Passez en mode horizontal pour jouer confortablement.</p>
          </div>
        </section>

        <section v-if="finalResult" class="final-summary-overlay">
          <div
            class="final-summary"
            :class="{
              'outcome-victory': finalOutcomeState === 'victory',
              'outcome-defeat': finalOutcomeState === 'defeat'
            }"
          >
            <div class="final-summary-header">
              <div>
                <h2>{{ finalOutcomeTitle }}</h2>
                <p>{{ finalSummaryText }}</p>
              </div>

              <span class="final-summary-pill">{{ finalResult.attackWon ? 'Attaque gagnante' : 'Défense gagnante' }}</span>
            </div>

            <div class="final-stats-grid">
              <div class="final-stat-card">
                <span>Contrat</span>
                <strong>{{ finalResult.contractLabel }} x{{ finalResult.multiplier }}</strong>
              </div>
              <div class="final-stat-card">
                <span>Bouts attaque</span>
                <strong>{{ finalResult.bouts }}</strong>
              </div>
              <div class="final-stat-card">
                <span>Points attaque</span>
                <strong>{{ formatScoreValue(finalResult.attackPoints) }}</strong>
              </div>
              <div class="final-stat-card">
                <span>Points demandés</span>
                <strong>{{ formatScoreValue(finalResult.requiredPoints) }}</strong>
              </div>
              <div class="final-stat-card">
                <span>Ecart</span>
                <strong>{{ formatSignedScore(finalResult.pointDifference) }}</strong>
              </div>
              <div class="final-stat-card">
                <span>Base</span>
                <strong>{{ formatScoreValue(finalResult.basePoints) }}</strong>
              </div>
              <div class="final-stat-card">
                <span>Valeur du contrat</span>
                <strong>{{ formatScoreValue(finalResult.totalScore) }}</strong>
              </div>
              <div class="final-stat-card">
                <span>Chien</span>
                <strong>{{ formatScoreValue(finalResult.dogPoints) }} pour {{ finalResult.dogOwner === 'ATTACK' ? 'attaque' : 'défense' }}</strong>
              </div>
            </div>

            <p v-if="!finalResult.bonusesHandled" class="final-summary-note">
              Le tableau applique le score contrat + bouts. Les bonus de poignée, chelem et petit au bout ne sont pas encore gérés.
            </p>

            <div class="final-table-wrapper">
              <table class="final-table">
                <thead>
                  <tr>
                    <th>Joueur</th>
                    <th>Rôle</th>
                    <th>Camp</th>
                    <th>Points de plis</th>
                    <th>Score final</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="result in finalResult.playerResults"
                    :key="result.playerNum"
                    :class="{ current: result.playerNum === playerNum }"
                  >
                    <td>{{ result.pseudo }}</td>
                    <td>{{ result.roleLabel }}</td>
                    <td>{{ result.side === 'ATTACK' ? 'Attaque' : 'Défense' }}</td>
                    <td>{{ formatScoreValue(result.trickPoints) }}</td>
                    <td :class="result.finalDelta >= 0 ? 'score-positive' : 'score-negative'">
                      {{ formatSignedScore(result.finalDelta) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card, GameApiState, GamePhase, SceneTableState } from '~/types'
import type { GameScene } from '~/phaser/scenes/GameScene'
import { getPlayableCardIds, isDogDiscardForbidden, isKing, normalizeCardColor } from '~/utils/tarot'

const route = useRoute()
const router = useRouter()
const apiUrl = useApiUrl()
const { user, restoreSession } = useAuth()
const {
  playerHand,
  playerNum,
  getPlayerHand,
  setContract,
  callKing,
  retrieveDog,
  discardDog,
  playCard,
  getGameState,
  leaveGame
} = useGame()
const { initGame, destroyGame } = usePhaser()

const partieId = computed(() => Number(route.params.id))
const gameScene = shallowRef<GameScene | null>(null)
const gameData = ref<GameApiState | null>(null)
const allCards = ref<Card[]>([])
const statusText = ref('Chargement...')
const showRotateOverlay = ref(false)

const gamePhase = computed<GamePhase>(() => gameData.value?.phase ?? 'BIDDING')
const currentTurn = computed(() => gameData.value?.currentTurn ?? null)
const isMyTurn = computed(() => currentTurn.value === playerNum.value)
const isTaker = computed(() => gameData.value?.taker?.num === playerNum.value)
const finalResult = computed(() => gameData.value?.finalResult ?? null)
const myFinalResult = computed(() => {
  if (!finalResult.value) {
    return null
  }

  return finalResult.value.playerResults.find((result) => result.playerNum === playerNum.value) ?? null
})
const finalOutcomeTitle = computed(() => {
  if (!myFinalResult.value) {
    return 'Fin de partie'
  }

  return myFinalResult.value.finalDelta >= 0 ? 'Victoire' : 'Défaite'
})
const finalOutcomeState = computed(() => {
  const finalDelta = myFinalResult.value?.finalDelta

  if (typeof finalDelta !== 'number') {
    return 'neutral'
  }

  return finalDelta >= 0 ? 'victory' : 'defeat'
})
const finalSummaryText = computed(() => {
  if (!finalResult.value) {
    return ''
  }

  const difference = formatScoreValue(Math.abs(finalResult.value.pointDifference))
  const target = formatScoreValue(finalResult.value.requiredPoints)
  const attackScore = formatScoreValue(finalResult.value.attackPoints)

  if (finalResult.value.attackWon) {
    return `L'attaque fait ${attackScore} pour ${target} demandés et passe le contrat de ${difference}.`
  }

  return `L'attaque fait ${attackScore} pour ${target} demandés et chute de ${difference}.`
})
const showActionPanel = computed(() => {
  if (!gameData.value || gamePhase.value === 'FINISHED') {
    return false
  }

  return gamePhase.value === 'BIDDING' && isMyTurn.value
})

const actionHint = computed(() => {
  if (!showActionPanel.value || !gameData.value) {
    return ''
  }

  if (gamePhase.value === 'BIDDING') {
    return 'Choisissez votre contrat.'
  }

  return ''
})


const kingChoices = computed(() => {
  return allCards.value.filter((card) => {
    return isKing(card) && !['ATOUT', 'BOUT'].includes(normalizeCardColor(card.couleur))
  })
})

const selectableCardIds = computed(() => {
  if (!gameData.value) {
    return [] as number[]
  }

  if (
    gameData.value.phase === 'DOG_EXCHANGE' &&
    isTaker.value &&
    gameData.value.dogRetrieved &&
    gameData.value.dogDiscardCount < 3
  ) {
    return playerHand.value
      .filter((card) => !isDogDiscardForbidden(card))
      .map((card) => card.id)
  }

  if (gameData.value.phase === 'PLAYING' && isMyTurn.value && !gameData.value.finPartie) {
    const currentTrickCards = gameData.value.finTour
      ? []
      : gameData.value.currentPliCards.map((playedCard) => playedCard.card)

    return getPlayableCardIds(
      playerHand.value,
      currentTrickCards,
      gameData.value.trickCount
    )
  }

  return [] as number[]
})

const sceneTableState = computed<SceneTableState | null>(() => {
  if (!gameData.value || !playerNum.value) {
    return null
  }

  return {
    phase: gameData.value.phase,
    playerHand: playerHand.value,
    players: gameData.value.players,
    myPlayerNum: playerNum.value,
    currentTurn: gameData.value.currentTurn,
    currentPliId: gameData.value.currentPli?.id ?? null,
    currentPliWinnerNum: gameData.value.currentPli?.joueurGagnant ?? null,
    finTour: gameData.value.finTour,
    takerNum: gameData.value.taker?.num ?? null,
    partnerNum: gameData.value.partnerNum ?? null,
    teamsRevealed: gameData.value.teamsRevealed,
    calledKingColor: gameData.value.calledKingColor,
    dogCards: gameData.value.dogCards,
    discardedDogCards: gameData.value.discardedDogCards,
    dogRetrieved: gameData.value.dogRetrieved,
    dogDiscardCount: gameData.value.dogDiscardCount,
    currentPliCards: gameData.value.currentPliCards,
    kingChoices: gameData.value.phase === 'CALLING' && isTaker.value ? kingChoices.value : [],
    selectableCardIds: selectableCardIds.value,
    statusText: statusText.value
  }
})

watch([sceneTableState, gameScene], ([tableState, scene]) => {
  if (tableState && scene) {
    scene.setTableState(tableState)
  }
}, { immediate: true })

let pollTimeout: ReturnType<typeof setTimeout> | null = null
let dogRetrieveTimeout: ReturnType<typeof setTimeout> | null = null
let refreshInFlight = false
let refreshPromise: Promise<void> | null = null
let pollingActive = false
let dogRetrieveInFlight = false

const AUTO_RETRIEVE_DOG_DELAY_MS = 1000

const clearDogRetrieveTimeout = () => {
  if (dogRetrieveTimeout) {
    clearTimeout(dogRetrieveTimeout)
    dogRetrieveTimeout = null
  }
}

const updateViewportMode = () => {
  if (!import.meta.client) {
    return
  }

  const isMobileViewport = window.matchMedia('(max-width: 980px) and (pointer: coarse)').matches
  showRotateOverlay.value = isMobileViewport && window.innerHeight > window.innerWidth
}

const tryLockLandscape = async () => {
  const orientationApi = import.meta.client
    ? (screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> })
    : null

  if (!orientationApi || typeof orientationApi.lock !== 'function') {
    return
  }

  try {
    await orientationApi.lock('landscape')
  } catch {
    // Safari iOS ignore la plupart des tentatives de verrouillage.
  }
}

onMounted(async () => {
  await restoreSession()

  if (!user.value) {
    await router.push('/')
    return
  }

  updateViewportMode()
  window.addEventListener('resize', updateViewportMode)
  window.addEventListener('orientationchange', updateViewportMode)
  void tryLockLandscape()

  await nextTick()
  await loadCardsCatalog()
  await initPhaser()
  await refreshGame()
  startGamePolling()
})

onUnmounted(() => {
  stopGamePolling()
  clearDogRetrieveTimeout()
  window.removeEventListener('resize', updateViewportMode)
  window.removeEventListener('orientationchange', updateViewportMode)
  gameScene.value = null
  destroyGame()
})

const initPhaser = async () => {
  if (!process.client) {
    return
  }

  const { GameScene } = await import('~/phaser/scenes/GameScene')
  const game = await initGame('phaser-game')

  game.scene.add('GameScene', GameScene, true, {
    onCardClick: handleSceneCardSelection,
    onCallKing: handleCallKingCard
  })

  gameScene.value = markRaw(game.scene.getScene('GameScene') as GameScene)
}

const loadCardsCatalog = async () => {
  const response = await $fetch<{ success: boolean; cards: Card[] }>(apiUrl('/api/game/cards') as string)

  if (response.success) {
    allCards.value = response.cards
  }
}

const refreshGame = async () => {
  if (refreshPromise) {
    await refreshPromise
    return
  }

  refreshPromise = (async () => {
    if (!user.value) {
      return
    }

    await loadPlayerCards()
    await loadGameState()
  })()

  try {
    await refreshPromise
  } finally {
    refreshPromise = null
  }
}

const loadPlayerCards = async () => {
  if (!user.value) {
    return
  }

  await getPlayerHand(user.value.id, partieId.value)
}

const loadGameState = async () => {
  const result = await getGameState(partieId.value, user.value?.id)

  if (!result.success || !result.data) {
    return
  }

  gameData.value = result.data
  updateStatusText(result.data)
}

const formatCalledKingLabel = (color: string | null) => {
  switch (normalizeCardColor(color)) {
    case 'COEUR':
      return 'roi de cœur'
    case 'CARREAU':
      return 'roi de carreau'
    case 'TREFLE':
      return 'roi de trèfle'
    case 'PIQUE':
      return 'roi de pique'
    default:
      return 'roi appelé'
  }
}

const updateStatusText = (state: GameApiState) => {
  const currentPlayer = state.players.find((player) => player.num === state.currentTurn)
  const calledKingLabel = formatCalledKingLabel(state.calledKingColor)

  switch (state.phase) {
    case 'BIDDING':
      statusText.value = isMyTurn.value ? 'À vous de déclarer' : "Phase d'enchères"
      break
    case 'CALLING':
      statusText.value = isTaker.value ? 'Choisissez un roi sur le tapis' : 'Le preneur choisit un roi'
      break
    case 'DOG_EXCHANGE':
      if (!isTaker.value) {
        statusText.value = state.dogDiscardCount >= 3
          ? `Chien valide - ${calledKingLabel}`
          : `${calledKingLabel} - le preneur fait son chien`
      } else if (!state.dogRetrieved) {
        statusText.value = 'Récupérez le chien'
      } else if (state.dogDiscardCount >= 3) {
        statusText.value = 'Le chien est valide'
      } else {
        statusText.value = `Choisissez ${3 - state.dogDiscardCount} carte(s) pour le chien`
      }
      break
    case 'PLAYING':
      if (state.finPartie) {
        statusText.value = 'Fin de partie'
      } else if (state.finTour) {
        statusText.value = 'Pli terminé'
      } else if (isMyTurn.value) {
        statusText.value = 'À vous de jouer'
      } else if (currentPlayer) {
        statusText.value = `Au tour de ${currentPlayer.pseudo}`
      } else {
        statusText.value = 'Partie en cours'
      }
      break
    case 'FINISHED':
      if (state.finalResult) {
        const currentPlayerResult = state.finalResult.playerResults.find((result) => result.playerNum === playerNum.value)
        statusText.value = currentPlayerResult && currentPlayerResult.finalDelta >= 0 ? 'Victoire' : 'Défaite'
      } else {
        statusText.value = 'Partie close'
      }
      break
  }
}

const formatScoreValue = (value: number) => {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
}

const formatSignedScore = (value: number) => {
  const formattedValue = formatScoreValue(Math.abs(value))
  return `${value >= 0 ? '+' : '-'}${formattedValue}`
}

const startGamePolling = () => {
  stopGamePolling()
  pollingActive = true

  const scheduleNextPoll = () => {
    if (!pollingActive) {
      return
    }

    const hasBots = gameData.value?.players.some((player) => player.playerType === 'BOT') ?? false
    const delayMs = hasBots ? 450 : 1200

    pollTimeout = setTimeout(async () => {
      if (!pollingActive) {
        return
      }

      if (refreshInFlight) {
        scheduleNextPoll()
        return
      }

      refreshInFlight = true

      try {
        await refreshGame()
      } finally {
        refreshInFlight = false
        if (pollingActive) {
          scheduleNextPoll()
        }
      }
    }, delayMs)
  }

  scheduleNextPoll()
}

const stopGamePolling = () => {
  pollingActive = false

  if (pollTimeout) {
    clearTimeout(pollTimeout)
    pollTimeout = null
  }

  refreshInFlight = false
}

const handleContract = async (contract: string) => {
  if (!user.value || !isMyTurn.value) {
    return
  }

  const result = await setContract(user.value.id, partieId.value, contract as any)

  if (!result.success) {
    statusText.value = result.error ?? 'Action impossible'
    return
  }

  await refreshGame()
}

const handleCallKingCard = async (card: Card) => {
  if (!isTaker.value) {
    return
  }

  const result = await callKing(partieId.value, card.id)

  if (!result.success) {
    statusText.value = result.error ?? "Impossible d'appeler ce roi"
    return
  }

  await refreshGame()
}

const handleRetrieveDog = async () => {
  if (
    !user.value ||
    !isTaker.value ||
    gamePhase.value !== 'DOG_EXCHANGE' ||
    gameData.value?.dogRetrieved ||
    dogRetrieveInFlight
  ) {
    return
  }

  clearDogRetrieveTimeout()
  dogRetrieveInFlight = true

  try {
    const result = await retrieveDog(user.value.id, partieId.value)

    if (!result.success) {
      statusText.value = result.error ?? 'Impossible de récupérer le chien'
      return
    }

    await refreshGame()
  } finally {
    dogRetrieveInFlight = false
  }
}

const shouldAutoRetrieveDog = () => {
  const state = gameData.value
  return Boolean(state && state.phase === 'DOG_EXCHANGE' && isTaker.value && !state.dogRetrieved)
}

watch(shouldAutoRetrieveDog, (shouldRetrieve) => {
  clearDogRetrieveTimeout()

  if (!shouldRetrieve) {
    return
  }

  dogRetrieveTimeout = setTimeout(() => {
    dogRetrieveTimeout = null
    void handleRetrieveDog()
  }, AUTO_RETRIEVE_DOG_DELAY_MS)
}, { immediate: true })

const handleSceneCardSelection = async (card: Card) => {
  if (!user.value || !gameData.value) {
    return
  }

  if (gameData.value.phase === 'DOG_EXCHANGE') {
    const result = await discardDog(user.value.id, partieId.value, card.id)

    if (!result.success) {
      statusText.value = result.error ?? 'Carte invalide pour le chien'
      return
    }
  } else if (gameData.value.phase === 'PLAYING') {
    const result = await playCard(user.value.id, partieId.value, card.id)

    if (!result.success) {
      statusText.value = result.error ?? 'Carte invalide'
      return
    }
  }

  await refreshGame()
}

const handleLeaveGame = async () => {
  if (user.value) {
    await leaveGame(user.value.id, partieId.value)
  }

  await router.push('/lobby')
}
</script>

<style scoped>
.game-page {
  position: relative;
  height: 100dvh;
  overflow: hidden;
  box-sizing: border-box;
  padding: clamp(4px, 0.8vw, 10px);
  background:
    radial-gradient(circle at top, rgba(237, 214, 154, 0.15), transparent 32%),
    linear-gradient(160deg, #132d21 0%, #0a1913 100%);
}


.game-layout {
  position: relative;
  width: 100%;
  height: 100%;
  display: block;
}

.table-stage {
  position: relative;
  height: 100%;
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid rgba(231, 210, 155, 0.18);
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.28),
    inset 0 0 0 1px rgba(255, 255, 255, 0.02);
  background:
    radial-gradient(circle at top, rgba(61, 126, 81, 0.18), transparent 30%),
    radial-gradient(circle at bottom, rgba(6, 27, 18, 0.28), transparent 38%),
    linear-gradient(180deg, #123424 0%, #0b1a13 100%);
}

.final-summary-overlay {
  position: absolute;
  inset: 18px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 56px 18px 18px;
  background: transparent;
  backdrop-filter: none;
  pointer-events: none;
  z-index: 20;
}

.final-summary {
  width: min(100%, 980px);
  max-height: 100%;
  overflow: auto;
  padding: 24px 26px;
  border-radius: 22px;
  border: 1px solid rgba(231, 210, 155, 0.2);
  background: rgba(7, 19, 14, 0.94);
  color: #efe5ce;
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.34);
  pointer-events: auto;
}

.final-summary.outcome-victory {
  box-shadow: 0 18px 48px rgba(51, 132, 79, 0.18);
}

.final-summary.outcome-defeat {
  box-shadow: 0 18px 48px rgba(150, 58, 47, 0.18);
}

.final-summary-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  margin-bottom: 20px;
}

.final-summary-header h2 {
  margin: 0;
  color: #f8edc8;
  font-size: 2rem;
}

.final-summary-header p {
  margin: 8px 0 0;
  color: #ddd0b0;
}

.final-summary-pill {
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid rgba(231, 210, 155, 0.22);
  background: rgba(229, 198, 128, 0.12);
  color: #f9e7b5;
  font-weight: 700;
  white-space: nowrap;
}

.final-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.final-stat-card {
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(231, 210, 155, 0.12);
  display: grid;
  gap: 8px;
}

.final-stat-card span {
  color: #d6c8a5;
  font-size: 0.92rem;
}

.final-stat-card strong {
  color: #fff1c7;
  font-size: 1.15rem;
}

.final-summary-note {
  margin: 0 0 18px;
  color: #cabd9d;
}

.final-table-wrapper {
  overflow-x: auto;
}

.final-table {
  width: 100%;
  border-collapse: collapse;
}

.final-table th,
.final-table td {
  padding: 14px 12px;
  text-align: left;
  border-bottom: 1px solid rgba(231, 210, 155, 0.12);
}

.final-table th {
  color: #f6eabf;
  font-size: 0.92rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.final-table tbody tr.current {
  background: rgba(255, 255, 255, 0.05);
}

.score-positive {
  color: #93daaa;
  font-weight: 700;
}

.score-negative {
  color: #ef9b8f;
  font-weight: 700;
}

.phaser-container {
  position: absolute;
  inset: 0;
  height: 100%;
  min-height: 0;
}

.phaser-container :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  image-rendering: auto;
}

.game-top-actions {
  position: absolute;
  z-index: 28;
  top: max(12px, calc(env(safe-area-inset-top, 0px) + 8px));
  right: max(12px, calc(env(safe-area-inset-right, 0px) + 8px));
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
}

.action-hud {
  position: absolute;
  z-index: 14;
  top: 50%;
  left: 50%;
  width: min(360px, calc(100% - 24px));
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.action-panel {
  padding: 10px;
  border-radius: 18px;
  border: 1px solid rgba(231, 210, 155, 0.14);
  background: rgba(7, 19, 14, 0.72);
  color: #eee5ce;
  backdrop-filter: blur(8px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
}

.action-hint {
  margin: 0 0 8px;
  color: #ddd0b0;
  font-size: 0.8rem;
  line-height: 1.25;
  text-align: left;
}

.actions-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.actions-list .btn:last-child {
  grid-column: 1 / -1;
}

.actions-stack {
  display: grid;
  gap: 6px;
}

.btn {
  border: 0;
  border-radius: 999px;
  padding: 10px 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease, background 0.2s ease;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.btn-primary {
  background: linear-gradient(135deg, #d0a84a 0%, #b78327 100%);
  color: #1a1204;
}

.btn-danger {
  background: linear-gradient(135deg, #b14438 0%, #8f2b23 100%);
  color: #fff3ef;
}

.btn-secondary {
  background: rgba(7, 19, 14, 0.48);
  color: #f5ecd5;
  border: 1px solid rgba(231, 210, 155, 0.18);
}

.btn-compact {
  min-width: 92px;
  padding-inline: 12px;
  pointer-events: auto;
}

.rotate-overlay {
  position: absolute;
  inset: 0;
  z-index: 24;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(4, 11, 8, 0.74);
  backdrop-filter: blur(10px);
}

.rotate-card {
  width: min(100%, 380px);
  padding: 24px 22px;
  border-radius: 22px;
  border: 1px solid rgba(231, 210, 155, 0.18);
  background: rgba(7, 19, 14, 0.92);
  color: #efe3c2;
  text-align: center;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
}

.rotate-card h2 {
  margin: 0 0 10px;
  font-size: 1.35rem;
  color: #f9edc5;
}

.rotate-card p {
  margin: 0;
  color: #dccfaf;
  line-height: 1.5;
}

@media (max-width: 980px) {
  .game-page {
    padding: 0;
  }

  .final-summary-header {
    flex-direction: column;
  }

  .final-summary-overlay {
    inset: 10px;
    padding: 48px 0 0;
  }

  .final-summary {
    width: min(100%, calc(100% - 12px));
    max-height: calc(100% - 6px);
    padding: 18px;
  }

  .table-stage {
    border-radius: 0;
    border: 0;
  }

  .game-top-actions {
    top: calc(env(safe-area-inset-top, 0px) + 8px);
    right: calc(env(safe-area-inset-right, 0px) + 8px);
  }

  .btn {
    padding: 9px 11px;
    font-size: 0.8rem;
  }

  .action-hud {
    width: min(300px, calc(100% - 20px));
  }

  .action-panel {
    padding: 8px 10px;
    border-radius: 18px;
  }

  .action-hint {
    margin-bottom: 6px;
    font-size: 0.7rem;
  }

  .actions-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px;
  }
}

@media (max-width: 980px) and (orientation: portrait) {
  .action-hud {
    opacity: 0;
    pointer-events: none;
  }

  .game-top-actions {
    opacity: 1;
    pointer-events: none;
  }
}

@media (max-width: 720px) and (orientation: landscape) {
  .action-hud {
    width: min(280px, calc(100% - 18px));
  }

  .action-panel {
    padding: 8px;
  }

  .actions-list {
    gap: 5px;
  }
}
</style>



