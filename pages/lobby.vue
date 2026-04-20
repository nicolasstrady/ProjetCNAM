<template>
  <div class="lobby-page">
    <div class="lobby-shell">
      <header class="lobby-header">
        <div class="header-copy">
          <p class="eyebrow">Lobby</p>
          <h1>Salons de tarot</h1>
          <p class="subtitle">
            Crée une table, rejoins avec un code ou lance une recherche rapide.
          </p>
        </div>

        <div class="user-panel">
          <div>
            <p class="user-label">Connecté</p>
            <p class="user-name">{{ user?.pseudo }}</p>
          </div>
          <button class="btn btn-secondary" @click="handleLogout">Déconnexion</button>
        </div>
      </header>

      <main class="lobby-grid">
        <section class="panel panel-create">
          <div class="panel-head">
            <div>
              <p class="section-kicker">Créer</p>
              <h2>Nouveau salon</h2>
            </div>
          </div>

          <div class="create-body">
            <div class="preset-grid">
              <button
                v-for="preset in roomPresets"
                :key="preset.id"
                class="preset-card"
                :class="{ 'preset-card-active': createPreset === preset.id }"
                @click="createPreset = preset.id"
              >
                <strong>{{ preset.label }}</strong>
                <span>{{ preset.cardDescription }}</span>
              </button>
            </div>

            <div class="preset-summary">
              <p>{{ selectedPreset.description }}</p>
            </div>

            <button
              class="btn btn-primary btn-full"
              :disabled="Boolean(activeRoom) || loadingState === 'create'"
              @click="handleCreateRoom"
            >
              {{ loadingState === 'create' ? 'Création...' : `Créer un salon ${selectedPreset.shortLabel}` }}
            </button>
          </div>
        </section>

        <section class="panel panel-actions">
          <div class="panel-head">
            <div>
              <p class="section-kicker">Jouer</p>
              <h2>Actions rapides</h2>
            </div>
          </div>

          <div class="action-stack">
            <div class="compact-box">
              <div>
                <p class="section-kicker">Recherche rapide</p>
                <h3>Table disponible</h3>
                <p>Rejoins une table publique ou crée-en une automatiquement.</p>
              </div>

              <button
                class="btn btn-accent"
                :disabled="Boolean(activeRoom) || loadingState === 'quick'"
                @click="handleQuickMatch"
              >
                {{ loadingState === 'quick' ? 'Recherche...' : 'Recherche rapide' }}
              </button>
            </div>

            <div class="compact-box">
              <div>
                <p class="section-kicker">Code</p>
                <h3>Rejoindre un ami</h3>
              </div>
              <div class="join-form">
                <input
                  v-model="roomCode"
                  type="text"
                  maxlength="12"
                  placeholder="Ex: AB12CD"
                  class="game-input"
                />
                <button
                  class="btn btn-primary"
                  :disabled="Boolean(activeRoom) || loadingState === 'join' || !roomCode.trim()"
                  @click="handleJoinByCode"
                >
                  Rejoindre
                </button>
              </div>
            </div>

            <div class="modal-shortcuts">
              <button
                class="shortcut-card"
                :class="{ 'shortcut-card-active': activeRoom }"
                @click="showActiveRoomModal = true"
              >
                <span>Salon en cours</span>
                <strong>{{ activeRoom ? `#${activeRoom.id} - ${activeRoom.playerCount}/5` : 'Aucun salon' }}</strong>
              </button>

              <button class="shortcut-card" @click="openPublicRoomsModal">
                <span>Tables ouvertes</span>
                <strong>{{ publicRooms.length }} disponible(s)</strong>
              </button>
            </div>
          </div>
        </section>
      </main>

      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showActiveRoomModal" class="modal-backdrop" @click.self="showActiveRoomModal = false">
        <section class="modal-card">
          <div class="modal-head">
            <div>
              <p class="section-kicker">Salon actif</p>
              <h2>{{ activeRoom ? `Salon #${activeRoom.id}` : 'Aucun salon en cours' }}</h2>
            </div>
            <button class="modal-close" @click="showActiveRoomModal = false">Fermer</button>
          </div>

          <div v-if="activeRoom" class="active-room">
            <span
              class="status-badge"
              :class="{
                'status-waiting': activeRoom.status === 'WAITING',
                'status-playing': activeRoom.status === 'PLAYING',
                'status-finished': activeRoom.status === 'FINISHED'
              }"
            >
              {{ formatRoomStatus(activeRoom.status) }}
            </span>

            <div class="room-meta-grid">
              <div class="meta-card">
                <span class="meta-label">Accès</span>
                <strong>{{ formatVisibility(activeRoom.visibility, activeRoom.allowQuickJoin) }}</strong>
              </div>
              <div class="meta-card">
                <span class="meta-label">Code</span>
                <strong>{{ activeRoom.code || 'Aucun code' }}</strong>
              </div>
              <div class="meta-card">
                <span class="meta-label">Places</span>
                <strong>{{ activeRoom.playerCount }} / 5</strong>
              </div>
            </div>

            <div class="players-block">
              <div class="players-head">
                <h3>Joueurs inscrits</h3>
                <p v-if="activeRoom.openSlots > 0">{{ activeRoom.openSlots }} place(s) restante(s)</p>
              </div>

              <div class="player-list">
                <div
                  v-for="player in activeRoom.players"
                  :key="`${activeRoom.id}-${player.playerNum}`"
                  class="player-pill"
                  :class="{ 'player-pill-self': player.userId === user?.id }"
                >
                  <span class="player-num">J{{ player.playerNum }}</span>
                  <span>{{ player.pseudo }}</span>
                  <span v-if="player.playerType === 'BOT'" class="bot-chip">IA</span>
                </div>
              </div>
            </div>

            <div class="room-actions">
              <button
                v-if="activeRoom.status === 'PLAYING'"
                class="btn btn-primary"
                @click="router.push(`/game/${activeRoom.id}`)"
              >
                Reprendre la partie
              </button>

              <button
                v-else
                class="btn btn-success"
                :disabled="loadingState === 'start' || (activeRoom.playerCount !== 5 && !activeRoom.fillWithBots)"
                @click="handleStartGame"
              >
                {{
                  loadingState === 'start'
                    ? 'Lancement...'
                    : activeRoom.playerCount < 5 && activeRoom.fillWithBots
                      ? 'Lancer avec IA'
                      : 'Lancer la partie'
                }}
              </button>

              <button
                v-if="activeRoom.status === 'WAITING' && activeRoom.openSlots > 0"
                class="btn btn-secondary"
                :disabled="loadingState === 'fill-bots'"
                @click="handleFillBots"
              >
                {{ loadingState === 'fill-bots' ? 'Ajout...' : 'Ajouter IA' }}
              </button>

              <button
                class="btn btn-secondary"
                :disabled="loadingState === 'leave'"
                @click="handleLeaveActiveRoom"
              >
                {{
                  loadingState === 'leave'
                    ? 'Sortie...'
                    : activeRoom.status === 'PLAYING'
                      ? 'Clore la partie'
                      : 'Quitter le salon'
                }}
              </button>
            </div>
          </div>

          <div v-else class="empty-room">
            <p>Aucun salon actif pour le moment.</p>
            <p>Crée une table ou rejoins une partie.</p>
          </div>
        </section>
      </div>

      <div v-if="showPublicRoomsModal" class="modal-backdrop" @click.self="showPublicRoomsModal = false">
        <section class="modal-card modal-card-wide">
          <div class="modal-head">
            <div>
              <p class="section-kicker">Salons publics</p>
              <h2>Tables ouvertes</h2>
            </div>
            <div class="modal-head-actions">
              <button class="btn btn-ghost" :disabled="loadingRooms" @click="loadLobbyData">
                {{ loadingRooms ? 'Actualisation...' : 'Actualiser' }}
              </button>
              <button class="modal-close" @click="showPublicRoomsModal = false">Fermer</button>
            </div>
          </div>

          <div v-if="publicRooms.length === 0" class="empty-public">
            <p>Aucun salon public en attente pour le moment.</p>
            <p>La recherche rapide en créera un si besoin.</p>
          </div>

          <div v-else class="public-room-list">
            <article v-for="room in publicRooms" :key="room.id" class="public-room-card">
              <div class="public-room-top">
                <div>
                  <h3>Salon #{{ room.id }}</h3>
                  <p>{{ formatVisibility(room.visibility, room.allowQuickJoin) }} - {{ room.playerCount }}/5 joueurs</p>
                </div>
                <span class="room-code">{{ room.code }}</span>
              </div>

              <div class="public-room-tags">
                <span class="tag">{{ formatVisibility(room.visibility, room.allowQuickJoin) }}</span>
                <span class="tag">{{ room.openSlots }} place(s) libre(s)</span>
              </div>

              <div class="player-list compact">
                <div
                  v-for="player in room.players"
                  :key="`${room.id}-${player.playerNum}`"
                  class="player-pill"
                >
                  <span class="player-num">J{{ player.playerNum }}</span>
                  <span>{{ player.pseudo }}</span>
                  <span v-if="player.playerType === 'BOT'" class="bot-chip">IA</span>
                </div>
              </div>

              <button
                class="btn btn-primary"
                :disabled="Boolean(activeRoom) || loadingState === `public-${room.id}`"
                @click="handleJoinPublicRoom(room.id)"
              >
                {{ loadingState === `public-${room.id}` ? 'Connexion...' : 'Rejoindre' }}
              </button>
            </article>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { CreateRoomOptions, LobbyRoomSummary } from '~/types'

