# Nettoyage Manuel des Fichiers Verrouillés

## ⚠️ Fichiers Restants à Supprimer

Certains fichiers Java/Gradle sont verrouillés par un processus actif (probablement votre IDE).

### Fichiers Bloqués
- `src/` - Code source Java
- `gradle/` - Wrapper Gradle

## 📋 Instructions de Nettoyage

### Option 1 : Fermer l'IDE et Réessayer

1. **Fermez votre IDE** (VS Code, IntelliJ, etc.)
2. **Exécutez le script PowerShell** :
   ```powershell
   .\cleanup-remaining.ps1
   ```

### Option 2 : Suppression Manuelle

1. **Fermez votre IDE**
2. **Supprimez manuellement** les dossiers suivants :
   - `src/`
   - `gradle/`

3. **Vérifiez** qu'il ne reste plus de fichiers Java :
   ```powershell
   Get-ChildItem -Recurse -Include *.java
   ```

### Option 3 : Redémarrage

Si les fichiers restent verrouillés :
1. **Redémarrez votre ordinateur**
2. **Supprimez les dossiers** avant d'ouvrir l'IDE

## ✅ Fichiers Déjà Supprimés

- ✅ `build.gradle`
- ✅ `settings.gradle`
- ✅ `gradlew`
- ✅ `gradlew.bat`
- ✅ `.gradle/`
- ✅ `Dockerfile`
- ✅ `projetTarot.iml`
- ✅ `web/` (ancien projet Vue)

## 🎯 Vérification Finale

Une fois le nettoyage terminé, vérifiez que seuls les fichiers Nuxt restent :

```powershell
# Lister les fichiers à la racine
Get-ChildItem -File | Select-Object Name

# Devrait afficher uniquement :
# - package.json
# - nuxt.config.ts
# - tsconfig.json
# - docker-compose.yml
# - .gitignore
# - .prettierrc
# - README.md
# - INSTALL.md
# - NEXT_STEPS.md
# - MIGRATION_NOTES.md
# - CLEANUP_MANUAL.md
# - cleanup-java.ps1
# - cleanup-remaining.ps1
# - env.example
# - vscode-settings.json
```

## 🚀 Après le Nettoyage

Une fois tous les fichiers Java supprimés :

```bash
# Installer les dépendances Nuxt
npm install

# Démarrer la base de données
docker-compose up -d

# Lancer l'application
npm run dev
```

Votre projet sera alors **100% Nuxt 3** ! 🎉
