param(
    [Parameter(Mandatory = $true)]
    [string]$Backup
)

$ErrorActionPreference = "Stop"
if ($env:CAREBRIDGE_CONFIRM_RESTORE -ne "YES") {
    throw "Restore blocked. Set CAREBRIDGE_CONFIRM_RESTORE=YES after verifying the backup and maintenance window."
}

$Root = Split-Path -Parent $PSScriptRoot
$ResolvedBackup = (Resolve-Path $Backup).Path
Push-Location $Root
try {
    $EnvFile = if ($env:CAREBRIDGE_ENV_FILE) { $env:CAREBRIDGE_ENV_FILE } else { "deploy/.env.production" }
    $ComposeFile = if ($env:CAREBRIDGE_COMPOSE_FILE) { $env:CAREBRIDGE_COMPOSE_FILE } else { "docker-compose.production.yml" }
    $Compose = @("compose", "--env-file", $EnvFile, "-f", $ComposeFile)
    $Remote = "/tmp/carebridge-restore.dump"

    $HashFile = "$ResolvedBackup.sha256"
    if (Test-Path $HashFile) {
        $Expected = ((Get-Content $HashFile -Raw).Trim() -split "\s+")[0].ToLower()
        $Actual = (Get-FileHash -Algorithm SHA256 -Path $ResolvedBackup).Hash.ToLower()
        if ($Expected -ne $Actual) { throw "Backup SHA256 verification failed." }
        Write-Host "Backup SHA256 verified."
    }

    & docker @Compose stop app
    if ($LASTEXITCODE -ne 0) { throw "Failed to stop CareBridge app." }

    & docker @Compose cp $ResolvedBackup "postgres:$Remote"
    if ($LASTEXITCODE -ne 0) { throw "Failed to copy backup into PostgreSQL container." }

    & docker @Compose exec -T postgres sh -lc "dropdb -U carebridge --if-exists carebridge && createdb -U carebridge carebridge && pg_restore -U carebridge -d carebridge --no-owner --no-privileges $Remote && rm -f $Remote"
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL restore failed." }

    & docker @Compose start app
    if ($LASTEXITCODE -ne 0) { throw "Failed to restart CareBridge app." }

    & docker @Compose exec -T app node -e "let n=0;const t=setInterval(async()=>{n++;try{const r=await fetch('http://127.0.0.1:5000/api/ready');if(r.ok){clearInterval(t);console.log('CareBridge restore health check passed.');process.exit(0)}}catch{}if(n>=40){clearInterval(t);process.exit(1)}},500)"
    if ($LASTEXITCODE -ne 0) { throw "CareBridge did not become ready after restore." }

    Write-Host "CareBridge PostgreSQL restore completed from: $ResolvedBackup"
}
finally {
    Pop-Location
}
