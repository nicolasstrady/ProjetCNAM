import type { User, LoginCredentials, RegisterData } from '~/types'

export const useAuth = () => {
  const authCookie = useCookie<User | null>('tarot-user', {
    default: () => null,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax'
  })

  const user = useState<User | null>('user', () => authCookie.value)
  const authSyncInitialized = useState<boolean>('auth-sync-initialized', () => false)
  const isAuthenticated = computed(() => !!user.value)

  if (!authSyncInitialized.value) {
    authSyncInitialized.value = true

    watch(user, (value) => {
      authCookie.value = value
    }, { deep: true })
  }

  if (!user.value && authCookie.value) {
    user.value = authCookie.value
  }

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        body: credentials
      })
      
      if (response.success && response.user) {
        user.value = response.user
        authCookie.value = response.user
        return { success: true, user: response.user }
      }
      
      return { success: false, error: 'Échec de la connexion' }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur de connexion' }
    }
  }

  const register = async (data: RegisterData) => {
    try {
      const response = await $fetch('/api/auth/register', {
        method: 'POST',
        body: data
      })
      
      if (response.success && response.user) {
        user.value = response.user
        authCookie.value = response.user
        return { success: true, user: response.user }
      }
      
      return { success: false, error: 'Échec de l\'inscription' }
    } catch (error: any) {
      return { success: false, error: error.data?.message || 'Erreur d\'inscription' }
    }
  }

  const logout = () => {
    user.value = null
    authCookie.value = null
  }

  return {
    user,
    isAuthenticated,
    login,
    register,
    logout
  }
}
