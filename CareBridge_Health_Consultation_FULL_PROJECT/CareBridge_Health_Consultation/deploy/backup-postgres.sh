#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

ENV_FILE=${CAREBRIDGE_ENV_FILE:-deploy/.env.production}
COMPOSE_FILE=${CAREBRIDGE_COMPOSE_FILE:-docker-compose.production.yml}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
NAME="carebridge-${STAMP}.dump"
DEST="backups/${NAME}"

mkdir -p backups

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  sh -lc "pg_dump -U carebridge -d carebridge -Fc -f /tmp/${NAME}"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" cp "postgres:/tmp/${NAME}" "$DEST"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres rm -f "/tmp/${NAME}"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$DEST" > "${DEST}.sha256"
  cat "${DEST}.sha256"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$DEST" > "${DEST}.sha256"
  cat "${DEST}.sha256"
fi

printf 'CareBridge PostgreSQL backup created: %s\n' "$DEST"
