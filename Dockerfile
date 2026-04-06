# Dockerfile pour l'application Nuxt 3 (Mode Développement)
FROM node:20-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier tout le code source
COPY . .

# Exposer le port 3000
EXPOSE 3000

# Variables d'environnement par défaut
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

# Démarrer l'application en mode développement
CMD ["npm", "run", "dev"]
