<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card">
        <h1 class="title">Jeu de Tarot</h1>
        
        <div v-if="!showRegister" class="form-section">
          <h2>Connexion</h2>
          <form @submit.prevent="handleLogin">
            <div class="form-group">
              <label for="email">Email</label>
              <input
                id="email"
                v-model="loginForm.email"
                type="email"
                required
                placeholder="votre@email.com"
              />
            </div>
            
            <div class="form-group">
              <label for="password">Mot de passe</label>
              <input
                id="password"
                v-model="loginForm.password"
                type="password"
                required
                placeholder="••••••••"
              />
            </div>
            
            <button type="submit" class="btn btn-primary" :disabled="loading">
              {{ loading ? 'Connexion...' : 'Se connecter' }}
            </button>
          </form>
          
          <p class="toggle-text">
            Pas encore de compte ?
            <a @click="showRegister = true">S'inscrire</a>
          </p>
        </div>
        
        <div v-else class="form-section">
          <h2>Inscription</h2>
          <form @submit.prevent="handleRegister">
            <div class="form-group">
              <label for="nom">Nom</label>
              <input
                id="nom"
                v-model="registerForm.nom"
                type="text"
                required
                placeholder="Nom"
              />
            </div>
            
            <div class="form-group">
              <label for="prenom">Prénom</label>
              <input
                id="prenom"
                v-model="registerForm.prenom"
                type="text"
                required
                placeholder="Prénom"
              />
            </div>
            
            <div class="form-group">
              <label for="pseudo">Pseudo</label>
              <input
                id="pseudo"
                v-model="registerForm.pseudo"
                type="text"
                required
                placeholder="Pseudo"
              />
            </div>
            
            <div class="form-group">
              <label for="reg-email">Email</label>
              <input
                id="reg-email"
                v-model="registerForm.email"
                type="email"
                required
                placeholder="votre@email.com"
              />
            </div>
            
            <div class="form-group">
              <label for="reg-password">Mot de passe</label>
              <input
                id="reg-password"
                v-model="registerForm.motdepasse"
                type="password"
                required
                placeholder="••••••••"
              />
            </div>
            
            <button type="submit" class="btn btn-primary" :disabled="loading">
              {{ loading ? 'Inscription...' : 'S\'inscrire' }}
            </button>
          </form>
          
          <p class="toggle-text">
            Déjà un compte ?
            <a @click="showRegister = false">Se connecter</a>
          </p>
        </div>
        
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { login, register, user } = useAuth()
const router = useRouter()

const showRegister = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const loginForm = reactive({
  email: '',
  password: ''
})

const registerForm = reactive({
  nom: '',
  prenom: '',
  email: '',
  pseudo: '',
  motdepasse: ''
})

onMounted(() => {
  if (user.value) {
    router.push('/lobby')
  }
})

const handleLogin = async () => {
  loading.value = true
  errorMessage.value = ''
  
  const result = await login(loginForm)
  
  if (result.success) {
    router.push('/lobby')
  } else {
    errorMessage.value = result.error || 'Erreur de connexion'
  }
  
  loading.value = false
}

const handleRegister = async () => {
  loading.value = true
  errorMessage.value = ''
  
  const result = await register(registerForm)
  
  if (result.success) {
    router.push('/lobby')
  } else {
    errorMessage.value = result.error || 'Erreur d\'inscription'
  }
  
  loading.value = false
}
</script>

<style scoped>
.login-page {
  height: 100dvh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.login-container {
  width: 100%;
  max-width: 450px;
  max-height: 100%;
}

.login-card {
  background: white;
  border-radius: 12px;
  max-height: 100%;
  overflow: auto;
  padding: clamp(22px, 4vw, 40px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.title {
  text-align: center;
  color: #2d5016;
  margin-bottom: 30px;
  font-size: 2.5rem;
}

.form-section h2 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.5rem;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: #2d5016;
}

.btn {
  width: 100%;
  padding: 14px;
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

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-text {
  text-align: center;
  margin-top: 20px;
  color: #666;
}

.toggle-text a {
  color: #2d5016;
  cursor: pointer;
  text-decoration: underline;
}

.toggle-text a:hover {
  color: #1f3810;
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

@media (max-width: 640px) {
  .title {
    margin-bottom: 22px;
    font-size: 2rem;
  }

  .form-group {
    margin-bottom: 16px;
  }
}
</style>
