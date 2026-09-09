#!/usr/bin/env sh
set -eu

if [ "${CAREBRIDGE_CONFIRM_RESTORE:-}" != "YES" ]; then
  echo "Restore blocked. Set CAREBRIDGE_CONFIRM_RESTORE=YES after verifying the backup and maintenance window." >&2
  exit 2
fi

if [ $# -ne 1 ]; then
  echo "Usage: CAREBRIDGE_CONFIRM_RESTORE=YES deploy/restore-postgres.sh backups/<file>.dump" >&2
  exit 2
fi

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
BACKUP=$1
[ -f "$BACKUP" ] || { echo "Backup not found: $BACKUP" >&2; exit 2; }

ENV_FILE=${CAREBRIDGE_ENV_FILE:-deploy/.env.production}
COMPOSE_FILE=${CAREBRIDGE_COMPOSE_FILE:-docker-compose.production.yml}
REMOTE=/tmp/carebridge-restore.dump

if [ -f "${BACKUP}.sha256" ] && command -v sha256sum >/dev/null 2>&1; then
  (cd "$(dirname "$BACKUP")" && sha256sum -c "$(basename "$BACKUP").sha256")
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop app
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" cp "$BACKUP" "postgres:${REMOTE}"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres sh -lc \
  "dropdb -U carebridge --if-exists carebridge && createdb -U carebridge carebridge && pg_restore -U carebridge -d carebridge --no-owner --no-privileges ${REMOTE} && rm -f ${REMOTE}"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" start app

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T app node -e \
  "let n=0;const t=setInterval(async()=>{n++;try{const r=await fetch('http://127.0.0.1:5000/api/ready');if(r.ok){clearInterval(t);console.log('CareBridge restore health check passed.');process.exit(0)}}catch{}if(n>=40){clearInterval(t);process.exit(1)}},500)"

echo "CareBridge PostgreSQL restore completed from: $BACKUP"
