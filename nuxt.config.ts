// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  
  modules: [],
  
  css: ['~/assets/css/main.css'],
  
  runtimeConfig: {
    // Server-side only
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: process.env.DB_PORT || '3307',
    dbUser: process.env.DB_USER || 'root',
    dbPassword: process.env.DB_PASSWORD || 'root',
    dbName: process.env.DB_NAME || 'tarot_project',
    
    // Public (exposed to client)
    public: {
      wsUrl: process.env.WS_URL || 'ws://localhost:3000'
    }
  },
  
  nitro: {
    experimental: {
      websocket: true
    }
  },
  
  vite: {
    optimizeDeps: {
      include: ['phaser']
    },
    build: {
      rollupOptions: {
        external: []
      }
    }
  },
  
  typescript: {
    strict: true,
    // vite-plugin-checker casse actuellement dans le conteneur dev
    // on garde un typecheck manuel via `npm run typecheck`
    typeCheck: false
  }
})
