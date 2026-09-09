import { createDurableJsonStore } from "./persistence.js";
import { createPostgresRepository } from "./postgres.js";

const clone = (value) => structuredClone(value);
const VERSION = Symbol("carebridgeStateVersion");

function markVersion(payload, version) {
  if (payload && typeof payload === "object") Object.defineProperty(payload, VERSION, { value: Number(version), enumerable: false, configurable: true, writable: true });
  return payload;
}

function staleWrite(expectedVersion, currentVersion) {
  const error = new Error(`Stale CareBridge state write: expected version ${expectedVersion}, current version ${currentVersion}.`);
  error.code = "CAREBRIDGE_STALE_WRITE";
  return error;
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
  const state = await repo.loadState();
  if (!state) throw new Error("CareBridge PostgreSQL runtime state could not be initialized.");

  // `currentVersion` is the version reserved by this process, including writes
  // already queued but not yet committed. This is important because a single
  // HTTP request can legitimately persist normalization/auth state and then a
  // business mutation before the first write has reached PostgreSQL.
  let current = clone(state.payload);
  let currentVersion = Number(state.version);
  let committedVersion = Number(state.version);
  let pending = Promise.resolve();
  let lastError = null;
  let lastWriteAt = state.updatedAt || null;
  let lastRefreshAt = new Date().toISOString();
  let lastPing = await repo.ping();

  function read() {
    return markVersion(clone(current), currentVersion);
  }

  async function recoverFromDatabase(error) {
    lastError = error;
    try {
      const latest = await repo.loadState();
      if (latest) {
        current = clone(latest.payload);
        currentVersion = Number(latest.version);
        committedVersion = Number(latest.version);
        lastRefreshAt = new Date().toISOString();
      }
    } catch (refreshError) {
      lastError = refreshError;
    }
  }

  async function refresh() {
    try {
      await pending;
    } catch (error) {
      await recoverFromDatabase(error);
      throw error;
    }
    const latest = await repo.loadState();
    if (!latest) throw new Error("CareBridge PostgreSQL runtime state disappeared.");
    current = clone(latest.payload);
    currentVersion = Number(latest.version);
    committedVersion = Number(latest.version);
    lastRefreshAt = new Date().toISOString();
    lastError = null;
    return currentVersion;
  }

  function write(db) {
    const expectedVersion = Number(db?.[VERSION] ?? currentVersion);

    // Detect a genuinely stale object in-process before it can overwrite a
    // newer queued mutation. A fresh read always carries currentVersion.
    if (expectedVersion !== currentVersion) {
      const error = staleWrite(expectedVersion, currentVersion);
      lastError = error;
      return Promise.reject(error);
    }

    const snapshot = clone(db);
    const reservedVersion = expectedVersion + 1;

    // Reserve the next version immediately so a second read/write in the same
    // request lineage builds on the queued snapshot rather than the last
    // committed snapshot. PostgreSQL still performs the authoritative
    // expected-version check when each queued operation reaches the database.
    current = clone(snapshot);
    currentVersion = reservedVersion;
    markVersion(db, reservedVersion);

    const operation = pending.then(async () => {
      const saved = await repo.saveState(snapshot, { expectedVersion });
      if (Number(saved.version) !== reservedVersion) {
        throw staleWrite(reservedVersion, Number(saved.version));
      }
      committedVersion = Number(saved.version);
      lastWriteAt = saved.updatedAt;
      lastError = null;
      return saved;
    });

    pending = operation.catch(async (error) => {
      await recoverFromDatabase(error);
      throw error;
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
      committedVersion,
      queuedWrites: Math.max(0, currentVersion - committedVersion),
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
