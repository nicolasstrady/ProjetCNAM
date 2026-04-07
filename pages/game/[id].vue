<template>
  <div class="game-page">
    <div class="game-header">
      <div class="game-info">
        <h1>Partie #{{ partieId }}</h1>
        <p>{{ user?.pseudo }} · Joueur {{ playerNum }}</p>
      </div>

      <div class="game-actions">
        <span class="status-pill">{{ statusText }}</span>
        <button @click="handleLeaveGame" class="btn btn-secondary">Quitter</button>
      </div>
    </div>

    <div class="game-layout">
      <div id="phaser-game" class="phaser-container"></div>

      <aside class="side-panel">
        <section class="panel">
          <h2>Phase</h2>
          <p>{{ phaseLabel }}</p>

          <div v-if="gamePhase === 'BIDDING'" class="actions-list">
            <button @click="handleContract('PETITE')" class="btn btn-primary" :disabled="!isMyTurn">Petite</button>
            <button @click="handleContract('GARDE')" class="btn btn-primary" :disabled="!isMyTurn">Garde</button>
            <button @click="handleContract('GARDE_SANS')" class="btn btn-primary" :disabled="!isMyTurn">Garde sans</button>
            <button @click="handleContract('GARDE_CONTRE')" class="btn btn-primary" :disabled="!isMyTurn">Garde contre</button>
            <button @click="handleContract('REFUSE')" class="btn btn-danger" :disabled="!isMyTurn">Passer</button>
          </div>

          <div v-else-if="gamePhase === 'CALLING'" class="phase-help">
            <p v-if="isTaker">Choisissez un roi directement sur le tapis.</p>
            <p v-else>Le preneur appelle un roi.</p>
          </div>

          <div v-else-if="gamePhase === 'DOG_EXCHANGE'" class="phase-help">
            <template v-if="isTaker">
              <p v-if="!gameData?.dogRetrieved">Recuperez le chien, puis jetez 3 cartes depuis votre main.</p>
              <p v-else-if="(gameData?.dogDiscardCount ?? 0) < 3">Selectionnez {{ 3 - (gameData?.dogDiscardCount ?? 0) }} carte(s) dans votre main.</p>
              <p v-else>Le chien est valide.</p>
              <button
                v-if="!gameData?.dogRetrieved"
                @click="handleRetrieveDog"
                class="btn btn-primary"
              >
                Recuperer le chien
              </button>
            </template>

            <p v-else>Le preneur prepare le chien.</p>
          </div>

          <div v-else-if="false" class="phase-help">
            <template v-if="isTaker">
              <p v-if="!gameData?.dogRetrieved">Récupérez le chien, puis jetez 3 cartes depuis votre main.</p>
              <p v-else>Sélectionnez {{ 3 - (gameData?.dogDiscardCount ?? 0) }} carte(s) dans votre main.</p>
              <button
                v-if="!gameData?.dogRetrieved"
                @click="handleRetrieveDog"
                class="btn btn-primary"
              >
                Récupérer le chien
              </button>
            </template>

            <p v-else>Le preneur prépare le chien.</p>
          </div>

          <div v-else-if="gamePhase === 'PLAYING'" class="phase-help">
            <p v-if="isMyTurn">Jouez une carte depuis votre main.</p>
            <p v-else>Attendez votre tour.</p>
          </div>

          <div v-else class="phase-help">
            <p>La partie est terminée.</p>
          </div>
        </section>

        <section class="panel">
          <h2>Scores</h2>
          <div class="score-list">
            <div
              v-for="player in players"
              :key="player.num"
              class="score-row"
              :class="{ active: player.num === currentTurn }"
            >
              <span>{{ player.pseudo }}</span>
              <span>{{ player.score.toFixed(1) }}</span>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <section v-if="finalResult" class="final-summary" :class="finalOutcomeClass">
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
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Card, GameApiState, GamePhase, SceneTableState, TablePlayer } from '~/types'
import type { GameScene } from '~/phaser/scenes/GameScene'
import { getPlayableCardIds, isDogDiscardForbidden, isKing, normalizeCardColor } from '~/utils/tarot'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const {
  playerHand,
  playerNum,
  getPlayerHand,
  setContract,
  callKing,
  retrieveDog,
  discardDog,
  playCard,
  getGameState
} = useGame()
const { initGame, destroyGame } = usePhaser()

const partieId = computed(() => Number(route.params.id))
const gameScene = shallowRef<GameScene | null>(null)
const gameData = ref<GameApiState | null>(null)
const allCards = ref<Card[]>([])
const statusText = ref('Chargement...')

