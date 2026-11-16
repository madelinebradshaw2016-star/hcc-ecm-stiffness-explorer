# PowerShell script to create and publish the GitHub repository and GitHub Pages
param (
    [string]$RepoName = "hcc-ecm-stiffness-explorer"
)

$ghPath = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $ghPath)) {
    $ghPath = "gh"
}

Write-Host "==> Checking GitHub CLI authentication..." -ForegroundColor Cyan
& $ghPath auth status
if ($LASTEXITCODE -ne 0) {
    Write-Host "GitHub CLI is not authenticated yet. Please authorize at https://github.com/login/device" -ForegroundColor Yellow
    exit 1
}

Write-Host "==> Creating public GitHub repository '$RepoName' and pushing code..." -ForegroundColor Cyan
& $ghPath repo create $RepoName --public --source=. --remote=origin --push

if ($LASTEXITCODE -eq 0) {
    Write-Host "==> Enabling GitHub Pages on 'main' branch..." -ForegroundColor Cyan
    $user = (& $ghPath api user --jq .login)
    & $ghPath api -X POST "repos/$user/$RepoName/pages" -f source='{"branch":"main","path":"/"}'
    
    Write-Host "`n=======================================================" -ForegroundColor Green
    Write-Host "SUCCESS! Your repository and website are published:" -ForegroundColor Green
    Write-Host "Repository: https://github.com/$user/$RepoName" -ForegroundColor White
    Write-Host "Website:    https://$user.github.io/$RepoName/" -ForegroundColor White
    Write-Host "=======================================================`n" -ForegroundColor Green
} else {
    Write-Host "Error creating repository. Please check output above." -ForegroundColor Red
}