type PresetId = 'PRIVATE' | 'PUBLIC'
type LoadingState = '' | 'create' | 'join' | 'quick' | 'start' | 'leave' | 'fill-bots' | `public-${number}`

const { user, logout, restoreSession } = useAuth()
const { createGame, joinGame, quickMatch, listRooms, dealCards, fillBots, leaveGame } = useGame()
const router = useRouter()

const roomPresets: Array<{
  id: PresetId
  label: string
  shortLabel: string
  cardDescription: string
  description: string
  options: CreateRoomOptions
}> = [
  {
    id: 'PRIVATE',
    label: 'Privé',
    shortLabel: 'privé',
    cardDescription: 'Code uniquement',
    description: 'Salon réservé à tes invités. On entre uniquement avec le code partagé.',
    options: {
      visibility: 'PRIVATE',
      allowQuickJoin: false,
      fillWithBots: false,
      mode: 'CLASSIC'
    }
  },
  {
    id: 'PUBLIC',
    label: 'Public',
    shortLabel: 'public',
    cardDescription: 'Visible par tous',
    description: 'Salon visible dans les tables ouvertes et accessible par recherche rapide.',
    options: {
      visibility: 'PUBLIC',
      allowQuickJoin: true,
      fillWithBots: false,
      mode: 'CLASSIC'
    }
  }
]

