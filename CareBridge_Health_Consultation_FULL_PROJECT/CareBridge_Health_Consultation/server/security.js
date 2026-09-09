import crypto from "crypto";
import { createClient } from "redis";

const nowMs = () => Date.now();
const requestId = () => crypto.randomUUID();
const hex = (bytes) => crypto.randomBytes(bytes).toString("hex");

function ipOf(req) {
  return String(req.ip || req.socket?.remoteAddress || "unknown").replace(/^::ffff:/, "");
}

function routeClass(req) {
  const path = String(req.path || req.originalUrl || "").split("?")[0];
  if (req.method === "POST" && path === "/api/login") return "login";
  if (req.method === "POST" && path === "/api/register") return "register";
  if (req.method === "POST" && path === "/api/contact") return "contact";
  if (path.startsWith("/api/")) return req.headers.authorization ? "api-auth" : "api-public";
  return "web";
}

const LIMITS = {
  login: { windowMs: 15 * 60_000, max: 8 },
  register: { windowMs: 60 * 60_000, max: 5 },
  contact: { windowMs: 60 * 60_000, max: 12 },
  "api-public": { windowMs: 60_000, max: 120 },
  "api-auth": { windowMs: 60_000, max: 600 },
  web: { windowMs: 60_000, max: 900 },
};

function traceContext(req) {
  const incoming = String(req.headers.traceparent || "").trim();
  const match = incoming.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i);
  const traceId = match?.[1]?.toLowerCase() || hex(16);
  const parentSpanId = match?.[2]?.toLowerCase() || null;
  const flags = match?.[3]?.toLowerCase() || "01";
  const spanId = hex(8);
  return { traceId, spanId, parentSpanId, flags, traceparent: `00-${traceId}-${spanId}-${flags}` };
}

function routeKey(req) {
  const raw = String(req.route?.path || req.path || req.originalUrl || "").split("?")[0];
  return `${req.method} ${raw.replace(/\b(?:[a-f0-9]{8}-[a-f0-9-]{27,}|(?:apt|wb|rx|ord|claim|sess|smart|hl7|dcm)[A-Za-z0-9_-]+)\b/gi, ":id")}`.slice(0, 180);
}

function installDistributedLimiter(stats) {
  if (!process.env.REDIS_URL) return null;
  const client = createClient({ url: process.env.REDIS_URL });
  const state = { client, ready: false, errors: 0, provider: "redis" };
  client.on("error", () => {
    state.ready = false;
    state.errors += 1;
  });
  client.connect()
    .then(() => {
      state.ready = true;
      client.unref?.();
    })
    .catch(() => {
      state.ready = false;
      state.errors += 1;
    });
  stats.rateLimiter = { provider: "redis-with-local-fallback", distributedConfigured: true };
  return state;
}

