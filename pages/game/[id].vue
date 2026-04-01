<template>
  <div class="game-page">
    <div class="game-header">
      <div class="game-info">
        <h2>Partie #{{ partieId }}</h2>
        <span class="player-name">{{ user?.pseudo }} (Joueur {{ playerNum }})</span>
      </div>
      <div class="game-status">
        <span class="status-text">{{ statusText }}</span>
        <button @click="handleLeaveGame" class="btn btn-secondary">Quitter</button>
      </div>
    </div>

    <div class="game-container">
      <!-- Zone Phaser.js -->
      <div id="phaser-game" class="phaser-container"></div>

      <!-- Panneau de contrôle -->
      <div class="control-panel">
        <!-- Phase d'enchères -->
        <div v-if="gamePhase === 'BIDDING'" class="bidding-panel">
          <h3>Enchères</h3>
          <div class="contract-buttons">
            <button @click="handleContract('PETITE')" class="btn btn-contract">Petite</button>
            <button @click="handleContract('GARDE')" class="btn btn-contract">Garde</button>
            <button @click="handleContract('GARDE_SANS')" class="btn btn-contract">Garde Sans</button>
            <button @click="handleContract('GARDE_CONTRE')" class="btn btn-contract">Garde Contre</button>
            <button @click="handleContract('REFUSE')" class="btn btn-refuse">Passer</button>
          </div>
        </div>

        <!-- Phase d'appel du roi -->
        <div v-if="gamePhase === 'CALLING'" class="calling-panel">
          <h3>Appeler un Roi</h3>
          <div class="king-buttons">
            <button @click="handleCallKing('SPADE')" class="btn btn-king">Roi de Pique</button>
            <button @click="handleCallKing('HEART')" class="btn btn-king">Roi de Cœur</button>
            <button @click="handleCallKing('DIAMOND')" class="btn btn-king">Roi de Carreau</button>
            <button @click="handleCallKing('CLOVER')" class="btn btn-king">Roi de Trèfle</button>
          </div>
        </div>

        <!-- Scores -->
        <div class="scores-panel">
          <h3>Scores</h3>
          <div class="scores-list">
            <div v-for="(player, index) in players" :key="index" class="score-item">
              <span class="player-label">{{ player.pseudo }}</span>
              <span class="score-value">{{ player.score.toFixed(1) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { GameScene } from '~/phaser/scenes/GameScene'
import type { Card, GamePhase } from '~/types'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const { playerHand, playerNum, getPlayerHand, setContract, callKing, playCard, getGameState } = useGame()
const { initGame, destroyGame } = usePhaser()

const partieId = computed(() => parseInt(route.params.id as string))
const gamePhase = ref<GamePhase>('BIDDING')
const statusText = ref('En attente...')
const players = ref<any[]>([])
const currentPliId = ref<number | null>(null)
const cardsPlayed = ref(0)

let gameScene: GameScene | null = null

onMounted(async () => {
  if (!user.value) {
    router.push('/')
    return
  }

  // Charger la main du joueur
  await loadPlayerHand()

  // Initialiser Phaser
  const game = initGame('phaser-game', {
    scene: [GameScene]
  })

  if (game.scene.scenes.length > 0) {
    gameScene = game.scene.scenes[0] as GameScene
    gameScene.scene.start('GameScene', {
      onCardClick: handleCardClick
    })

    // Afficher la main du joueur
    if (playerHand.value.length > 0) {
      gameScene.displayPlayerHand(playerHand.value)
    }
  }

  // Charger l'état du jeu
  await loadGameState()

  // Polling pour les mises à jour
  startGamePolling()
})

onUnmounted(() => {
  destroyGame()
  stopGamePolling()
})

let pollInterval: NodeJS.Timeout | null = null

const startGamePolling = () => {
  pollInterval = setInterval(async () => {
    await loadGameState()
  }, 2000)
}

const stopGamePolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

const loadPlayerHand = async () => {
  if (!user.value) return

  const result = await getPlayerHand(user.value.id, partieId.value)
  if (result.success && gameScene) {
    gameScene.displayPlayerHand(playerHand.value)
  }
}

const loadGameState = async () => {
  const result = await getGameState(partieId.value)
  
  if (result.success && result.data) {
    players.value = result.data.players || []
    
    // Déterminer la phase du jeu
    if (result.data.taker) {
      if (result.data.currentPli) {
        gamePhase.value = 'PLAYING'
        currentPliId.value = result.data.currentPli.id
      } else {
        gamePhase.value = 'CALLING'
      }
    } else {
      gamePhase.value = 'BIDDING'
    }

    updateStatusText()
  }
}

const updateStatusText = () => {
  switch (gamePhase.value) {
    case 'BIDDING':
      statusText.value = 'Phase d\'enchères'
      break
    case 'CALLING':
      statusText.value = 'Appel du Roi'
      break
    case 'PLAYING':
      statusText.value = 'Partie en cours'
      break
    default:
      statusText.value = 'En attente...'
  }
}

const handleContract = async (contract: string) => {
  if (!user.value) return

  const result = await setContract(user.value.id, partieId.value, contract as any)
  
  if (result.success) {
    await loadGameState()
  }
}

const handleCallKing = async (color: string) => {
  // Trouver l'ID de la carte du roi de la couleur demandée
  const kingValue = '14'
  const cards = await $fetch('/api/game/cards')
  
  if (cards.success) {
    const kingCard = cards.cards.find((c: Card) => 
      c.valeur === kingValue && c.couleur.toUpperCase().includes(color)
    )
    
    if (kingCard) {
      const result = await callKing(partieId.value, kingCard.id)
      
      if (result.success) {
        gamePhase.value = 'PLAYING'
        // Créer un nouveau pli
        const pliResult = await $fetch('/api/game/create-pli', {
          method: 'POST',
          body: { partieId: partieId.value }
        })
        
        if (pliResult.success) {
          currentPliId.value = pliResult.pliId
        }
      }
    }
  }
}

const handleCardClick = async (card: Card) => {
  if (!user.value || !currentPliId.value) return

  cardsPlayed.value++
  const position = cardsPlayed.value

  const result = await playCard(user.value.id, partieId.value, card.id, currentPliId.value, position)
  
  if (result.success && gameScene) {
    // Mettre à jour l'affichage
    gameScene.displayPlayerHand(playerHand.value)
    
    // Si 5 cartes ont été jouées, créer un nouveau pli
    if (cardsPlayed.value >= 5) {
      cardsPlayed.value = 0
      gameScene.clearCenterCards()
      
      // Créer un nouveau pli
      const pliResult = await $fetch('/api/game/create-pli', {
        method: 'POST',
        body: { partieId: partieId.value }
      })
      
      if (pliResult.success) {
        currentPliId.value = pliResult.pliId
      }
    }
  }
}

const handleLeaveGame = () => {
  router.push('/lobby')
}
</script>

<style scoped>
.game-page {
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
}

.game-header {
  max-width: 1400px;
  margin: 0 auto 20px;
  background: white;
  border-radius: 12px;
  padding: 20px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.game-info h2 {
  margin: 0 0 5px 0;
  color: #2d5016;
}

.player-name {
  color: #666;
  font-size: 0.9rem;
}

.game-status {
  display: flex;
  align-items: center;
  gap: 20px;
}

.status-text {
  color: #2d5016;
  font-weight: 600;
  font-size: 1.1rem;
}

.game-container {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 20px;
}

.phaser-container {
  background: #2d5016;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  min-height: 800px;
}

.control-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.bidding-panel,
.calling-panel,
.scores-panel {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.bidding-panel h3,
.calling-panel h3,
.scores-panel h3 {
  margin: 0 0 15px 0;
  color: #2d5016;
}

.contract-buttons,
.king-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn {
  padding: 12px 20px;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-contract {
  background: #2d5016;
  color: white;
}

.btn-contract:hover {
  background: #1f3810;
  transform: translateX(5px);
}

.btn-refuse {
  background: #dc3545;
  color: white;
}

.btn-refuse:hover {
  background: #c82333;
}

.btn-king {
  background: #ffc107;
  color: #333;
}

.btn-king:hover {
  background: #e0a800;
  transform: translateX(5px);
}

.btn-secondary {
  background: #666;
  color: white;
  padding: 10px 20px;
}

.btn-secondary:hover {
  background: #444;
}

.scores-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.score-item {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
}

.player-label {
  color: #333;
  font-weight: 500;
}

.score-value {
  color: #2d5016;
  font-weight: 700;
}

@media (max-width: 1200px) {
  .game-container {
    grid-template-columns: 1fr;
  }
  
  .control-panel {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .bidding-panel,
  .calling-panel,
  .scores-panel {
    flex: 1;
    min-width: 250px;
  }
}
</style>