const loadingState = ref<LoadingState>('')
const loadingRooms = ref(false)
const errorMessage = ref('')
const roomCode = ref('')
const createPreset = ref<PresetId>('PRIVATE')
const activeRoom = ref<LobbyRoomSummary | null>(null)
const publicRooms = ref<LobbyRoomSummary[]>([])
const showActiveRoomModal = ref(false)
const showPublicRoomsModal = ref(false)

const selectedPreset = computed(() => {
  return roomPresets.find((preset) => preset.id === createPreset.value) ?? roomPresets[0]
})

async function loadLobbyData() {
  if (!user.value) {
    return
  }

  loadingRooms.value = true

  try {
    const result = await listRooms(user.value.id)

    if (!result.success) {
      errorMessage.value = result.error || 'Impossible de récupérer les salons'
      return
    }

    errorMessage.value = ''
    activeRoom.value = result.activeRoom
    publicRooms.value = result.publicRooms

    if (result.activeRoom?.status === 'PLAYING') {
      await router.push(`/game/${result.activeRoom.id}`)
    }
  } catch (error: any) {
    errorMessage.value = error?.data?.message || 'Impossible de récupérer les salons'
  } finally {
    loadingRooms.value = false
  }
}

const openPublicRoomsModal = () => {
  showPublicRoomsModal.value = true
  void loadLobbyData()
}

let pollInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await restoreSession()

  if (!user.value) {
    await router.push('/')
    return
  }

  await loadLobbyData()

  pollInterval = setInterval(() => {
    void loadLobbyData()
  }, 2500)
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})

const handleCreateRoom = async () => {
  if (!user.value || activeRoom.value) {
    return
  }

  loadingState.value = 'create'
  errorMessage.value = ''

  const result = await createGame(user.value.id, selectedPreset.value.options)

  if (result.success) {
    roomCode.value = result.room?.code || ''
    await loadLobbyData()
    showActiveRoomModal.value = true
  } else {
    errorMessage.value = result.error || 'Erreur de création du salon'
  }

  loadingState.value = ''
}

const handleJoinByCode = async () => {
  if (!user.value || activeRoom.value || !roomCode.value.trim()) {
    return
  }

  loadingState.value = 'join'
  errorMessage.value = ''

  const result = await joinGame(user.value.id, { code: roomCode.value.trim().toUpperCase() })

  if (result.success) {
    await loadLobbyData()
    showActiveRoomModal.value = true
  } else {
    errorMessage.value = result.error || 'Erreur de connexion au salon'
  }

  loadingState.value = ''
}

const handleJoinPublicRoom = async (partieId: number) => {
  if (!user.value || activeRoom.value) {
    return
  }

  loadingState.value = `public-${partieId}`
  errorMessage.value = ''

  const result = await joinGame(user.value.id, { partieId })

  if (result.success) {
    await loadLobbyData()
    showPublicRoomsModal.value = false
    showActiveRoomModal.value = true
  } else {
    errorMessage.value = result.error || 'Erreur de connexion au salon'
  }

  loadingState.value = ''
}

const handleQuickMatch = async () => {
  if (!user.value || activeRoom.value) {
    return
  }

  loadingState.value = 'quick'
  errorMessage.value = ''

  const result = await quickMatch(user.value.id)

  if (result.success) {
    roomCode.value = result.room?.code || ''
    await loadLobbyData()
    showActiveRoomModal.value = true
  } else {
    errorMessage.value = result.error || 'Erreur de recherche rapide'
  }

  loadingState.value = ''
}

const handleStartGame = async () => {
  if (!activeRoom.value) {
    return
  }

  loadingState.value = 'start'
  errorMessage.value = ''

  const result = await dealCards(activeRoom.value.id)

  if (result.success) {
    await router.push(`/game/${activeRoom.value.id}`)
  } else {
    errorMessage.value = result.error || 'Erreur de lancement'
  }

  loadingState.value = ''
}

const handleFillBots = async () => {
  if (!user.value || !activeRoom.value || activeRoom.value.openSlots === 0) {
    return
  }

  loadingState.value = 'fill-bots'
  errorMessage.value = ''

  const result = await fillBots(user.value.id, activeRoom.value.id)

  if (!result.success) {
    errorMessage.value = result.error || 'Impossible d’ajouter des IA'
    loadingState.value = ''
    return
  }

  await loadLobbyData()
  loadingState.value = ''
}