const players = computed<TablePlayer[]>(() => gameData.value?.players ?? [])
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
const finalOutcomeClass = computed(() => {
  if (!myFinalResult.value) {
    return 'outcome-neutral'
  }

  return myFinalResult.value.finalDelta >= 0 ? 'outcome-victory' : 'outcome-defeat'
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

const phaseLabel = computed(() => {
  switch (gamePhase.value) {
    case 'BIDDING':
      return 'Enchères'
    case 'CALLING':
      return 'Appel du roi'
    case 'DOG_EXCHANGE':
      return 'Chien'
    case 'PLAYING':
      return 'Jeu de pli'
    case 'FINISHED':
      return 'Partie terminée'
    default:
      return 'En attente'
  }
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

let pollInterval: NodeJS.Timeout | null = null

onMounted(async () => {
  if (!user.value) {
    await router.push('/')
    return
  }

  await nextTick()
  await loadCardsCatalog()
  await initPhaser()
  await refreshGame()
  startGamePolling()
})

onUnmounted(() => {
  stopGamePolling()
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
    onCallKing: handleCallKingCard,
    onRetrieveDog: handleRetrieveDog
  })

  gameScene.value = markRaw(game.scene.getScene('GameScene') as GameScene)
}

const loadCardsCatalog = async () => {
  const response = await $fetch<{ success: boolean; cards: Card[] }>('/api/game/cards' as string)

  if (response.success) {
    allCards.value = response.cards
  }
}

const refreshGame = async () => {
  if (!user.value) {
    return
  }

  await loadPlayerCards()
  await loadGameState()
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

const updateStatusText = (state: GameApiState) => {
  const currentPlayer = state.players.find((player) => player.num === state.currentTurn)

  switch (state.phase) {
    case 'BIDDING':
      statusText.value = isMyTurn.value ? 'A vous de declarer' : 'Phase dencheres'
      break
    case 'CALLING':
      statusText.value = isTaker.value ? 'Choisissez un roi sur le tapis' : 'Le preneur appelle un roi'
      break
    case 'DOG_EXCHANGE':
      if (!isTaker.value) {
        statusText.value = state.dogDiscardCount >= 3 ? 'Le chien est valide' : 'Le preneur fait son chien'
      } else if (!state.dogRetrieved) {
        statusText.value = 'Recuperez le chien'
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
        statusText.value = 'Pli termine'
      } else if (isMyTurn.value) {
        statusText.value = 'A vous de jouer'
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
        statusText.value = 'Fin de partie'
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
  pollInterval = setInterval(async () => {
    await refreshGame()
  }, 1500)
}

const stopGamePolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
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
    statusText.value = result.error ?? 'Impossible d appeler ce roi'
    return
  }

  await refreshGame()
}

const handleRetrieveDog = async () => {
  if (!user.value || !isTaker.value) {
    return
  }

  const result = await retrieveDog(user.value.id, partieId.value)

  if (!result.success) {
    statusText.value = result.error ?? 'Impossible de recuperer le chien'
    return
  }

  await refreshGame()
}

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
  await router.push('/lobby')
}
</script>

<style scoped>
.game-page {
  min-height: 100vh;
  padding: 24px;
  background:
    radial-gradient(circle at top, rgba(237, 214, 154, 0.15), transparent 32%),
    linear-gradient(160deg, #132d21 0%, #0a1913 100%);
}

.game-header {
  max-width: 1560px;
  margin: 0 auto 22px;
  padding: 22px 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  border: 1px solid rgba(231, 210, 155, 0.18);
  border-radius: 18px;
  background: rgba(7, 19, 14, 0.78);
  backdrop-filter: blur(10px);
}

.game-info h1 {
  margin: 0;
  color: #f4ead3;
  font-size: 2rem;
}

.game-info p {
  margin: 6px 0 0;
  color: #d8ccb0;
}

.game-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.status-pill {
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(229, 198, 128, 0.16);
  border: 1px solid rgba(229, 198, 128, 0.22);
  color: #f5e7bd;
  font-weight: 700;
}

.game-layout {
  max-width: 1560px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 22px;
}

.final-summary {
  max-width: 1560px;
  margin: 24px auto 0;
  padding: 24px 26px;
  border-radius: 22px;
  border: 1px solid rgba(231, 210, 155, 0.2);
  background: rgba(7, 19, 14, 0.82);
  color: #efe5ce;
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
  min-height: 800px;
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid rgba(231, 210, 155, 0.18);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.panel {
  padding: 22px;
  border-radius: 18px;
  border: 1px solid rgba(231, 210, 155, 0.18);
  background: rgba(7, 19, 14, 0.78);
  color: #eee5ce;
}

.panel h2 {
  margin: 0 0 14px;
  font-size: 1.2rem;
  color: #f7ebc7;
}

.actions-list {
  display: grid;
  gap: 10px;
}

.phase-help {
  display: grid;
  gap: 12px;
  color: #d9ccb0;
}

.score-list {
  display: grid;
  gap: 10px;
}

.score-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: #e9dec0;
}

.score-row.active {
  border: 1px solid rgba(242, 163, 71, 0.55);
  color: #ffd28d;
}

.btn {
  border: 0;
  border-radius: 12px;
  padding: 12px 16px;
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
  background: rgba(255, 255, 255, 0.12);
  color: #f5ecd5;
}

@media (max-width: 1280px) {
  .game-layout {
    grid-template-columns: 1fr;
  }

  .side-panel {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .panel {
    flex: 1 1 300px;
  }
}

@media (max-width: 900px) {
  .game-page {
    padding: 14px;
  }

  .game-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .game-actions {
    width: 100%;
    justify-content: space-between;
  }

  .final-summary-header {
    flex-direction: column;
  }
}
</style>
