# 🔌 Connexion HeidiSQL à la Base de Données

## 📋 Paramètres de Connexion

### Pour se connecter à MySQL depuis votre machine (HeidiSQL)

| Paramètre | Valeur |
|-----------|--------|
| **Type de réseau** | MySQL (TCP/IP) |
| **Nom d'hôte / IP** | `localhost` ou `127.0.0.1` |
| **Utilisateur** | `root` |
| **Mot de passe** | `root` |
| **Port** | `3307` |
| **Base de données** | `tarot_project` |

## 🔧 Configuration dans HeidiSQL

1. **Ouvrir HeidiSQL**

2. **Créer une nouvelle session** :
   - Cliquez sur "Nouveau" en bas à gauche
   - Donnez un nom à la session : `Tarot Game - Docker`

3. **Configurer les paramètres** :
   - **Paramètres réseau** :
     - Type de réseau : `MySQL (TCP/IP)`
     - Nom d'hôte / IP : `127.0.0.1`
     - Utilisateur : `root`
     - Mot de passe : `root`
     - Port : `3307`
   
   - **Avancé** :
     - Base de données : `tarot_project` (optionnel)

4. **Tester la connexion** :
   - Cliquez sur "Ouvrir" pour vous connecter

## 📊 Structure de la Base de Données

Une fois connecté, vous verrez les tables suivantes :

### **utilisateur**
Stocke les comptes utilisateurs
```sql
SELECT * FROM utilisateur;
```

Colonnes :
- `id` - ID unique
- `nom` - Nom de famille
- `prenom` - Prénom
- `email` - Email (unique)
- `pseudo` - Pseudo (unique)
- `motdepasse` - Mot de passe

### **partie**
Stocke les parties de jeu
```sql
SELECT * FROM partie;
```

Colonnes :
- `id` - ID unique de la partie

### **joueur**
Stocke les joueurs dans chaque partie
```sql
SELECT * FROM joueur;
```

Colonnes :
- `id` - ID unique
- `utilisateur` - ID de l'utilisateur (FK)
- `num` - Numéro du joueur (1-5)
- `partie` - ID de la partie (FK)
- `carte1` à `carte15` - IDs des cartes en main
- `reponse` - Contrat choisi (WAIT, PETITE, GARDE, etc.)
- `equipe` - Équipe (1 = preneur, 2 = défense)
- `score` - Score du joueur

### **carte**
Toutes les 78 cartes du Tarot
```sql
SELECT * FROM carte;
```

Colonnes :
- `id` - ID unique (1-78)
- `lien` - Chemin de l'image
- `couleur` - Couleur (PIQUE, COEUR, CARREAU, TREFLE, ATOUT, BOUT)
- `valeur` - Valeur de la carte
- `points` - Points de la carte

### **chien**
Les 6 cartes du chien
```sql
SELECT * FROM chien;
```

### **plis**
Les plis joués
```sql
SELECT * FROM plis;
```

Colonnes :
- `id` - ID unique
- `partie` - ID de la partie (FK)
- `carte1` à `carte5` - IDs des cartes jouées
- `joueurGagnant` - Numéro du joueur gagnant
- `pliChien` - 1 si c'est le pli du chien, 0 sinon

## 🔍 Requêtes Utiles

### Voir tous les utilisateurs
```sql
SELECT id, pseudo, email FROM utilisateur;
```

### Voir les parties en cours
```sql
SELECT p.id, COUNT(j.id) as nb_joueurs
FROM partie p
LEFT JOIN joueur j ON p.id = j.partie
GROUP BY p.id;
```

### Voir les joueurs d'une partie
```sql
SELECT j.num, u.pseudo, j.reponse, j.equipe, j.score
FROM joueur j
JOIN utilisateur u ON j.utilisateur = u.id
WHERE j.partie = 1
ORDER BY j.num;
```

### Voir les cartes d'un joueur
```sql
SELECT c.id, c.couleur, c.valeur, c.points
FROM carte c
WHERE c.id IN (
  SELECT carte1 FROM joueur WHERE id = 1
  UNION SELECT carte2 FROM joueur WHERE id = 1
  -- ... etc
);
```

## 🐛 Dépannage

### Impossible de se connecter

**Erreur** : "Can't connect to MySQL server"

**Solutions** :
1. Vérifier que Docker est démarré
2. Vérifier que le conteneur MySQL tourne :
   ```bash
   docker-compose ps
   ```
3. Vérifier que le port 3307 n'est pas bloqué par le firewall
4. Redémarrer MySQL :
   ```bash
   docker-compose restart db
   ```

### Port déjà utilisé

**Erreur** : "Port 3307 already in use"

**Solution** : Un autre service MySQL tourne déjà sur le port 3307
```bash
# Arrêter l'autre service MySQL
# Ou changer le port dans docker-compose.yml
```

### Accès refusé

**Erreur** : "Access denied for user 'root'@'...' "

**Solution** : Vérifier le mot de passe
- Mot de passe par défaut : `root`
- Si changé, vérifier dans `docker-compose.yml`

## 📝 Comptes de Test

Utilisez ces comptes pour tester l'application :

| Email | Mot de passe | Pseudo |
|-------|--------------|--------|
| nicostrady@gmail.com | pass | nistra |
| dodo@gmail.com | pass | dodo |
| hugo@gmail.com | pass | hugo |
| dom@gmail.com | pass | dom |
| ipo@gmail.com | pass | ipo |

## 🔄 Réinitialiser la Base de Données

Pour repartir de zéro :

```bash
# Arrêter et supprimer les volumes
docker-compose down -v

# Redémarrer (réinitialise la DB avec init.sql)
docker-compose up -d
```

Cela supprimera toutes les données et recréera la base avec les données initiales.