const handleLeaveActiveRoom = async () => {
  if (!user.value || !activeRoom.value) {
    return
  }

  loadingState.value = 'leave'
  errorMessage.value = ''

  const result = await leaveGame(user.value.id, activeRoom.value.id)

  if (!result.success) {
    errorMessage.value = result.error || 'Impossible de quitter le salon'
    loadingState.value = ''
    return
  }

  activeRoom.value = null
  showActiveRoomModal.value = false
  await loadLobbyData()
  loadingState.value = ''
}

const handleLogout = async () => {
  await logout()
  await router.push('/')
}

const formatVisibility = (visibility: LobbyRoomSummary['visibility'], allowQuickJoin: boolean) => {
  if (visibility === 'PRIVATE') {
    return 'Privé'
  }

  if (visibility === 'PUBLIC' || allowQuickJoin) {
    return 'Public'
  }

  return 'Privé'
}

const formatRoomStatus = (status: LobbyRoomSummary['status']) => {
  if (status === 'PLAYING') {
    return 'En jeu'
  }

  if (status === 'FINISHED') {
    return 'Terminé'
  }

  return 'En attente'
}
</script>

<style scoped>
.lobby-page {
  height: 100dvh;
  overflow: hidden;
  padding: clamp(10px, 1.6vw, 20px);
  background: #092116;
}

.lobby-shell {
  height: 100%;
  max-width: 1680px;
  margin: 0 auto;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
  position: relative;
}

.lobby-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 18px 22px;
  border-radius: 28px;
  background: rgba(255, 251, 240, 0.92);
  border: 1px solid rgba(98, 66, 27, 0.12);
  box-shadow: 0 20px 60px rgba(58, 40, 12, 0.12);
}

.header-copy {
  min-width: 0;
}

.lobby-header h1 {
  font-size: clamp(1.55rem, 2vw, 2.2rem);
  line-height: 1.05;
}

.eyebrow,
.section-kicker,
.user-label {
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.74rem;
  color: #88653a;
}

.lobby-header h1,
.panel-head h2,
.quick-match h3,
.join-by-code h3,
.public-room-card h3,
.players-head h3 {
  margin: 0;
  color: #1f3a27;
}

.subtitle {
  max-width: 760px;
  margin: 8px 0 0;
  color: #5a5448;
  font-size: 0.95rem;
  line-height: 1.3;
}

.user-panel {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  border-radius: 20px;
  background: rgba(139, 105, 20, 0.1);
}

.user-name {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1f3a27;
}

.lobby-grid {
  min-height: 0;
  display: grid;
  grid-template-areas:
    "active create"
    "active public";
  grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.85fr);
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.panel {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 20px;
  border-radius: 26px;
  background: rgba(255, 251, 240, 0.94);
  border: 1px solid rgba(98, 66, 27, 0.12);
  box-shadow: 0 18px 48px rgba(58, 40, 12, 0.08);
}

.panel-primary {
  grid-area: active;
}

.panel-create {
  grid-area: create;
  padding: 18px;
}

.panel-wide {
  grid-area: public;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.panel-create .panel-head {
  margin-bottom: 10px;
}

.panel-head h2 {
  font-size: clamp(1.05rem, 1.2vw, 1.35rem);
}

.status-badge,
.tag,
.room-code {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 0.88rem;
  font-weight: 700;
}

.status-waiting {
  background: rgba(201, 148, 42, 0.16);
  color: #8a5d12;
}

.status-playing {
  background: rgba(139, 105, 20, 0.14);
  color: #8b6914;
}

.status-finished {
  background: rgba(89, 89, 89, 0.14);
  color: #555;
}

.room-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.active-room {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.meta-card {
  padding: 14px 16px;
  border-radius: 18px;
  background: #f9f2df;
  border: 1px solid rgba(98, 66, 27, 0.1);
}

.meta-label {
  display: block;
  margin-bottom: 6px;
  color: #866744;
  font-size: 0.82rem;
}

.players-block {
  margin-top: 18px;
}

.players-head,
.public-room-top,
.quick-match,
.join-form {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.players-head p,
.quick-match p,
.join-by-code p,
.public-room-top p,
.preset-summary p,
.empty-room p,
.empty-public p,
.helper-text {
  margin: 0;
  color: #635c50;
}

.player-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.player-list.compact {
  margin: 14px 0 18px;
}

.player-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 14px;
  background: #fffdf7;
  border: 1px solid rgba(98, 66, 27, 0.14);
}

.player-pill-self {
  background: rgba(139, 105, 20, 0.14);
  border-color: rgba(180, 140, 60, 0.25);
}

.player-num {
  font-size: 0.78rem;
  font-weight: 800;
  color: #8a5d12;
}

.bot-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(127, 29, 29, 0.12);
  color: #7f1d1d;
  font-size: 0.72rem;
  font-weight: 800;
}

  .room-actions {
    margin-top: 16px;
    display: grid;
    gap: 8px;
  }

.room-fill-btn,
.room-leave-btn {
  margin-top: 0;
}

.empty-room,
.empty-public {
  display: grid;
  gap: 10px;
  min-height: 0;
  height: 100%;
  align-content: center;
  text-align: center;
  border-radius: 20px;
  background: rgba(249, 242, 223, 0.75);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.panel-create .preset-grid {
  gap: 10px;
}

  .create-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding-right: 2px;
    display: grid;
    align-content: start;
    gap: 10px;
  }

.preset-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  text-align: left;
  border: 1px solid rgba(98, 66, 27, 0.12);
  border-radius: 18px;
  background: #fffdf7;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.panel-create .preset-card {
  gap: 4px;
  padding: 11px 12px;
  border-radius: 16px;
}

