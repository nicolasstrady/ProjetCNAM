# Script de nettoyage des fichiers Java/Gradle
# À exécuter après avoir vérifié que l'application Nuxt fonctionne correctement

Write-Host "=== Nettoyage des fichiers Java/Gradle ===" -ForegroundColor Cyan
Write-Host ""

# Liste des fichiers et dossiers à supprimer
$itemsToRemove = @(
    "src",
    "build.gradle",
    "settings.gradle",
    "gradlew",
    "gradlew.bat",
    "gradle",
    ".gradle",
    "Dockerfile",
    "projetTarot.iml",
    "web"
)

Write-Host "Les éléments suivants seront supprimés :" -ForegroundColor Yellow
foreach ($item in $itemsToRemove) {
    if (Test-Path $item) {
        Write-Host "  ✓ $item" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $item (n'existe pas)" -ForegroundColor Gray
    }
}

Write-Host ""
$confirmation = Read-Host "Voulez-vous continuer ? (O/N)"

if ($confirmation -eq 'O' -or $confirmation -eq 'o') {
    Write-Host ""
    Write-Host "Suppression en cours..." -ForegroundColor Yellow
    
    foreach ($item in $itemsToRemove) {
        if (Test-Path $item) {
            try {
                Remove-Item -Path $item -Recurse -Force
                Write-Host "  ✓ Supprimé: $item" -ForegroundColor Green
            } catch {
                Write-Host "  ✗ Erreur lors de la suppression de $item : $_" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
    Write-Host "=== Nettoyage terminé ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Le projet est maintenant un projet Nuxt 3 pur !" -ForegroundColor Green
    Write-Host "Vous pouvez maintenant exécuter: npm run dev" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Nettoyage annulé." -ForegroundColor Yellow
}
