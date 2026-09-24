import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, "db", "migrations");

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

const stableJson = (value) => JSON.stringify(canonical(value));
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");

export function createPostgresRepository(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL persistence.");
  const pool = new Pool({
    connectionString,
    max: Math.max(2, Number(process.env.PG_POOL_MAX || 10)),
    idleTimeoutMillis: Math.max(1000, Number(process.env.PG_IDLE_TIMEOUT_MS || 30_000)),
    connectionTimeoutMillis: Math.max(1000, Number(process.env.PG_CONNECT_TIMEOUT_MS || 5_000)),
    ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== "false" } : false,
  });

  async function migrate() {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`CREATE TABLE IF NOT EXISTS carebridge_schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
      const files = fs.readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql")).sort();
      for (const file of files) {
        const version = file.replace(/\.sql$/, "");
        const done = await client.query("SELECT 1 FROM carebridge_schema_migrations WHERE version = $1", [version]);
        if (done.rowCount) continue;
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
          .replace(/^BEGIN;\s*/i, "")
          .replace(/\s*COMMIT;\s*$/i, "");
        await client.query(sql);
        await client.query("INSERT INTO carebridge_schema_migrations(version) VALUES ($1) ON CONFLICT DO NOTHING", [version]);
      }
      await client.query("COMMIT");
      return { applied: files.length };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function ping() {
    const started = Date.now();
    const result = await pool.query("SELECT now() AS now, current_database() AS database");
    return { ok: true, database: result.rows[0].database, serverTime: result.rows[0].now, latencyMs: Date.now() - started };
  }

  async function loadState(id = "primary") {
    const result = await pool.query("SELECT id, version, payload, checksum, created_at, updated_at FROM carebridge_state WHERE id = $1", [id]);
    if (!result.rowCount) return null;
    const row = result.rows[0];
    const raw = stableJson(row.payload);
    if (digest(raw) !== row.checksum) throw new Error(`PostgreSQL state checksum mismatch for ${id}`);
    return {
      id: row.id,
      version: Number(row.version),
      payload: row.payload,
      checksum: row.checksum,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async function seedIfEmpty(payload, id = "primary") {
    const raw = stableJson(payload);
    const checksum = digest(raw);
    const result = await pool.query(
      `INSERT INTO carebridge_state(id, version, payload, checksum)
       VALUES ($1, 1, $2::jsonb, $3)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, version, checksum`,
      [id, raw, checksum]
    );
    return { inserted: result.rowCount === 1, state: await loadState(id) };
  }

  async function saveState(payload, { id = "primary", expectedVersion = null, outbox = [] } = {}) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query("SELECT version FROM carebridge_state WHERE id = $1 FOR UPDATE", [id]);
      if (!current.rowCount) throw new Error(`PostgreSQL CareBridge state ${id} does not exist.`);
      const version = Number(current.rows[0].version);
      if (expectedVersion !== null && Number(expectedVersion) !== version) {
        const error = new Error(`Stale CareBridge state write: expected version ${expectedVersion}, current version ${version}.`);
        error.code = "CAREBRIDGE_STALE_WRITE";
        throw error;
      }
      const raw = stableJson(payload);
      const checksum = digest(raw);
      const nextVersion = version + 1;
      await client.query(
        `UPDATE carebridge_state
         SET version = $2, payload = $3::jsonb, checksum = $4, updated_at = now()
         WHERE id = $1`,
        [id, nextVersion, raw, checksum]
      );
      for (const event of outbox) {
        await client.query(
          `INSERT INTO carebridge_outbox(id, topic, aggregate_type, aggregate_id, payload)
           VALUES ($1, $2, $3, $4, $5::jsonb)`,
          [event.id || crypto.randomUUID(), event.topic, event.aggregateType || "system", event.aggregateId || id, stableJson(event.payload || {})]
        );
      }
      await client.query("COMMIT");
      return { id, version: nextVersion, checksum, updatedAt: new Date().toISOString() };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function appendAudit({ actorId = "", action, entityType, entityId = "", detail = {} }) {
    if (!action || !entityType) throw new Error("Audit action and entityType are required.");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const previous = await client.query("SELECT event_hash FROM carebridge_audit_events ORDER BY sequence DESC LIMIT 1 FOR UPDATE");
      const previousHash = previous.rows[0]?.event_hash || "";
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const body = stableJson({ id, actorId, action, entityType, entityId, detail, previousHash, createdAt });
      const eventHash = digest(body);
      await client.query(
        `INSERT INTO carebridge_audit_events(id, actor_id, action, entity_type, entity_id, detail, previous_hash, event_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
        [id, actorId || null, action, entityType, entityId || null, stableJson(detail || {}), previousHash || null, eventHash, createdAt]
      );
      await client.query("COMMIT");
      return { id, eventHash, previousHash, createdAt };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function claimOutbox(limit = 20) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `WITH picked AS (
           SELECT id FROM carebridge_outbox
           WHERE delivered_at IS NULL AND available_at <= now() AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
           ORDER BY created_at
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         UPDATE carebridge_outbox o
         SET locked_at = now(), attempts = attempts + 1
         FROM picked
         WHERE o.id = picked.id
         RETURNING o.*`,
        [Math.max(1, Math.min(100, Number(limit) || 20))]
      );
      await client.query("COMMIT");
      return result.rows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function markOutboxDelivered(id) {
    await pool.query("UPDATE carebridge_outbox SET delivered_at = now(), locked_at = NULL, last_error = NULL WHERE id = $1", [id]);
  }

  async function close() {
    await pool.end();
  }

  return { migrate, ping, loadState, seedIfEmpty, saveState, appendAudit, claimOutbox, markOutboxDelivered, close };
}
