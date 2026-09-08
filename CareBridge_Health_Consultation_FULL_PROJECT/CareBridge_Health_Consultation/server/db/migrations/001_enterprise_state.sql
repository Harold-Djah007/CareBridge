BEGIN;

CREATE TABLE IF NOT EXISTS carebridge_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carebridge_state (
  id text PRIMARY KEY,
  version bigint NOT NULL DEFAULT 1,
  payload jsonb NOT NULL,
  checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carebridge_outbox (
  id uuid PRIMARY KEY,
  topic text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS carebridge_outbox_ready_idx
  ON carebridge_outbox (available_at, created_at)
  WHERE delivered_at IS NULL;

CREATE TABLE IF NOT EXISTS carebridge_audit_events (
  sequence bigserial PRIMARY KEY,
  id uuid NOT NULL UNIQUE,
  actor_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash text,
  event_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS carebridge_audit_entity_idx
  ON carebridge_audit_events (entity_type, entity_id, created_at DESC);

INSERT INTO carebridge_schema_migrations(version)
VALUES ('001_enterprise_state')
ON CONFLICT (version) DO NOTHING;

COMMIT;
