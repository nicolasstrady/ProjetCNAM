<template>
  <div class="lobby-page">
    <div class="lobby-shell">
      <header class="lobby-header">
        <div>
          <p class="eyebrow">Lobby</p>
          <h1>Salons de tarot</h1>
          <p class="subtitle">
            Creer une table privee, ouvrir une partie publique ou lancer une recherche rapide.
          </p>
        </div>

        <div class="user-panel">
          <div>
            <p class="user-label">Connecte en tant que</p>
            <p class="user-name">{{ user?.pseudo }}</p>
          </div>
          <button class="btn btn-secondary" @click="handleLogout">Deconnexion</button>
        </div>
      </header>

      <main class="lobby-grid">
        <section class="panel panel-primary">
          <div class="panel-head">
            <div>
              <p class="section-kicker">Salon actif</p>
              <h2>{{ activeRoom ? `Salon #${activeRoom.id}` : 'Aucun salon en cours' }}</h2>
            </div>
            <span v-if="activeRoom" class="status-badge" :class="`status-${activeRoom.status.toLowerCase()}`">
              {{ formatRoomStatus(activeRoom.status) }}
            </span>
          </div>

          <div v-if="activeRoom" class="active-room">
            <div class="room-meta-grid">
              <div class="meta-card">
                <span class="meta-label">Acces</span>
                <strong>{{ formatVisibility(activeRoom.visibility, activeRoom.allowQuickJoin) }}</strong>
              </div>
              <div class="meta-card">
                <span class="meta-label">Code</span>
                <strong>{{ activeRoom.code || 'Aucun code' }}</strong>
              </div>
              <div class="meta-card">
                <span class="meta-label">Mode</span>
                <strong>{{ formatMode(activeRoom.mode) }}</strong>
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
                      ? 'Completer avec des bots et lancer'
                      : 'Lancer la partie'
                }}
              </button>

              <button
                v-if="activeRoom.status === 'WAITING' && activeRoom.openSlots > 0"
                class="btn btn-secondary room-fill-btn"
                :disabled="loadingState === 'fill-bots'"
                @click="handleFillBots"
              >
                {{ loadingState === 'fill-bots' ? 'Ajout des bots...' : 'Ajouter des bots' }}
              </button>

              <button
                class="btn btn-secondary room-leave-btn"
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

              <p class="helper-text">
                Le salon actif bloque la creation ou la jointure d un autre salon tant qu il est en attente ou en jeu.
              </p>
            </div>
          </div>

          <div v-else class="empty-room">
            <p>Aucun salon actif pour le moment.</p>
            <p>Choisis un mode ci-contre pour creer ou rejoindre une partie.</p>
          </div>
        </section>

        <section class="panel panel-create">
          <div class="panel-head">
            <div>
              <p class="section-kicker">Creer</p>
              <h2>Nouveau salon</h2>
            </div>
          </div>

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
            {{ loadingState === 'create' ? 'Creation...' : `Creer un salon ${selectedPreset.shortLabel}` }}
          </button>

          <div class="create-tools">
            <div class="quick-match compact-box">
              <div>
                <p class="section-kicker">Recherche rapide</p>
                <h3>Table dispo</h3>
                <p>Rejoint une table ouverte ou en cree une.</p>
              </div>

              <button
                class="btn btn-accent"
                :disabled="Boolean(activeRoom) || loadingState === 'quick'"
                @click="handleQuickMatch"
              >
                {{ loadingState === 'quick' ? 'Recherche...' : 'Recherche rapide' }}
              </button>
            </div>

            <div class="join-by-code compact-box">
              <div>
                <p class="section-kicker">Code</p>
                <h3>Rejoindre</h3>
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
          </div>
        </section>

        <section class="panel panel-wide">
          <div class="panel-head">
            <div>
              <p class="section-kicker">Salons publics</p>
              <h2>Tables ouvertes</h2>
            </div>
            <button class="btn btn-ghost" :disabled="loadingRooms" @click="loadLobbyData">
              {{ loadingRooms ? 'Actualisation...' : 'Actualiser' }}
            </button>
          </div>

          <div v-if="publicRooms.length === 0" class="empty-public">
            <p>Aucun salon public en attente pour le moment.</p>
            <p>La recherche rapide en creera un automatiquement si besoin.</p>
          </div>

          <div v-else class="public-room-list">
            <article v-for="room in publicRooms" :key="room.id" class="public-room-card">
              <div class="public-room-top">
                <div>
                  <h3>Salon #{{ room.id }}</h3>
                  <p>{{ formatMode(room.mode) }} - {{ room.playerCount }}/5 joueurs</p>
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
                {{ loadingState === `public-${room.id}` ? 'Connexion...' : 'Rejoindre ce salon' }}
              </button>
            </article>
          </div>
        </section>
      </main>

      <div v-if="errorMessage" class="error-banner">
        {{ errorMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CreateRoomOptions, LobbyRoomSummary } from '~/types'

type PresetId = 'PRIVATE' | 'PUBLIC' | 'HYBRID' | 'SOLO'
type LoadingState = '' | 'create' | 'join' | 'quick' | 'start' | 'leave' | 'fill-bots' | `public-${number}`

const { user, logout } = useAuth()
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
    label: 'Prive',
    shortLabel: 'prive',
    cardDescription: 'Code uniquement',
    description: 'Salon reserve a tes invites. On entre uniquement avec le code partage.',
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
    description: 'Salon visible dans la liste publique et accessible aussi a la recherche rapide.',
    options: {
      visibility: 'PUBLIC',
      allowQuickJoin: true,
      fillWithBots: false,
      mode: 'CLASSIC'
    }
  },
  {
    id: 'HYBRID',
    label: 'Code + rapide',
    shortLabel: 'hybride',
    cardDescription: 'Amis + remplissage',
    description: 'Tu invites tes amis avec le code, mais les places restantes peuvent etre remplies par la recherche rapide.',
    options: {
      visibility: 'UNLISTED',
      allowQuickJoin: true,
      fillWithBots: false,
      mode: 'CLASSIC'
    }
  },
  {
    id: 'SOLO',
    label: 'Solo',
    shortLabel: 'solo',
    cardDescription: 'Toi + 4 bots',
    description: 'Une table privee pour toi, completee au lancement par quatre bots standard.',
    options: {
      visibility: 'PRIVATE',
      allowQuickJoin: false,
      fillWithBots: true,
      mode: 'SOLO'
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
      errorMessage.value = result.error || 'Impossible de recuperer les salons'
      return
    }

    errorMessage.value = ''
    activeRoom.value = result.activeRoom
    publicRooms.value = result.publicRooms

    if (result.activeRoom?.status === 'PLAYING') {
      await router.push(`/game/${result.activeRoom.id}`)
    }
  } catch (error: any) {
    errorMessage.value = error?.data?.message || 'Impossible de recuperer les salons'
  } finally {
    loadingRooms.value = false
  }
}

let pollInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
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
  } else {
    errorMessage.value = result.error || 'Erreur de creation du salon'
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
    errorMessage.value = result.error || 'Impossible dajouter des bots'
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
  await loadLobbyData()
  loadingState.value = ''
}

const handleLogout = async () => {
  logout()
  await router.push('/')
}

const formatVisibility = (visibility: LobbyRoomSummary['visibility'], allowQuickJoin: boolean) => {
  if (visibility === 'PRIVATE') {
    return 'Prive'
  }

  if (visibility === 'UNLISTED') {
    return allowQuickJoin ? 'Code + remplissage rapide' : 'Non liste'
  }

  return allowQuickJoin ? 'Public + rapide' : 'Public'
}

const formatMode = (mode: LobbyRoomSummary['mode']) => {
  if (mode === 'QUICK_MATCH') {
    return 'Recherche rapide'
  }

  if (mode === 'SOLO') {
    return 'Solo'
  }

  return 'Classique'
}

const formatRoomStatus = (status: LobbyRoomSummary['status']) => {
  if (status === 'PLAYING') {
    return 'En jeu'
  }

  if (status === 'FINISHED') {
    return 'Termine'
  }

  return 'En attente'
}
</script>

<style scoped>
.lobby-page {
  height: 100dvh;
  overflow: hidden;
  padding: clamp(10px, 1.6vw, 20px);
  background:
    radial-gradient(circle at top, rgba(237, 214, 154, 0.15), transparent 32%),
    linear-gradient(160deg, #132d21 0%, #0a1913 100%);
}

.lobby-shell {
  height: 100%;
  max-width: 1440px;
  margin: 0 auto;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 16px;
}

.lobby-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  padding: 28px 32px;
  border-radius: 28px;
  background: rgba(255, 251, 240, 0.92);
  border: 1px solid rgba(98, 66, 27, 0.12);
  box-shadow: 0 20px 60px rgba(58, 40, 12, 0.12);
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
  max-width: 680px;
  margin: 12px 0 0;
  color: #5a5448;
}