.preset-card:hover {
  transform: translateY(-1px);
  border-color: rgba(180, 140, 60, 0.4);
  box-shadow: 0 10px 24px rgba(139, 105, 20, 0.1);
}

.panel-create .preset-card strong {
  font-size: 0.92rem;
}

.preset-card span {
  color: #655e52;
  font-size: 0.92rem;
}

.panel-create .preset-card span {
  font-size: 0.76rem;
  line-height: 1.2;
}

.preset-card-active {
  border-color: rgba(180, 140, 60, 0.5);
  background: rgba(139, 105, 20, 0.12);
}

.preset-summary {
  display: grid;
  gap: 10px;
  padding: 4px 0 2px;
}

.panel-create .preset-summary {
  gap: 0;
  padding: 0;
  font-size: 0.9rem;
}

.create-tools {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 2px;
}

.join-by-code,
.quick-match {
  display: grid;
  gap: 14px;
}

  .compact-box {
  padding: 12px;
  border-radius: 18px;
  background: rgba(249, 242, 223, 0.7);
  border: 1px solid rgba(98, 66, 27, 0.1);
}

.panel-create .quick-match,
.panel-create .join-by-code {
  gap: 10px;
}

.panel-create .quick-match h3,
.panel-create .join-by-code h3 {
  font-size: 1rem;
}

.panel-create .quick-match p,
.panel-create .join-by-code p {
  font-size: 0.88rem;
  line-height: 1.3;
}

.join-form {
  align-items: stretch;
}

.panel-create .join-form {
  gap: 10px;
}

.game-input {
  flex: 1;
  padding: 14px 16px;
  border: 1px solid rgba(98, 66, 27, 0.18);
  border-radius: 14px;
  font-size: 1rem;
  background: #fffdf7;
  text-transform: uppercase;
}

.panel-create .game-input {
  padding: 12px 14px;
  font-size: 0.95rem;
}

.game-input:focus {
  outline: none;
  border-color: rgba(180, 140, 60, 0.5);
  box-shadow: 0 0 0 3px rgba(139, 105, 20, 0.15);
}

.public-room-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

  .public-room-card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 20px;
  background: #fffdf7;
  border: 1px solid rgba(98, 66, 27, 0.12);
}

.public-room-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag,
.room-code {
  background: #f4ead1;
  color: #6f522e;
}

.btn {
  border: 0;
  border-radius: 16px;
  padding: 11px 16px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
}

