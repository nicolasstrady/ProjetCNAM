# Script pour supprimer les fichiers Java/Gradle restants
# À exécuter APRÈS avoir fermé votre IDE

Write-Host "=== Nettoyage des Fichiers Restants ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: Assurez-vous d'avoir fermé votre IDE avant de continuer !" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Avez-vous fermé votre IDE ? (O/N)"

if ($confirmation -ne 'O' -and $confirmation -ne 'o') {
    Write-Host ""
    Write-Host "Veuillez fermer votre IDE et réexécuter ce script." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "Suppression des fichiers restants..." -ForegroundColor Yellow
Write-Host ""

# Fonction pour supprimer avec gestion d'erreur
function Remove-ItemSafe {
    param($Path)
    
    if (Test-Path $Path) {
        try {
            Remove-Item -Path $Path -Recurse -Force -ErrorAction Stop
            Write-Host "  ✓ Supprimé: $Path" -ForegroundColor Green
            return $true
        } catch {
            Write-Host "  ✗ Impossible de supprimer $Path" -ForegroundColor Red
            Write-Host "    Raison: $_" -ForegroundColor Gray
            return $false
        }
    } else {
        Write-Host "  - $Path n'existe pas (déjà supprimé)" -ForegroundColor Gray
        return $true
    }
}

# Liste des éléments à supprimer
$itemsToRemove = @("src", "gradle")
$allSuccess = $true

foreach ($item in $itemsToRemove) {
    $success = Remove-ItemSafe -Path $item
    if (-not $success) {
        $allSuccess = $false
    }
}

Write-Host ""

if ($allSuccess) {
    Write-Host "=== Nettoyage Terminé avec Succès ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Tous les fichiers Java/Gradle ont été supprimés !" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prochaines étapes :" -ForegroundColor Cyan
    Write-Host "  1. npm install" -ForegroundColor White
    Write-Host "  2. docker-compose up -d" -ForegroundColor White
    Write-Host "  3. npm run dev" -ForegroundColor White
} else {
    Write-Host "=== Nettoyage Partiel ===" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Certains fichiers n'ont pas pu être supprimés." -ForegroundColor Yellow
    Write-Host "Solutions possibles :" -ForegroundColor Cyan
    Write-Host "  1. Redémarrez votre ordinateur" -ForegroundColor White
    Write-Host "  2. Supprimez manuellement les dossiers restants" -ForegroundColor White
    Write-Host "  3. Utilisez l'Explorateur Windows pour supprimer" -ForegroundColor White
}

Write-Host ""
