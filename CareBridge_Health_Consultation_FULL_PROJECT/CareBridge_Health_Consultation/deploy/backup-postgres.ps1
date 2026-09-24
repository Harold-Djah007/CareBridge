$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Push-Location $Root
try {
    $EnvFile = if ($env:CAREBRIDGE_ENV_FILE) { $env:CAREBRIDGE_ENV_FILE } else { "deploy/.env.production" }
    $ComposeFile = if ($env:CAREBRIDGE_COMPOSE_FILE) { $env:CAREBRIDGE_COMPOSE_FILE } else { "docker-compose.production.yml" }
    $Stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
    $Name = "carebridge-$Stamp.dump"
    $BackupDir = Join-Path $Root "backups"
    $Dest = Join-Path $BackupDir $Name
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

    $Compose = @("compose", "--env-file", $EnvFile, "-f", $ComposeFile)
    & docker @Compose exec -T postgres sh -lc "pg_dump -U carebridge -d carebridge -Fc -f /tmp/$Name"
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed." }

    & docker @Compose cp "postgres:/tmp/$Name" $Dest
    if ($LASTEXITCODE -ne 0) { throw "docker compose cp failed." }

    & docker @Compose exec -T postgres rm -f "/tmp/$Name"
    $Hash = Get-FileHash -Algorithm SHA256 -Path $Dest
    "$($Hash.Hash.ToLower())  $Name" | Set-Content -Encoding ascii "$Dest.sha256"
    Write-Host "CareBridge PostgreSQL backup created: $Dest"
    Write-Host "SHA256: $($Hash.Hash.ToLower())"
}
finally {
    Pop-Location
}