.user-panel {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 14px 18px;
  border-radius: 20px;
  background: rgba(32, 88, 52, 0.08);
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
  grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.85fr);
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

.panel {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 26px;
  border-radius: 26px;
  background: rgba(255, 251, 240, 0.94);
  border: 1px solid rgba(98, 66, 27, 0.12);
  box-shadow: 0 18px 48px rgba(58, 40, 12, 0.08);
}

.panel-primary {
  grid-row: 1 / span 2;
}

.panel-create {
  padding: 20px 22px;
}

.panel-wide {
  grid-column: 2;
  grid-row: 2;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 22px;
}

.panel-create .panel-head {
  margin-bottom: 14px;
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
  background: rgba(32, 88, 52, 0.14);
  color: #205834;
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
  gap: 16px;
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
  background: rgba(32, 88, 52, 0.1);
  border-color: rgba(32, 88, 52, 0.2);
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
  margin-top: 22px;
}

.room-fill-btn,
.room-leave-btn {
  margin-top: 10px;
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
  border-color: rgba(32, 88, 52, 0.32);
  box-shadow: 0 10px 24px rgba(32, 88, 52, 0.08);
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
  border-color: rgba(32, 88, 52, 0.44);
  background: rgba(32, 88, 52, 0.08);
}

.preset-summary {
  display: grid;
  gap: 10px;
  padding: 18px 0;
}

.panel-create .preset-summary {
  gap: 0;
  padding: 12px 0 14px;
  font-size: 0.92rem;
}

.divider {
  height: 1px;
  margin: 22px 0;
  background: linear-gradient(90deg, rgba(98, 66, 27, 0.04), rgba(98, 66, 27, 0.18), rgba(98, 66, 27, 0.04));
}

.create-tools {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.join-by-code,
.quick-match {
  display: grid;
  gap: 14px;
}

.compact-box {
  padding: 14px;
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
  border-color: rgba(32, 88, 52, 0.42);
  box-shadow: 0 0 0 3px rgba(32, 88, 52, 0.1);
}

.public-room-list {
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.public-room-card {
  display: grid;
  gap: 14px;
  padding: 18px;
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
  padding: 13px 18px;
  font-weight: 700;
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
  background: #205834;
  color: #fff;
  box-shadow: 0 12px 24px rgba(32, 88, 52, 0.2);
}

.btn-secondary,
.btn-ghost {
  background: rgba(98, 66, 27, 0.08);
  color: #4f4331;
}

.btn-success {
  background: #b67618;
  color: #fff;
  box-shadow: 0 12px 24px rgba(182, 118, 24, 0.2);
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
  margin-top: 18px;
  padding: 14px 18px;
  border-radius: 18px;
  background: rgba(127, 29, 29, 0.08);
  border: 1px solid rgba(127, 29, 29, 0.14);
  color: #8b1d1d;
  font-weight: 600;
}

@media (max-width: 1120px) {
  .lobby-grid {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(3, minmax(0, 1fr));
  }

  .panel-primary,
  .panel-wide {
    grid-column: auto;
    grid-row: auto;
  }
}

@media (max-width: 820px) {
  .lobby-page {
    padding: 10px;
  }

  .lobby-header,
  .players-head,
  .public-room-top,
  .join-form {
    grid-template-columns: 1fr;
    display: grid;
  }

  .user-panel,
  .panel-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .preset-grid,
  .room-meta-grid {
    grid-template-columns: 1fr;
  }

  .create-tools {
    grid-template-columns: 1fr;
  }

  .panel {
    padding: 18px;
    border-radius: 20px;
  }
}
</style>
