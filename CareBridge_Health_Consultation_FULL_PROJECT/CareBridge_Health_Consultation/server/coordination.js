import crypto from "crypto";
import { createClient } from "redis";

const PREFIX = process.env.REDIS_PREFIX || "carebridge";
const sessionKey = (id) => `${PREFIX}:session:${id}`;
const cacheKey = (key) => `${PREFIX}:cache:${key}`;
const jobStream = `${PREFIX}:jobs`;
const processedStream = `${PREFIX}:jobs:processed`;

export async function createCoordination(url = process.env.REDIS_URL) {
  if (!url) {
    return {
      enabled: false,
      async ping() { return { ok: false, provider: "none", reason: "REDIS_URL not configured" }; },
      async registerSession() {}, async revokeSession() {}, async sessionActive() { return true; },
      async cacheGet() { return null; }, async cacheSet() {},
      async enqueue() { return null; }, async claim() { return []; }, async complete() {},
      async close() {},
    };
  }

  const client = createClient({ url, socket: { reconnectStrategy: (retries) => Math.min(1000 * (retries + 1), 5000) } });
  let lastError = null;
  client.on("error", (error) => { lastError = error; });
  await client.connect();

  async function ping() {
    const started = Date.now();
    const pong = await client.ping();
    return { ok: pong === "PONG", provider: "redis", latencyMs: Date.now() - started, lastError: lastError?.message || null };
  }

  async function registerSession(id, userId, expiresAt) {
    if (!id || !userId) return;
    const ttl = Math.max(1, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    await client.set(sessionKey(id), JSON.stringify({ userId, expiresAt }), { EX: ttl });
  }

  async function revokeSession(id) {
    if (id) await client.del(sessionKey(id));
  }

  async function sessionActive(id) {
    if (!id) return false;
    return Boolean(await client.exists(sessionKey(id)));
  }

  async function cacheGet(key) {
    const raw = await client.get(cacheKey(key));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  async function cacheSet(key, value, ttlSeconds = 300) {
    await client.set(cacheKey(key), JSON.stringify(value), { EX: Math.max(1, Number(ttlSeconds || 300)) });
  }

  async function enqueue(queue, payload, options = {}) {
    const idempotencyKey = String(options.idempotencyKey || "").trim();
    if (idempotencyKey) {
      const marker = `${PREFIX}:job-idempotency:${queue}:${idempotencyKey}`;
      const first = await client.set(marker, "1", { NX: true, EX: Math.max(60, Number(options.idempotencyTtlSeconds || 86400)) });
      if (!first) return { duplicate: true, idempotencyKey };
    }
    const jobId = options.jobId || crypto.randomUUID();
    const streamId = await client.xAdd(jobStream, "*", {
      jobId,
      queue: String(queue || "default"),
      payload: JSON.stringify(payload ?? {}),
      attempts: "0",
      createdAt: new Date().toISOString(),
      idempotencyKey,
    });
    return { duplicate: false, jobId, streamId };
  }

  async function claim(queue, limit = 10) {
    const rows = await client.xRange(jobStream, "-", "+", { COUNT: Math.max(1, Math.min(100, Number(limit || 10) * 5)) });
    return rows
      .filter((row) => row.message.queue === String(queue))
      .slice(0, Math.max(1, Math.min(100, Number(limit || 10))))
      .map((row) => ({
        streamId: row.id,
        jobId: row.message.jobId,
        queue: row.message.queue,
        payload: (() => { try { return JSON.parse(row.message.payload || "{}"); } catch { return {}; } })(),
        attempts: Number(row.message.attempts || 0),
        createdAt: row.message.createdAt,
        idempotencyKey: row.message.idempotencyKey || "",
      }));
  }

  async function complete(job, result = {}) {
    if (!job?.streamId) return;
    await client.multi()
      .xAdd(processedStream, "*", {
        jobId: job.jobId || "",
        queue: job.queue || "default",
        result: JSON.stringify(result ?? {}),
        completedAt: new Date().toISOString(),
      })
      .xDel(jobStream, job.streamId)
      .exec();
  }

  async function close() {
    if (client.isOpen) await client.quit();
  }

  return { enabled: true, ping, registerSession, revokeSession, sessionActive, cacheGet, cacheSet, enqueue, claim, complete, close };
}
