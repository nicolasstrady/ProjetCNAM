# Capacitor

Ce projet peut maintenant etre prepare pour Android et iOS avec Capacitor.

## Prerequis

- Backend web/API accessible depuis le mobile
- Pour un bundle mobile local, definir `NUXT_PUBLIC_API_BASE_URL` vers ton URL Railway
- Android Studio pour Android
- Xcode sur macOS pour iOS

## Commandes utiles

```bash
npm install
npm run cap:add:android
npm run cap:add:ios
npm run cap:sync
```

Le script `npm run cap:sync` lance d'abord un build mobile (`nuxt generate` en mode SPA), puis synchronise les assets dans Capacitor.

## Build mobile local

Le build mobile utilise :

- `NUXT_MOBILE_BUILD=true`
- un rendu client-only pour produire un bundle statique
- `webDir = .output/public`

Pour viser un backend distant :

```bash
set NUXT_PUBLIC_API_BASE_URL=https://ton-backend.railway.app
npm run cap:sync
```

Sous macOS/Linux :

```bash
export NUXT_PUBLIC_API_BASE_URL=https://ton-backend.railway.app
npm run cap:sync
```

## Live reload Capacitor

Tu peux aussi injecter temporairement une URL de dev dans Capacitor :

```bash
set CAP_SERVER_URL=http://192.168.1.50:3000
```

Puis ouvrir la plateforme :

```bash
npm run cap:open:android
npm run cap:open:ios
```

Ne conserve pas `CAP_SERVER_URL` pour la production.
