import type { User, LoginCredentials, RegisterData } from '~/types'

const AUTH_STORAGE_KEY = 'tarot-user-session'
const LEGACY_AUTH_COOKIE = 'tarot-user'

function readSessionUser() {
  if (!import.meta.client) {
    return null as User | null
  }

  const rawValue = window.sessionStorage.getItem(AUTH_STORAGE_KEY)

  if (!rawValue) {
    return null as User | null
  }

  try {
    return JSON.parse(rawValue) as User
  } catch {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
    return null as User | null
  }
}

function writeSessionUser(user: User | null) {
  if (!import.meta.client) {
    return
  }

  if (user) {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
    return
  }

  window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
}

function clearLegacyAuthCookie() {
  if (!import.meta.client) {
    return
  }

  document.cookie = `${LEGACY_AUTH_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`
}

export const useAuth = () => {
  const user = useState<User | null>('user', () => null)
  const authSyncInitialized = useState<boolean>('auth-sync-initialized', () => false)
  const isAuthenticated = computed(() => !!user.value)

  if (!authSyncInitialized.value) {
    authSyncInitialized.value = true

    if (import.meta.client) {
      clearLegacyAuthCookie()

      const restoredUser = readSessionUser()
      if (restoredUser) {
        user.value = restoredUser
      }
    }

    watch(user, (value) => {
      clearLegacyAuthCookie()
      writeSessionUser(value)
    }, { deep: true })
  } else if (import.meta.client && !user.value) {
    const restoredUser = readSessionUser()
    if (restoredUser) {
      user.value = restoredUser
    }
  }

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await $fetch<{ success: boolean; user?: User }>('/api/auth/login', {
        method: 'POST',
        body: credentials
      })

      if (response.success && response.user) {
        user.value = response.user
        return { success: true, user: response.user }
      }

      return { success: false, error: 'Echec de la connexion' }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur de connexion' }
    }
  }

  const register = async (data: RegisterData) => {
    try {
      const response = await $fetch<{ success: boolean; user?: User }>('/api/auth/register', {
        method: 'POST',
        body: data
      })

      if (response.success && response.user) {
        user.value = response.user
        return { success: true, user: response.user }
      }

      return { success: false, error: "Echec de l'inscription" }
    } catch (error: any) {
      return { success: false, error: error.data?.message || "Erreur d'inscription" }
    }
  }

  const logout = () => {
    user.value = null
  }

  return {
    user,
    isAuthenticated,
    login,
    register,
    logout
  }
}