.panel-create .btn {
  padding: 11px 14px;
  border-radius: 14px;
  font-size: 0.92rem;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-primary {
  background: #8b6914;
  color: #fff;
  box-shadow: 0 12px 24px rgba(139, 105, 20, 0.25);
}

.btn-secondary,
.btn-ghost {
  background: rgba(98, 66, 27, 0.08);
  color: #4f4331;
}

.btn-success {
  background: #8b6914;
  color: #fff;
  box-shadow: 0 12px 24px rgba(139, 105, 20, 0.25);
}

.btn-accent {
  background: #7f1d1d;
  color: #fff;
  box-shadow: 0 12px 24px rgba(127, 29, 29, 0.16);
}

.btn-full {
  width: 100%;
}

.error-banner {
  margin-top: 0;
  padding: 12px 16px;
  border-radius: 18px;
  background: rgba(127, 29, 29, 0.08);
  border: 1px solid rgba(127, 29, 29, 0.14);
  color: #8b1d1d;
  font-weight: 600;
}

@media (max-width: 1120px) {
  .lobby-header {
    padding: 14px 16px;
    border-radius: 22px;
  }

  .subtitle {
    max-width: 100%;
    font-size: 0.88rem;
  }

  .lobby-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: minmax(0, 1.04fr) minmax(0, 0.96fr);
    grid-template-areas:
      "active active"
      "create public";
  }

  .room-meta-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .lobby-page {
    padding: 8px;
  }

  .lobby-shell {
    gap: 8px;
  }

  .lobby-header {
    padding: 10px 12px;
    border-radius: 18px;
    gap: 10px;
  }

  .players-head,
  .public-room-top,
  .join-form {
    grid-template-columns: 1fr;
    display: grid;
  }

  .eyebrow,
  .subtitle,
  .user-label {
    display: none;
  }

  .lobby-header h1 {
    font-size: 1.05rem;
  }

  .user-panel {
    justify-self: end;
    align-self: stretch;
    gap: 8px;
    padding: 0;
    background: transparent;
    border-radius: 0;
  }

  .user-name {
    font-size: 0.84rem;
    line-height: 1.1;
    text-align: right;
  }

  .lobby-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: minmax(0, 0.84fr) minmax(0, 1.16fr);
    gap: 8px;
  }

  .panel,
  .panel-create {
    padding: 10px;
    border-radius: 16px;
  }

  .panel-head {
    gap: 6px;
    margin-bottom: 8px;
  }

  .panel-head h2 {
    font-size: 0.88rem;
  }

  .section-kicker {
    margin-bottom: 2px;
    font-size: 0.54rem;
    letter-spacing: 0.12em;
  }

  .status-badge,
  .tag,
  .room-code {
    padding: 4px 6px;
    font-size: 0.6rem;
  }

  .room-meta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .meta-card {
    padding: 8px;
    border-radius: 12px;
  }

  .meta-card strong {
    font-size: 0.74rem;
  }

  .meta-label {
    margin-bottom: 2px;
    font-size: 0.58rem;
  }

  .players-head h3,
  .quick-match h3,
  .join-by-code h3,
  .public-room-card h3 {
    font-size: 0.88rem;
  }

  .players-head p,
  .quick-match p,
  .join-by-code p,
  .public-room-top p,
  .preset-summary p,
  .empty-room p,
  .empty-public p,
  .helper-text {
    font-size: 0.66rem;
    line-height: 1.18;
  }

  .players-block {
    margin-top: 10px;
  }

  .player-list {
    gap: 6px;
    margin-top: 8px;
  }

  .player-list.compact {
    margin: 8px 0 10px;
  }

  .player-pill {
    gap: 6px;
    padding: 6px 8px;
    border-radius: 10px;
    font-size: 0.68rem;
  }

  .player-num {
    font-size: 0.58rem;
  }

  .bot-chip {
    padding: 2px 5px;
    font-size: 0.52rem;
  }

  .room-actions {
    margin-top: 10px;
    gap: 6px;
  }

  .preset-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .panel-create .preset-grid {
    gap: 8px;
  }

  .preset-card {
    padding: 8px;
    border-radius: 12px;
  }

  .panel-create .preset-card {
    gap: 3px;
    padding: 7px 8px;
    border-radius: 10px;
  }

  .panel-create .preset-card strong {
    font-size: 0.72rem;
  }

  .panel-create .preset-card span {
    font-size: 0.56rem;
    line-height: 1.08;
  }

  .panel-create .preset-summary {
    font-size: 0.66rem;
  }

  .create-body {
    gap: 8px;
  }

  .create-tools {
    grid-template-columns: 1fr;
    gap: 6px;
    margin-top: 0;
  }

  .compact-box {
    padding: 8px;
    border-radius: 12px;
  }

  .panel-create .quick-match,
  .panel-create .join-by-code {
    gap: 8px;
  }

  .panel-create .quick-match h3,
  .panel-create .join-by-code h3 {
    font-size: 0.78rem;
  }

  .panel-create .quick-match p,
  .panel-create .join-by-code p {
    font-size: 0.62rem;
    line-height: 1.12;
  }

  .game-input,
  .panel-create .game-input {
    min-width: 0;
    padding: 8px 9px;
    border-radius: 9px;
    font-size: 0.72rem;
  }

  .btn,
  .panel-create .btn {
    padding: 7px 9px;
    border-radius: 10px;
    font-size: 0.7rem;
  }

  .public-room-list {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .public-room-card {
    gap: 6px;
    padding: 8px;
    border-radius: 14px;
  }

  .error-banner {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    margin: 0;
    padding: 10px 12px;
    border-radius: 14px;
    font-size: 0.72rem;
    z-index: 5;
  }

  .helper-text,
  .preset-summary,
  .empty-room p:last-child,
  .empty-public p:last-child,
  .panel-create .quick-match p {
    display: none;
  }
}

@media (max-width: 560px) {
  .join-form {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: stretch;
  }

  .public-room-top {
    gap: 6px;
  }

  .public-room-top h3 {
    font-size: 0.76rem;
  }

  .public-room-top p {
    font-size: 0.62rem;
  }

  .user-panel {
    flex-direction: column;
    align-items: flex-end;
  }

  .user-panel .btn {
    align-self: flex-end;
  }

  .public-room-tags {
    gap: 4px;
  }

  .public-room-card .btn {
    width: 100%;
  }
}

