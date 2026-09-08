import { createDurableJsonStore } from "./persistence.js";
import { createPostgresRepository } from "./postgres.js";

const clone = (value) => structuredClone(value);
const VERSION = Symbol("carebridgeStateVersion");

function markVersion(payload, version) {
  if (payload && typeof payload === "object") Object.defineProperty(payload, VERSION, { value: Number(version), enumerable: false, configurable: true });
  return payload;
}

export async function createRuntimeStore(dataFile) {
  const local = createDurableJsonStore(dataFile);
  const requested = String(process.env.PERSISTENCE_PROVIDER || "").toLowerCase();
  const usePostgres = requested === "postgres" || (!requested && process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL));

  if (!usePostgres) {
    return {
      provider: "atomic-json",
      read: () => local.read(),
      write: (db) => local.write(db),
      async refresh() {},
      async flush() {},
      health: () => local.health(),
      async close() {},
    };
  }

  if (!process.env.DATABASE_URL) throw new Error("PERSISTENCE_PROVIDER=postgres requires DATABASE_URL.");
  const repo = createPostgresRepository(process.env.DATABASE_URL);
  await repo.migrate();
  const seed = local.read();
  await repo.seedIfEmpty(seed);
  let state = await repo.loadState();
  if (!state) throw new Error("CareBridge PostgreSQL runtime state could not be initialized.");
  let current = clone(state.payload);
  let currentVersion = Number(state.version);
  let pending = Promise.resolve();
  let lastError = null;
  let lastWriteAt = state.updatedAt || null;
  let lastRefreshAt = new Date().toISOString();
  let lastPing = await repo.ping();

  function read() {
    return markVersion(clone(current), currentVersion);
  }

  async function refresh() {
    await pending;
    const latest = await repo.loadState();
    if (!latest) throw new Error("CareBridge PostgreSQL runtime state disappeared.");
    current = clone(latest.payload);
    currentVersion = Number(latest.version);
    lastRefreshAt = new Date().toISOString();
    return currentVersion;
  }

  function write(db) {
    const expectedVersion = Number(db?.[VERSION] ?? currentVersion);
    const snapshot = clone(db);
    pending = pending.then(async () => {
      try {
        const saved = await repo.saveState(snapshot, { expectedVersion });
        current = clone(snapshot);
        currentVersion = Number(saved.version);
        lastWriteAt = saved.updatedAt;
        lastError = null;
        return saved;
      } catch (error) {
        lastError = error;
        throw error;
      }
    });
    pending.catch(() => {});
    return pending;
  }

  async function flush() {
    return pending;
  }

  function health() {
    return {
      provider: "postgres",
      primaryRuntime: true,
      transactional: true,
      optimisticConcurrency: true,
      migrations: true,
      durableOutbox: true,
      tamperEvidentAudit: true,
      version: currentVersion,
      lastWriteAt,
      lastRefreshAt,
      lastPing,
      error: lastError?.message || "",
    };
  }

  const pingTimer = setInterval(async () => {
    try { lastPing = await repo.ping(); lastError = null; }
    catch (error) { lastError = error; lastPing = { ok: false, error: error.message }; }
  }, Math.max(5000, Number(process.env.PG_HEALTH_INTERVAL_MS || 30000)));
  pingTimer.unref?.();

  async function close() {
    clearInterval(pingTimer);
    await pending.catch(() => {});
    await repo.close();
  }

  return { provider: "postgres", read, write, refresh, flush, health, close };
}
