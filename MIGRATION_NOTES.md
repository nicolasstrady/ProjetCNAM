# Notes de Migration - Java vers Nuxt 3

## ✅ Complété

### Structure du Projet
- ✅ Configuration Nuxt 3 avec TypeScript
- ✅ Configuration Phaser.js
- ✅ Types TypeScript pour le jeu
- ✅ Docker Compose simplifié (MySQL uniquement)
- ✅ Mise à jour du .gitignore

### Backend (Server API)
- ✅ Connexion MySQL avec mysql2
- ✅ Routes d'authentification (login, register)
- ✅ Routes de gestion de partie (create, join, deal)
- ✅ Routes de jeu (player-hand, contract, call-king, play-card, state)
- ✅ Utilitaires de base de données

### Frontend
- ✅ Composables useAuth et useGame
- ✅ Composable usePhaser
- ✅ Page de connexion/inscription
- ✅ Page lobby multijoueur
- ✅ Page de jeu avec Phaser.js
- ✅ Scène Phaser GameScene

### Assets
- ✅ Les images de cartes sont déjà dans `web/dist/cards/`
- ✅ CSS principal créé

## 🔄 À Faire

### 1. Copier les Assets
Les images des cartes doivent être copiées de `web/dist/` vers `public/` :
```bash
# Copier les cartes
cp -r web/dist/cards public/
cp web/dist/background.jpg public/
cp web/dist/cardback.png public/cards/
```

### 2. Installer les Dépendances
```bash
npm install
```

### 3. Démarrer la Base de Données
```bash
docker-compose up -d
```

### 4. Créer le fichier .env
```bash
cp env.example .env
```

### 5. Lancer l'Application
```bash
npm run dev
```

## 🎯 Améliorations Futures

### Phaser.js - Animations
- [ ] Animations de distribution des cartes
- [ ] Animations de jeu de cartes (glissement, rotation)
- [ ] Effets de particules pour les victoires
- [ ] Transitions entre les phases de jeu
- [ ] Zoom sur les cartes au survol
- [ ] Animations des scores

### WebSocket Temps Réel
- [ ] Implémenter WebSocket avec Nuxt
- [ ] Broadcast des actions en temps réel
- [ ] Synchronisation automatique des états
- [ ] Notifications de tour de jeu
- [ ] Chat entre joueurs

### Fonctionnalités de Jeu
- [ ] Validation complète des règles du Tarot
- [ ] Gestion du chien (écart des cartes)
- [ ] Calcul des scores selon les contrats
- [ ] Historique des parties
- [ ] Statistiques des joueurs
- [ ] Système de classement

### UI/UX
- [ ] Responsive design pour mobile
- [ ] Thèmes personnalisables
- [ ] Sons et musique
- [ ] Tutoriel interactif
- [ ] Animations de transition entre pages

### Optimisations
- [ ] Cache des données de jeu
- [ ] Optimisation des requêtes SQL
- [ ] Compression des assets
- [ ] Lazy loading des images de cartes
- [ ] Service Worker pour mode hors ligne

## 📋 Fichiers à Supprimer (Ancien Projet Java)

Une fois que tout fonctionne, vous pouvez supprimer :
- `src/` (code Java)
- `build.gradle`
- `settings.gradle`
- `gradlew`, `gradlew.bat`
- `gradle/`
- `.gradle/`
- `Dockerfile` (ancien Dockerfile Java)
- `projetTarot.iml`
- `web/` (ancien projet Vue standalone)

## 🔧 Configuration Recommandée

### Variables d'Environnement Production
```env
DB_HOST=votre-serveur-mysql
DB_PORT=3306
DB_USER=tarot_user
DB_PASSWORD=mot_de_passe_securise
DB_NAME=tarot_project
WS_URL=wss://votre-domaine.com
```

### Déploiement
Le projet Nuxt peut être déployé sur :
- Vercel (recommandé pour Nuxt)
- Netlify
- Heroku
- VPS avec PM2

## 📝 Notes Techniques

### Différences avec le Projet Java
1. **Architecture** : Monolithe Java → Full-stack JavaScript
2. **UI** : JavaFX → Vue.js + Phaser.js
3. **Communication** : Sockets Java → HTTP API + WebSocket (à implémenter)
4. **Base de données** : JDBC → mysql2
5. **Déploiement** : JAR + Docker → Application web moderne

### Avantages de la Migration
- Accessibilité web (pas d'installation)
- Interface moderne et responsive
- Animations fluides avec Phaser.js
- Développement plus rapide avec Vue.js
- Déploiement simplifié
- Meilleure expérience utilisateur