@media (max-height: 540px) and (orientation: landscape) {
  .lobby-page {
    padding: 8px;
  }

  .lobby-shell {
    gap: 8px;
  }

  .lobby-header {
    padding: 8px 12px;
    border-radius: 18px;
    gap: 10px;
  }

  .eyebrow,
  .subtitle,
  .user-label {
    display: none;
  }

  .lobby-header h1 {
    font-size: 1rem;
  }

  .user-panel {
    gap: 8px;
    padding: 0;
    background: transparent;
    border-radius: 0;
  }

  .user-name {
    font-size: 0.8rem;
  }

  .lobby-grid {
    grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.94fr) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    grid-template-areas: "active create public";
    gap: 8px;
  }

  .panel,
  .panel-create {
    padding: 10px;
    border-radius: 16px;
  }

  .panel-head {
    gap: 6px;
    margin-bottom: 8px;
  }

  .panel-head h2 {
    font-size: 0.86rem;
  }

  .status-badge,
  .tag,
  .room-code {
    padding: 4px 6px;
    font-size: 0.6rem;
  }

  .room-meta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .meta-card {
    padding: 8px;
    border-radius: 10px;
  }

  .meta-card strong {
    font-size: 0.72rem;
  }

  .meta-label,
  .players-head p,
  .quick-match p,
  .join-by-code p,
  .public-room-top p,
  .preset-summary p,
  .empty-room p,
  .empty-public p,
  .helper-text {
    font-size: 0.62rem;
    line-height: 1.12;
  }

  .player-list {
    gap: 5px;
    margin-top: 7px;
  }

  .player-pill {
    gap: 6px;
    padding: 5px 7px;
    border-radius: 9px;
    font-size: 0.66rem;
  }

  .preset-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .panel-create .preset-card {
    padding: 7px 8px;
    border-radius: 10px;
  }

  .panel-create .preset-card strong {
    font-size: 0.7rem;
  }

  .panel-create .preset-card span {
    font-size: 0.54rem;
  }

  .create-body,
  .create-tools {
    gap: 6px;
  }

  .create-tools {
    grid-template-columns: 1fr;
  }

  .compact-box,
  .public-room-card {
    padding: 8px;
    border-radius: 12px;
  }

  .btn,
  .panel-create .btn {
    padding: 7px 8px;
    border-radius: 9px;
    font-size: 0.68rem;
  }

  .game-input,
  .panel-create .game-input {
    padding: 7px 8px;
    border-radius: 9px;
    font-size: 0.7rem;
  }

  .helper-text,
  .preset-summary,
  .empty-room p:last-child,
  .empty-public p:last-child,
  .panel-create .quick-match p {
    display: none;
  }
}

/* Lobby compact sombre: overrides de l'ancien layout clair. */
.lobby-shell {
  max-width: 1180px;
  gap: clamp(10px, 1.6vw, 18px);
}

.lobby-header,
.panel,
.modal-card {
  color: #f6f0dd;
  background: rgba(28, 31, 28, 0.97);
  border: 1px solid rgba(228, 203, 138, 0.28);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
}

.lobby-header {
  border-radius: 24px;
}

.lobby-grid {
  grid-template-areas: "create actions";
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.86fr);
  grid-template-rows: minmax(0, 1fr);
}

.panel-actions {
  grid-area: actions;
}

.panel-create {
  grid-area: create;
}

.lobby-header h1,
.panel-head h2,
.compact-box h3,
.public-room-card h3,
.players-head h3,
.modal-card h2 {
  color: #fff7dc;
}

.subtitle,
.players-head p,
.compact-box p,
.public-room-top p,
.preset-summary p,
.empty-room p,
.empty-public p,
.helper-text {
  color: rgba(246, 240, 221, 0.72);
}

.eyebrow,
.section-kicker,
.user-label,
.meta-label,
.player-num {
  color: #e4cb8a;
}

.user-panel,
.compact-box,
.preset-card,
.meta-card,
.player-pill,
.public-room-card,
.empty-room,
.empty-public,
.shortcut-card {
  background: rgba(255, 246, 216, 0.07);
  border: 1px solid rgba(228, 203, 138, 0.18);
}

.user-name,
.meta-card strong,
.preset-card strong,
.shortcut-card strong {
  color: #fff7dc;
}

.preset-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.preset-card {
  color: #f6f0dd;
}

.preset-card span,
.shortcut-card span {
  color: rgba(246, 240, 221, 0.68);
}

.preset-card-active {
  background: rgba(228, 203, 138, 0.14);
  border-color: rgba(245, 211, 127, 0.58);
}

.action-stack,
.modal-shortcuts {
  display: grid;
  gap: 12px;
}

.modal-shortcuts {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.shortcut-card {
  display: grid;
  gap: 5px;
  min-height: 92px;
  padding: 16px;
  text-align: left;
  border-radius: 18px;
  cursor: pointer;
}

.shortcut-card-active {
  border-color: rgba(245, 211, 127, 0.62);
  box-shadow: inset 0 0 0 1px rgba(245, 211, 127, 0.16);
}

.join-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
}

.game-input {
  color: #fff7dc;
  background: rgba(4, 14, 10, 0.56);
  border-color: rgba(228, 203, 138, 0.24);
}

.game-input::placeholder {
  color: rgba(246, 240, 221, 0.42);
}

.btn-secondary,
.btn-ghost,
.modal-close {
  color: #fff7dc;
  background: rgba(255, 246, 216, 0.1);
  border: 1px solid rgba(228, 203, 138, 0.18);
}

.tag,
.room-code,
.status-badge {
  background: rgba(255, 246, 216, 0.1);
  color: #f5d37f;
}

.status-playing {
  background: rgba(77, 155, 102, 0.18);
  color: #9be3ad;
}

.status-finished {
  background: rgba(128, 128, 128, 0.18);
  color: #ddd2b7;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: clamp(12px, 3vw, 32px);
  background: rgba(0, 0, 0, 0.66);
  backdrop-filter: blur(8px);
}

.modal-card {
  width: min(720px, 100%);
  max-height: min(760px, calc(100dvh - 24px));
  overflow: auto;
  padding: clamp(18px, 2.4vw, 28px);
  border-radius: 26px;
}

.modal-card-wide {
  width: min(1020px, 100%);
}

.modal-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.modal-head-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.modal-close {
  border-radius: 999px;
  padding: 9px 14px;
  font-weight: 800;
  cursor: pointer;
}

.active-room {
  overflow: visible;
  padding-right: 0;
}

