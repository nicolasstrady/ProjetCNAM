<template>
  <div class="lobby-page">
    <div class="lobby-container">
      <div class="lobby-header">
        <h1>Lobby - Jeu de Tarot</h1>
        <div class="user-info">
          <span>Bienvenue, {{ user?.pseudo }}</span>
          <button @click="handleLogout" class="btn btn-secondary">Déconnexion</button>
        </div>
      </div>

      <div class="lobby-content">
        <div class="game-section">
          <h2>Rejoindre une partie</h2>
          
          <div v-if="!currentGame" class="game-actions">
            <button @click="handleCreateGame" class="btn btn-primary" :disabled="loading">
              Créer une nouvelle partie
            </button>
            
            <div class="join-section">
              <input
                v-model="gameIdToJoin"
                type="number"
                placeholder="ID de la partie"
                class="game-input"
              />
              <button @click="handleJoinGame" class="btn btn-primary" :disabled="loading || !gameIdToJoin">
                Rejoindre
              </button>
            </div>
          </div>

          <div v-else class="current-game">
            <h3>Partie #{{ currentGame }}</h3>
            <p>Joueurs: {{ playersCount }} / 5</p>
            
            <div v-if="playersCount === 5" class="game-ready">
              <p class="ready-text">✓ Tous les joueurs sont prêts !</p>
              <button @click="handleStartGame" class="btn btn-success">
                Commencer la partie
              </button>
            </div>
            <div v-else class="waiting">
              <p>En attente de {{ 5 - playersCount }} joueur(s)...</p>
              <div class="loading-spinner"></div>
            </div>
          </div>
        </div>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { user, logout } = useAuth()
const { createGame, joinGame, dealCards } = useGame()
const router = useRouter()

const loading = ref(false)
const errorMessage = ref('')
const gameIdToJoin = ref<number | null>(null)
const currentGame = ref<number | null>(null)
const playersCount = ref(0)

// Vérifier l'authentification
onMounted(() => {
  if (!user.value) {
    router.push('/')
  }
})

// Polling pour vérifier le nombre de joueurs
let pollInterval: NodeJS.Timeout | null = null

watch(currentGame, (gameId) => {
  if (gameId) {
    pollInterval = setInterval(async () => {
      await checkPlayersCount()
    }, 2000)
  } else {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})

const checkPlayersCount = async () => {
  if (!currentGame.value) return
  
  try {
    const result = await $fetch(`/api/game/state?partieId=${currentGame.value}`)
    if (result.success && result.players) {
      playersCount.value = result.players.length
    }
  } catch (error) {
    console.error('Erreur lors de la vérification des joueurs:', error)
  }
}

const handleCreateGame = async () => {
  loading.value = true
  errorMessage.value = ''
  
  const result = await createGame()
  
  if (result.success && result.partieId) {
    currentGame.value = result.partieId
    
    // Rejoindre automatiquement la partie créée
    if (user.value) {
      const joinResult = await joinGame(user.value.id, result.partieId)
      if (joinResult.success) {
        playersCount.value = 1
      }
    }
  } else {
    errorMessage.value = result.error || 'Erreur lors de la création de la partie'
  }
  
  loading.value = false
}

const handleJoinGame = async () => {
  if (!gameIdToJoin.value || !user.value) return
  
  loading.value = true
  errorMessage.value = ''
  
  const result = await joinGame(user.value.id, gameIdToJoin.value)
  
  if (result.success) {
    currentGame.value = gameIdToJoin.value
    await checkPlayersCount()
  } else {
    errorMessage.value = result.error || 'Erreur lors de la connexion à la partie'
  }
  
  loading.value = false
}

const handleStartGame = async () => {
  if (!currentGame.value) return
  
  loading.value = true
  errorMessage.value = ''
  
  // Distribuer les cartes
  const result = await dealCards(currentGame.value)
  
  if (result.success) {
    // Rediriger vers la page de jeu
    router.push(`/game/${currentGame.value}`)
  } else {
    errorMessage.value = result.error || 'Erreur lors du démarrage de la partie'
  }
  
  loading.value = false
}

const handleLogout = () => {
  logout()
  router.push('/')
}
</script>

<style scoped>
.lobby-page {
  min-height: 100vh;
  padding: 20px;
}

.lobby-container {
  max-width: 1200px;
  margin: 0 auto;
}

.lobby-header {
  background: white;
  border-radius: 12px;
  padding: 30px;
  margin-bottom: 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.lobby-header h1 {
  color: #2d5016;
  margin: 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-info span {
  color: #555;
  font-weight: 500;
}

.lobby-content {
  background: white;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.game-section h2 {
  color: #333;
  margin-bottom: 30px;
}

.game-actions {
  display: flex;
  flex-direction: column;
  gap: 30px;
  max-width: 500px;
}

.join-section {
  display: flex;
  gap: 10px;
}

.game-input {
  flex: 1;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.game-input:focus {
  outline: none;
  border-color: #2d5016;
}

.btn {
  padding: 14px 28px;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: #2d5016;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1f3810;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(45, 80, 22, 0.3);
}

.btn-secondary {
  background: #666;
  color: white;
}

.btn-secondary:hover {
  background: #444;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #218838;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.current-game {
  padding: 30px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 2px solid #2d5016;
}

.current-game h3 {
  color: #2d5016;
  margin-bottom: 15px;
}

.current-game p {
  color: #555;
  font-size: 1.1rem;
  margin-bottom: 20px;
}

.game-ready {
  text-align: center;
}

.ready-text {
  color: #28a745;
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 20px;
}

.waiting {
  text-align: center;
}

.waiting p {
  color: #666;
  margin-bottom: 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #2d5016;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  margin-top: 20px;
  padding: 12px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 6px;
  color: #c33;
  text-align: center;
}
</style>
