import type { User, LoginCredentials, RegisterData } from '~/types'

const AUTH_STORAGE_KEY = 'tarot-user-session'
const LEGACY_AUTH_COOKIE = 'tarot-user'

let restorePromise: Promise<User | null> | null = null

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
  const apiUrl = useApiUrl()
  const user = useState<User | null>('user', () => null)
  const authSyncInitialized = useState<boolean>('auth-sync-initialized', () => false)
  const authReady = useState<boolean>('auth-ready', () => false)
  const isAuthenticated = computed(() => !!user.value)

  const applyUser = (value: User | null) => {
    user.value = value
    clearLegacyAuthCookie()
    writeSessionUser(value)
  }

  const restoreSession = async (force = false) => {
    if (!import.meta.client) {
      authReady.value = true
      return user.value
    }

    if (!force && restorePromise) {
      return restorePromise
    }

    restorePromise = (async () => {
      try {
        const response = await $fetch<{ success: boolean; user: User | null }>(apiUrl('/api/auth/me'), {
          credentials: 'include'
        })

        const sessionUser = response.success ? response.user : null
        applyUser(sessionUser)
        return sessionUser
      } catch {
        const restoredUser = readSessionUser()
        applyUser(restoredUser)
        return restoredUser
      } finally {
        authReady.value = true
        restorePromise = null
      }
    })()

    return restorePromise
  }

  if (!authSyncInitialized.value) {
    authSyncInitialized.value = true

    if (import.meta.client) {
      clearLegacyAuthCookie()
      const restoredUser = readSessionUser()
      if (restoredUser) {
        user.value = restoredUser
      }

      void restoreSession(true)
    } else {
      authReady.value = true
    }
  } else if (import.meta.client && !authReady.value) {
    void restoreSession()
  }

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await $fetch<{ success: boolean; user?: User }>(apiUrl('/api/auth/login'), {
        method: 'POST',
        credentials: 'include',
        body: credentials
      })

      if (response.success && response.user) {
        applyUser(response.user)
        authReady.value = true
        return { success: true, user: response.user }
      }

      return { success: false, error: 'Echec de la connexion' }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur de connexion' }
    }
  }

  const register = async (data: RegisterData) => {
    try {
      const response = await $fetch<{ success: boolean; user?: User }>(apiUrl('/api/auth/register'), {
        method: 'POST',
        credentials: 'include',
        body: data
      })

      if (response.success && response.user) {
        applyUser(response.user)
        authReady.value = true
        return { success: true, user: response.user }
      }

      return { success: false, error: "Echec de l'inscription" }
    } catch (error: any) {
      return { success: false, error: error.data?.message || "Erreur d'inscription" }
    }
  }

  const logout = async () => {
    try {
      await $fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include'
      })
    } finally {
      applyUser(null)
      authReady.value = true
    }
  }

  return {
    user,
    isAuthenticated,
    authReady,
    restoreSession,
    login,
    register,
    logout
  }
}
