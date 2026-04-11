<#
PowerShell helper para preparar ambiente de desenvolvimento mínimo.
Uso: execute este script a partir da raiz do repositório no PowerShell:

    .\scripts\setup-dev.ps1

Este script não altera variáveis sensíveis automaticamente — edite `apps/web/.env.local` manualmente.
#>

Write-Host "Iniciando setup de desenvolvimento (apps/web)" -ForegroundColor Cyan

Push-Location "$(Resolve-Path .)"

if (-not (Test-Path "apps/web")) {
    Write-Error "Diretório apps/web não encontrado. Execute este script na raiz do repo."
    exit 1
}

Set-Location "apps/web"

if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependências (npm install)..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "node_modules já presente, pulando npm install." -ForegroundColor Green
}

Write-Host "Gerando Prisma Client (prisma:generate)..." -ForegroundColor Yellow
npm run prisma:generate

if (-not (Test-Path ".env.local") -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host "Copiado .env.example → .env.local. Edite .env.local para configurar variáveis." -ForegroundColor Green
} else {
    Write-Host ".env.local já existe ou .env.example ausente. Confira variáveis em apps/web/.env.local" -ForegroundColor Green
}

Write-Host "Seed (opcional): execute 'npm run prisma:seed' quando estiver com DATABASE_URL configurado." -ForegroundColor Cyan

Pop-Location

Write-Host "Pronto. Siga as instruções em docs/SETUP_DEV.md para próximos passos." -ForegroundColor Cyan
