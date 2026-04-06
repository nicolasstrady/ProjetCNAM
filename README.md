# Jeu de Tarot - Nuxt 3 + Phaser.js

Jeu de Tarot multijoueur en ligne développé avec Nuxt 3, Vue.js, Phaser.js et MySQL.

## 🎮 Fonctionnalités

- **Authentification** : Système de connexion et d'inscription
- **Lobby multijoueur** : Création et rejoindre des parties (5 joueurs)
- **Jeu de Tarot complet** : 
  - Phase d'enchères (Petite, Garde, Garde Sans, Garde Contre)
  - Appel du Roi
  - Échange avec le chien
  - Jeu des 15 plis
  - Calcul automatique des scores
- **Rendu graphique Phaser.js** : Animations fluides des cartes
- **Temps réel** : Mises à jour en temps réel de l'état du jeu

## 🚀 Prérequis

- Node.js 18+ et npm
- Docker et Docker Compose (pour la base de données)

## 📦 Installation

1. **Cloner le projet**
```bash
git clone <repository-url>
cd ProjetCNAM
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer les variables d'environnement**
```bash
cp env.example .env
```

Modifier `.env` si nécessaire :
```env
DB_HOST=localhost
DB_PORT=3307
DB_USER=root
DB_PASSWORD=root
DB_NAME=tarot_project
```

4. **Démarrer avec Docker (Recommandé)**

**Option A : Tout avec Docker (une seule commande)**
```bash
docker-compose up --build
```

**Option B : Développement local (plus rapide)**
```bash
# Démarrer uniquement MySQL
docker-compose up -d db

# Lancer Nuxt localement
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

📖 **Pour plus de détails sur Docker, consultez [DOCKER.md](DOCKER.md)**

## 🎯 Développement

### Avec Docker
```bash
docker-compose up
```

### Sans Docker (développement local)
```bash
# 1. Démarrer MySQL
docker-compose up -d db

# 2. Lancer Nuxt
npm run dev
```

## 🏗️ Build Production

```bash
npm run build
npm run preview
```

## 🗄️ Structure du Projet

```
ProjetCNAM/
├── assets/              # CSS et ressources statiques
├── components/          # Composants Vue réutilisables
├── composables/         # Composables Vue (useAuth, useGame, usePhaser)
├── pages/              # Pages de l'application
│   ├── index.vue       # Page de connexion
│   ├── lobby.vue       # Lobby multijoueur
│   └── game/[id].vue   # Page de jeu
├── phaser/             # Scènes Phaser.js
│   └── scenes/
│       └── GameScene.ts
├── public/             # Fichiers publics (cartes, images)
│   └── cards/          # Images des cartes
├── server/             # API Nuxt Server
│   ├── api/            # Routes API
│   │   ├── auth/       # Authentification
│   │   └── game/       # Logique de jeu
│   └── utils/          # Utilitaires serveur (DB)
├── types/              # Types TypeScript
├── db/                 # Scripts SQL
│   └── init.sql        # Initialisation de la DB
├── docker-compose.yml  # Configuration Docker (MySQL)
└── nuxt.config.ts      # Configuration Nuxt
```

## 🎲 Comment Jouer

1. **Créer un compte** ou se connecter
2. **Créer une partie** ou rejoindre une partie existante
3. **Attendre** que 5 joueurs rejoignent la partie
4. **Phase d'enchères** : Choisir son contrat ou passer
5. **Appel du Roi** : Le preneur appelle un Roi
6. **Échange avec le chien** : Le preneur écarte 3 cartes
7. **Jeu des plis** : Jouer les 15 plis
8. **Scores** : Calcul automatique des points

## 🛠️ Technologies Utilisées

- **Frontend** : Nuxt 3, Vue.js 3, TypeScript
- **Rendu Graphique** : Phaser.js 3
- **Backend** : Nuxt Server API
- **Base de données** : MySQL 8.0
- **ORM** : mysql2 (driver Node.js)
- **Containerisation** : Docker

## 📝 Comptes de Test

Plusieurs comptes sont disponibles dans `db/init.sql` :
- Email: `nicostrady@gmail.com` / Password: `pass`
- Email: `dodo@gmail.com` / Password: `pass`
- Email: `hugo@gmail.com` / Password: `pass`
- Email: `dom@gmail.com` / Password: `pass`
- Email: `ipo@gmail.com` / Password: `pass`

## 🔧 Configuration de la Base de Données

La base de données est automatiquement créée et initialisée au premier lancement de Docker Compose. Le schéma inclut :
- Table `utilisateur` : Comptes utilisateurs
- Table `partie` : Parties de jeu
- Table `joueur` : Joueurs dans les parties
- Table `carte` : Toutes les cartes du jeu (78 cartes)
- Table `chien` : Le chien (3 cartes)
- Table `plis` : Les plis joués

## 🚧 Migration depuis Java

Ce projet a été migré depuis une architecture Java/Gradle/JavaFX vers Nuxt 3 + Phaser.js pour :
- Meilleure accessibilité (navigateur web)
- Interface moderne et responsive
- Animations fluides avec Phaser.js
- Architecture full-stack JavaScript/TypeScript
- Déploiement simplifié

