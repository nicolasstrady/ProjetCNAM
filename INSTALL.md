# Guide d'Installation - Jeu de Tarot Nuxt 3

## 🚀 Démarrage Rapide

### 1. Installer les dépendances Node.js

```bash
npm install
```

### 2. Configurer l'environnement

Créer un fichier `.env` à la racine du projet :

```bash
cp env.example .env
```

Le fichier `.env` devrait contenir :
```env
DB_HOST=localhost
DB_PORT=3307
DB_USER=root
DB_PASSWORD=root
DB_NAME=tarot_project
WS_URL=ws://localhost:3000
```

### 3. Démarrer la base de données MySQL

```bash
docker-compose up -d
```

Vérifier que MySQL est bien démarré :
```bash
docker-compose ps
```

### 4. Lancer l'application en mode développement

```bash
npm run dev
```

L'application sera accessible sur **http://localhost:3000**

## 📝 Comptes de Test

Utilisez l'un de ces comptes pour vous connecter :

| Email | Mot de passe | Pseudo |
|-------|--------------|--------|
| nicostrady@gmail.com | pass | nistra |
| dodo@gmail.com | pass | dodo |
| hugo@gmail.com | pass | hugo |
| dom@gmail.com | pass | dom |
| ipo@gmail.com | pass | ipo |

## 🎮 Tester le Jeu

1. Ouvrez **5 onglets** de navigateur (ou 5 navigateurs différents)
2. Connectez-vous avec **5 comptes différents** dans chaque onglet
3. Dans le premier onglet, **créez une partie** et notez l'ID
4. Dans les 4 autres onglets, **rejoignez la partie** avec l'ID
5. Une fois 5 joueurs connectés, **démarrez la partie**
6. Jouez au Tarot !

## 🛠️ Commandes Utiles

### Développement
```bash
npm run dev          # Démarrer le serveur de développement
npm run build        # Build pour la production
npm run preview      # Prévisualiser le build de production
```

### Base de données
```bash
docker-compose up -d              # Démarrer MySQL en arrière-plan
docker-compose down               # Arrêter MySQL
docker-compose logs -f db         # Voir les logs MySQL
docker-compose restart db         # Redémarrer MySQL
```

### Réinitialiser la base de données
```bash
docker-compose down -v            # Arrêter et supprimer les volumes
docker-compose up -d              # Redémarrer (réinitialise la DB)
```

## 🐛 Dépannage

### Erreur de connexion à la base de données

**Problème** : `Error: connect ECONNREFUSED 127.0.0.1:3307`

**Solution** :
1. Vérifier que Docker est démarré
2. Vérifier que MySQL tourne : `docker-compose ps`
3. Redémarrer MySQL : `docker-compose restart db`

### Port 3307 déjà utilisé

**Problème** : Le port 3307 est déjà utilisé

**Solution** :
Modifier le port dans `docker-compose.yml` et `.env` :
```yaml
# docker-compose.yml
ports:
  - "3308:3306"  # Utiliser 3308 au lieu de 3307
```

```env
# .env
DB_PORT=3308
```

### Les images de cartes ne s'affichent pas

**Problème** : Les cartes n'apparaissent pas dans Phaser

**Solution** :
Vérifier que le dossier `public/cards/` existe et contient les images :
```bash
ls public/cards/
```

Si le dossier est vide, copier les images depuis web/dist :
```bash
cp -r web/dist/cards public/
cp web/dist/background.jpg public/
```

### Erreur TypeScript

**Problème** : Erreurs TypeScript au démarrage

**Solution** :
```bash
rm -rf .nuxt
npm run dev
```

## 📦 Structure des Dossiers Importants

```
ProjetCNAM/
├── public/
│   ├── cards/              # Images des cartes (REQUIS)
│   │   ├── Atout/
│   │   ├── Spade/
│   │   ├── Heart/
│   │   ├── Diamond/
│   │   ├── Clover/
│   │   └── cardback.png
│   └── background.jpg
├── server/
│   └── api/                # Routes API backend
├── pages/                  # Pages de l'application
├── composables/            # Logique réutilisable
└── phaser/                 # Scènes Phaser.js
```

## 🔧 Configuration Avancée

### Changer le port de l'application

Modifier `nuxt.config.ts` :
```typescript
export default defineNuxtConfig({
  devServer: {
    port: 3001  // Nouveau port
  }
})
```

### Activer les logs de debug

Dans `.env` :
```env
NODE_ENV=development
DEBUG=*
```

## 🚀 Déploiement en Production

### Build
```bash
npm run build
```

### Démarrer en production
```bash
node .output/server/index.mjs
```

### Variables d'environnement production
Assurez-vous de configurer :
- `DB_HOST` : Adresse de votre serveur MySQL
- `DB_USER` et `DB_PASSWORD` : Identifiants sécurisés
- `DB_NAME` : Nom de la base de données

## 📞 Support

Pour toute question ou problème :
1. Consultez `MIGRATION_NOTES.md` pour les détails techniques
2. Vérifiez les logs : `docker-compose logs -f`
3. Vérifiez la console du navigateur (F12)
