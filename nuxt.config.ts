// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  devServer: {
    host: process.env.NUXT_HOST || '0.0.0.0',
    port: Number(process.env.NUXT_PORT || 3000)
  },
  
  modules: [],
  
  css: ['~/assets/css/main.css'],
  
  runtimeConfig: {
    // Server-side only
    dbHost: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    dbPort: process.env.DB_PORT || process.env.MYSQLPORT || '3307',
    dbUser: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    dbPassword: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || 'root',
    dbName: process.env.DB_NAME || process.env.MYSQLDATABASE || 'tarot_project',
    
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
    server: {
      watch: process.env.CHOKIDAR_USEPOLLING === 'true'
        ? {
            usePolling: true,
            interval: Number(process.env.CHOKIDAR_INTERVAL || 250)
          }
        : undefined,
      hmr: {
        host: process.env.NUXT_HMR_HOST || 'localhost',
        port: Number(process.env.NUXT_HMR_PORT || process.env.NUXT_PORT || 3000),
        clientPort: Number(process.env.NUXT_HMR_PORT || process.env.NUXT_PORT || 3000),
        protocol: 'ws'
      }
    },
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
