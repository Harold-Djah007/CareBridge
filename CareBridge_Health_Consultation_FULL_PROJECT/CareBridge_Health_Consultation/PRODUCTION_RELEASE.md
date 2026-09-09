# CareBridge Production Release Runbook

This runbook is the final deployment contract for the Premium V6 release candidate. Repository CI proves application behaviour; this runbook closes the gap between a green repository and a real production deployment.

## Release principle

Do not call a deployment production-ready merely because the server starts. A production CareBridge process now fails fast when mandatory persistence, coordination, encryption, email, payment, HTTPS-origin, or session-policy configuration is missing.

## 1. Prerequisites

- A public DNS name controlled by the hospital, for example `carebridge.example.com`.
- A host with current Docker Engine + Docker Compose v2.
- TCP 80/443 reachable for Caddy certificate issuance, or an equivalent trusted HTTPS reverse proxy.
- Real production PostgreSQL/Redis services, or the included private Docker services.
- A real SMTP account.
- Flutterwave server credentials and webhook secret.
- Unique MFA and backup encryption secrets.
- A documented backup destination outside the application host for real production retention.

External FHIR, HL7, DICOM/PACS, insurer/NHIS and TURN/STUN connections are certified separately when the real provider endpoints and credentials exist.

## 2. Create production secrets

Copy the template without ever committing the result:

```powershell
Copy-Item "deploy\.env.production.example" "deploy\.env.production"
```

Generate independent random secrets. One PowerShell option is:

```powershell
-join ((1..48) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

Use different values for:

- `POSTGRES_PASSWORD`
- `MFA_ENCRYPTION_KEY`
- `BACKUP_ENCRYPTION_KEY`
- `FLW_SECRET_HASH`
- SMTP password / provider token

Edit `CAREBRIDGE_DOMAIN`, `CLIENT_URL` and `APP_URL` to the real HTTPS address. Production Flutterwave credentials must not be test credentials unless this is explicitly a non-live staging environment.

## 3. Validate the Compose configuration

From the CareBridge application directory:

```powershell
docker compose --env-file deploy/.env.production -f docker-compose.production.yml config
```

The generated configuration must not be pasted into tickets or chats because Docker Compose can render secrets.

## 4. Build and start

```powershell
docker compose --env-file deploy/.env.production -f docker-compose.production.yml build --pull
docker compose --env-file deploy/.env.production -f docker-compose.production.yml up -d
```

Check state:

```powershell
docker compose --env-file deploy/.env.production -f docker-compose.production.yml ps
```

Expected services:

- `postgres` healthy
- `redis` healthy
- `app` healthy
- `caddy` running

The application container runs as a non-root Node user with dropped Linux capabilities and no-new-privileges. Caddy terminates HTTPS and proxies normal HTTP plus Socket.IO/WebSocket traffic to the application.

## 5. Verify readiness over the real HTTPS address

```powershell
Invoke-RestMethod "https://carebridge.example.com/api/health"
Invoke-RestMethod "https://carebridge.example.com/api/ready"
```

Production `/api/ready` must report:

- `environment = production`
- PostgreSQL provider + primary runtime
- healthy Redis coordination
- MFA encryption configured
- security/trace telemetry enabled

## 6. Run the post-deploy smoke certificate

Unauthenticated infrastructure/web smoke:

```powershell
$env:CAREBRIDGE_BASE_URL = "https://carebridge.example.com"
node scripts/postdeploy-smoke.mjs
```

For the full authenticated smoke path, use a dedicated release-test account rather than a real patient account:

```powershell
$env:CAREBRIDGE_BASE_URL = "https://carebridge.example.com"
$env:CAREBRIDGE_SMOKE_EMAIL = "release-check@carebridge.example.com"
$env:CAREBRIDGE_SMOKE_PASSWORD = "<temporary-secret>"
$env:CAREBRIDGE_SMOKE_ROLE = "admin"
node scripts/postdeploy-smoke.mjs
```

Remove or rotate the temporary smoke password after release verification.

## 7. Provider acceptance

Repository CI cannot manufacture external-provider evidence. Before a live hospital release, record successful evidence for every integration actually enabled:

- SMTP: send a CareBridge test email and confirm delivery in the real inbox.
- Flutterwave: complete a provider-approved test/live transaction, verify the callback, webhook signature, payment status and receipt.
- Video: verify both participants through the real network path; production internet deployments should use a managed TURN service when direct peer connectivity is not reliable.
- FHIR/SMART: validate against the hospital/partner endpoint and agreed scopes.
- HL7: validate real ADT/ORM/ORU samples and transport adapter used by the hospital.
- DICOM/PACS: verify QIDO/WADO/STOW against the real PACS where enabled.
- Insurer/NHIS: verify the real eligibility/claims adapter where enabled.

Do not claim a provider is live merely because the internal integration contract passes.

## 8. Backup before every release

Windows:

```powershell
.\deploy\backup-postgres.ps1
```

Linux/WSL/macOS:

```bash
sh deploy/backup-postgres.sh
```

Backups are written beneath `backups/`, which is intentionally ignored by Git. Copy the dump and SHA-256 file to a protected off-host destination. For managed PostgreSQL, also enable provider-native automated backups and point-in-time recovery.

## 9. Restore drill

Perform destructive restore drills in staging first.

Windows:

```powershell
$env:CAREBRIDGE_CONFIRM_RESTORE = "YES"
.\deploy\restore-postgres.ps1 -Backup ".\backups\carebridge-YYYYMMDDTHHMMSSZ.dump"
```

Linux/WSL/macOS:

```bash
CAREBRIDGE_CONFIRM_RESTORE=YES sh deploy/restore-postgres.sh backups/carebridge-YYYYMMDDTHHMMSSZ.dump
```

The restore tooling stops the app, replaces the PostgreSQL database, restarts CareBridge and waits for `/api/ready` to pass.

## 10. Monitoring and operational ownership

At minimum, alert on:

- `/api/ready` non-200
- repeated HTTP 5xx responses
- PostgreSQL/Redis health failures
- backup failure or stale backup age
- disk/storage exhaustion
- certificate renewal failure
- unusual authentication throttling
- payment webhooks requiring manual review
- unacknowledged clinical-result queues

CareBridge exposes request IDs, W3C `traceparent`, per-route latency/error telemetry and Admin system metrics to support these alerts.

## 11. Release freeze and merge

The release commit is acceptable only when:

1. GitHub CareBridge CI is green on the exact head SHA.
2. Production-mode release certification is green.
3. Browser tests pass against the built production client across Chromium, Firefox, WebKit, Android-sized Chromium and iPhone-sized WebKit.
4. Repository release hygiene passes.
5. The owner visually approves Patient, Doctor, Nurse and Admin workspaces.
6. The deployed HTTPS smoke certificate passes.
7. Enabled real provider integrations have recorded acceptance evidence.
8. A backup exists and restore procedure has been rehearsed.

Only then merge the Premium V6 pull request into `main` and tag the exact merged release.