export function installSecurity(app, { readiness } = {}) {
  const buckets = new Map();
  const stats = {
    startedAt: new Date().toISOString(),
    requests: 0,
    responses4xx: 0,
    responses5xx: 0,
    rateLimited: 0,
    lastRequestAt: null,
    routeLatency: {},
    rateLimiter: { provider: process.env.REDIS_URL ? "redis-with-local-fallback" : "local", distributedConfigured: Boolean(process.env.REDIS_URL) },
  };
  const distributed = installDistributedLimiter(stats);
  app.locals.securityMetrics = stats;

  app.use((req, res, next) => {
    const id = String(req.headers["x-request-id"] || requestId()).slice(0, 128);
    const trace = traceContext(req);
    const started = process.hrtime.bigint();
    req.id = id;
    req.trace = trace;
    res.setHeader("X-Request-Id", id);
    res.setHeader("traceparent", trace.traceparent);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Content-Security-Policy", [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self' ws: wss: https:",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
    ].join("; "));
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    if (String(req.originalUrl || "").startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store, private");
      res.setHeader("Pragma", "no-cache");
    }

    stats.requests += 1;
    stats.lastRequestAt = new Date().toISOString();
    res.on("finish", () => {
      if (res.statusCode >= 500) stats.responses5xx += 1;
      else if (res.statusCode >= 400) stats.responses4xx += 1;
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      const key = routeKey(req);
      const row = stats.routeLatency[key] || { count: 0, totalMs: 0, maxMs: 0, under250Ms: 0, errors: 0, lastAt: null };
      row.count += 1;
      row.totalMs += durationMs;
      row.maxMs = Math.max(row.maxMs, durationMs);
      if (durationMs <= 250) row.under250Ms += 1;
      if (res.statusCode >= 500) row.errors += 1;
      row.lastAt = new Date().toISOString();
      stats.routeLatency[key] = row;
      if (Object.keys(stats.routeLatency).length > 300) {
        const oldest = Object.entries(stats.routeLatency).sort((a, b) => String(a[1].lastAt).localeCompare(String(b[1].lastAt))).slice(0, 50);
        oldest.forEach(([oldKey]) => delete stats.routeLatency[oldKey]);
      }
      if (process.env.LOG_LEVEL === "silent") return;
      const record = {
        level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
        event: "http_request",
        requestId: id,
        traceId: trace.traceId,
        spanId: trace.spanId,
        parentSpanId: trace.parentSpanId,
        method: req.method,
        path: String(req.originalUrl || "").split("?")[0],
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        actorId: req.authUser?.id || null,
        role: req.authUser?.role || null,
      };
      console.log(JSON.stringify(record));
    });
    next();
  });

  app.use(async (req, res, next) => {
    const kind = routeClass(req);
    const limit = LIMITS[kind] || LIMITS.web;
    const ip = ipOf(req);
    const now = nowMs();
    const resetAt = Math.floor(now / limit.windowMs) * limit.windowMs + limit.windowMs;

    if (distributed?.ready) {
      try {
        const slot = Math.floor(now / limit.windowMs);
        const prefix = String(process.env.REDIS_PREFIX || "carebridge").replace(/[^a-zA-Z0-9:_-]/g, "");
        const key = `${prefix}:rate:${kind}:${ip}:${slot}`;
        const result = await distributed.client.multi().incr(key).pExpire(key, limit.windowMs + 5000).exec();
        const count = Number(result?.[0] || 0);
        const remaining = Math.max(0, limit.max - count);
        res.setHeader("RateLimit-Limit", String(limit.max));
        res.setHeader("RateLimit-Remaining", String(remaining));
        res.setHeader("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
        res.setHeader("RateLimit-Policy", "distributed-redis");
        if (count > limit.max) {
          stats.rateLimited += 1;
          const retry = Math.max(1, Math.ceil((resetAt - now) / 1000));
          res.setHeader("Retry-After", String(retry));
          return res.status(429).json({ message: "Too many requests. Please wait and try again.", requestId: req.id, retryAfterSeconds: retry });
        }
        return next();
      } catch {
        distributed.ready = false;
        distributed.errors += 1;
      }
    }

    const key = `${kind}:${ip}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + limit.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    const remaining = Math.max(0, limit.max - bucket.count);
    res.setHeader("RateLimit-Limit", String(limit.max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    res.setHeader("RateLimit-Policy", distributed ? "local-fallback" : "local");
    if (bucket.count > limit.max) {
      stats.rateLimited += 1;
      const retry = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retry));
      return res.status(429).json({ message: "Too many requests. Please wait and try again.", requestId: req.id, retryAfterSeconds: retry });
    }
    if (buckets.size > 5000) {
      for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
    }
    return next();
  });

  app.get("/api/ready", (req, res) => {
    let details = {};
    try { details = typeof readiness === "function" ? readiness() : {}; } catch (error) { details = { error: error.message }; }
    const persistence = details.persistence || {};
    const ready = persistence.readable !== false && persistence.error !== true && !details.error;
    res.status(ready ? 200 : 503).json({
      ok: ready,
      name: "CareBridge API",
      requestId: req.id,
      traceId: req.trace?.traceId,
      uptimeSeconds: Math.round(process.uptime()),
      security: {
        rateLimiting: true,
        distributedRateLimiting: Boolean(distributed),
        rateLimiterReady: distributed ? distributed.ready : true,
        csp: true,
        requestIds: true,
        structuredHttpLogs: true,
        traceContext: true,
        latencySloTelemetry: true,
      },
      ...details,
    });
  });

  return stats;
}
