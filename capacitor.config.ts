import type { CapacitorConfig } from '@capacitor/cli'

const liveReloadUrl = process.env.CAP_SERVER_URL?.trim()

const config: CapacitorConfig = {
  appId: 'com.projetcnam.tarot',
  appName: 'Tarot a 5',
  webDir: '.output/public',
  loggingBehavior: 'debug',
  server: liveReloadUrl
    ? {
        url: liveReloadUrl,
        cleartext: liveReloadUrl.startsWith('http://'),
        allowNavigation: [new URL(liveReloadUrl).host]
      }
    : undefined
}

export default config