.room-meta-grid {
  margin-top: 14px;
}

.public-room-list {
  overflow: visible;
  padding-right: 0;
}

.error-banner {
  background: rgba(127, 29, 29, 0.72);
  border-color: rgba(255, 190, 160, 0.28);
  color: #ffe9de;
}

@media (max-width: 820px) {
  .lobby-grid {
    grid-template-areas:
      "create"
      "actions";
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .lobby-header {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .modal-shortcuts,
  .join-form {
    grid-template-columns: 1fr;
  }

  .modal-card {
    border-radius: 20px;
    padding: 14px;
  }

  .modal-head,
  .modal-head-actions {
    display: grid;
    grid-template-columns: 1fr;
  }
}

@media (max-height: 540px) and (orientation: landscape) {
  .lobby-grid {
    grid-template-areas: "create actions";
    grid-template-columns: minmax(0, 1fr) minmax(300px, 0.9fr);
    grid-template-rows: minmax(0, 1fr);
  }

  .modal-card {
    max-height: calc(100dvh - 16px);
    padding: 12px;
  }
}

/* Finition lobby: cartes plus sombres et alignements moins étirés. */
.lobby-page {
  background: #07150e;
}

.lobby-shell {
  max-width: 1240px;
  grid-template-rows: auto auto minmax(0, 1fr);
}

.lobby-grid {
  align-items: start;
  gap: clamp(12px, 1.7vw, 20px);
}

.lobby-header,
.panel,
.modal-card {
  background: rgba(32, 34, 31, 0.97);
  border-color: rgba(226, 203, 145, 0.28);
}

.lobby-header {
  min-height: 112px;
  align-items: center;
}

.header-copy {
  display: grid;
  gap: 8px;
}

.subtitle {
  max-width: 620px;
}

.panel {
  align-self: start;
  min-height: 0;
  height: auto;
  padding: clamp(18px, 2vw, 24px);
}

.panel-head {
  margin-bottom: 16px;
}

.panel-head h2,
.compact-box h3 {
  letter-spacing: -0.02em;
}

.create-body,
.action-stack {
  gap: 14px;
}

.panel-create {
  min-height: 260px;
}

.panel-actions {
  min-height: 0;
}

.preset-summary {
  min-height: 24px;
}

.user-panel,
.compact-box,
.preset-card,
.meta-card,
.player-pill,
.public-room-card,
.empty-room,
.empty-public,
.shortcut-card {
  background: rgba(12, 30, 20, 0.92);
  border-color: rgba(226, 203, 145, 0.18);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 205, 0.06),
    0 10px 24px rgba(0, 0, 0, 0.18);
}

.preset-card,
.shortcut-card {
  transition:
    transform 140ms ease,
    border-color 140ms ease,
    background 140ms ease;
}

.preset-card:hover,
.shortcut-card:hover {
  transform: translateY(-1px);
  border-color: rgba(241, 211, 139, 0.5);
}

.preset-card-active {
  background: rgba(90, 62, 12, 0.55);
  border-color: rgba(246, 214, 137, 0.72);
  box-shadow:
    inset 0 0 0 1px rgba(246, 214, 137, 0.18),
    0 12px 28px rgba(0, 0, 0, 0.22);
}

.preset-card strong,
.shortcut-card strong,
.compact-box h3 {
  color: #fff4cf;
}

.preset-card span,
.shortcut-card span,
.compact-box p {
  color: rgba(243, 232, 198, 0.72);
}

.compact-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 18px;
}

.compact-box .section-kicker {
  margin-bottom: 8px;
}

.compact-box .btn {
  align-self: center;
  white-space: nowrap;
}

.join-form {
  align-items: center;
  gap: 10px;
}

.game-input {
  min-height: 46px;
  background: rgba(16, 18, 16, 0.88);
  border-color: rgba(226, 203, 145, 0.2);
  box-shadow: inset 0 1px 8px rgba(0, 0, 0, 0.34);
}

.btn {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.btn-primary,
.btn-success {
  background: #8b6914;
}

.btn-accent {
  background: #8c2222;
}

.btn-secondary,
.btn-ghost,
.modal-close {
  background: rgba(52, 54, 48, 0.95);
}

.modal-shortcuts {
  gap: 12px;
}

.shortcut-card {
  min-height: 86px;
  align-content: center;
}

.shortcut-card-active {
  background: rgba(90, 62, 12, 0.55);
  border-color: rgba(246, 214, 137, 0.72);
}

.room-meta-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.public-room-card {
  align-items: stretch;
}

@media (max-width: 820px) {
  .lobby-shell {
    grid-template-rows: auto minmax(0, 1fr) auto;
  }

  .lobby-header {
    min-height: 0;
  }

  .panel-create {
    min-height: 0;
  }

  .compact-box {
    grid-template-columns: 1fr;
  }
}

@media (max-height: 540px) and (orientation: landscape) {
  .lobby-shell {
    max-width: 1180px;
  }

  .lobby-header {
    min-height: 0;
  }

  .panel {
    padding: 12px;
  }

  .compact-box {
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 10px;
    gap: 10px;
  }

  .shortcut-card {
    min-height: 68px;
  }
}
</style>
