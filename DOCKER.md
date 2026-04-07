# 🐳 Guide Docker - Jeu de Tarot

## 🚀 Démarrage Rapide

Une seule commande pour tout lancer :

```bash
docker-compose up --build
```

L'application sera accessible sur **http://localhost:3000**

## 📦 Services

Le projet utilise 2 conteneurs Docker :

### 1. **db** - Base de données MySQL
- Image : `mysql:8.0`
- Port : `3307:3306`
- Base de données : `tarot_project`
- Données persistantes dans le volume `db_data`
- Initialisation automatique avec `db/init.sql`

### 2. **app** - Application Nuxt 3
- Build depuis le `Dockerfile`
- Port : `3000:3000`
- Dépend de la base de données (attend que MySQL soit prêt)
- Redémarre automatiquement en cas d'erreur

## 🔧 Commandes Utiles

### Démarrer les services
```bash
# Démarrer en arrière-plan
docker-compose up -d

# Démarrer avec rebuild
docker-compose up --build

# Démarrer et voir les logs
docker-compose up
```

### Arrêter les services
```bash
# Arrêter les conteneurs
docker-compose down

# Arrêter et supprimer les volumes (réinitialise la DB)
docker-compose down -v
```

### Voir les logs
```bash
# Tous les services
docker-compose logs -f

# Service spécifique
docker-compose logs -f app
docker-compose logs -f db
```

### Redémarrer un service
```bash
# Redémarrer l'application
docker-compose restart app

# Redémarrer la base de données
docker-compose restart db
```

### Vérifier l'état
```bash
# Voir les conteneurs en cours
docker-compose ps

# Voir les ressources utilisées
docker stats
```

## 🔄 Workflow de Développement

### Option 1 : Développement avec Docker (Recommandé pour la production)
```bash
# 1. Lancer tout avec Docker
docker-compose up --build

# 2. Accéder à l'application
# http://localhost:3000

# 3. Voir les logs en temps réel
docker-compose logs -f app
```

### Option 2 : Développement Local (Plus rapide pour le dev)
```bash
# 1. Lancer uniquement MySQL
docker-compose up -d db

# 2. Lancer Nuxt localement
npm run dev

# 3. L'application utilise la DB Docker
# http://localhost:3000
```

## 🐛 Dépannage

### Le conteneur app ne démarre pas
```bash
# Vérifier les logs
docker-compose logs app

# Reconstruire l'image
docker-compose build --no-cache app
docker-compose up app
```

### Erreur de connexion à la base de données
```bash
# Vérifier que MySQL est prêt
docker-compose logs db

# Attendre le healthcheck
docker-compose ps
# Le service db doit être "healthy"
```

### Port 3000 déjà utilisé
```bash
# Modifier le port dans docker-compose.yml
ports:
  - "3001:3000"  # Utiliser 3001 au lieu de 3000
```

### Réinitialiser complètement le projet
```bash
# Arrêter et supprimer tout
docker-compose down -v

# Supprimer les images
docker-compose down --rmi all

# Reconstruire et redémarrer
docker-compose up --build
```

## 📊 Variables d'Environnement

Les variables sont définies dans `docker-compose.yml` :

```yaml
environment:
  DB_HOST: db              # Nom du service MySQL
  DB_PORT: 3306            # Port interne (pas 3307)
  DB_USER: root
  DB_PASSWORD: root
  DB_NAME: tarot_project
  WS_URL: ws://localhost:3000
```

Pour modifier, éditez `docker-compose.yml` ou créez un fichier `.env`.

## 🏗️ Build de Production

### Build l'image
```bash
docker build -t tarot-game:latest .
```

### Lancer en production
```bash
docker-compose -f docker-compose.yml up -d
```

### Optimisation de l'image
L'image utilise :
- Node.js 20 Alpine (image légère)
- Build multi-stage pour réduire la taille
- Cache des dépendances npm

## 📝 Structure des Fichiers Docker

```
ProjetCNAM/
├── Dockerfile              # Image de l'application Nuxt
├── docker-compose.yml      # Orchestration des services
├── .dockerignore          # Fichiers à exclure du build
└── db/
    └── init.sql           # Script d'initialisation MySQL
```

## 🔒 Sécurité

⚠️ **Important pour la production** :

1. **Changer les mots de passe** dans `docker-compose.yml`
2. **Utiliser des secrets** Docker pour les credentials
3. **Ne pas exposer** le port MySQL (3307) en production
4. **Configurer un reverse proxy** (nginx) devant l'application

## 🚀 Déploiement

### Sur un serveur
```bash
# 1. Cloner le projet
git clone <repo-url>
cd ProjetCNAM

# 2. Configurer les variables d'environnement
cp env.example .env
nano .env

# 3. Lancer en production
docker-compose up -d

# 4. Vérifier que tout fonctionne
docker-compose ps
docker-compose logs -f
```

### Avec un reverse proxy (nginx)
```nginx
server {
    listen 80;
    server_name tarot.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📈 Monitoring

### Voir l'utilisation des ressources
```bash
docker stats
```

### Logs persistants
```bash
# Sauvegarder les logs
docker-compose logs > logs.txt

# Suivre les logs en temps réel
docker-compose logs -f --tail=100
```

## 🎯 Prochaines Étapes

1. Tester l'application avec 5 joueurs
2. Configurer un reverse proxy pour la production
3. Mettre en place des backups automatiques de la DB
4. Ajouter des tests automatisés dans le pipeline CI/CD
