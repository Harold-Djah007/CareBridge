import crypto from "crypto";

const nowMs = () => Date.now();
const requestId = () => crypto.randomUUID();

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

export function installSecurity(app, { readiness } = {}) {
  const buckets = new Map();
  const stats = {
    startedAt: new Date().toISOString(),
    requests: 0,
    responses4xx: 0,
    responses5xx: 0,
    rateLimited: 0,
    lastRequestAt: null,
  };
  app.locals.securityMetrics = stats;

  app.use((req, res, next) => {
    const id = String(req.headers["x-request-id"] || requestId()).slice(0, 128);
    const started = process.hrtime.bigint();
    req.id = id;
    res.setHeader("X-Request-Id", id);
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
      if (process.env.LOG_LEVEL === "silent") return;
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      const record = {
        level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
        event: "http_request",
        requestId: id,
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

  app.use((req, res, next) => {
    const kind = routeClass(req);
    const limit = LIMITS[kind] || LIMITS.web;
    const key = `${kind}:${ipOf(req)}`;
    const now = nowMs();
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
    const ready = persistence.readable !== false && !details.error;
    res.status(ready ? 200 : 503).json({
      ok: ready,
      name: "CareBridge API",
      requestId: req.id,
      uptimeSeconds: Math.round(process.uptime()),
      security: { rateLimiting: true, csp: true, requestIds: true, structuredHttpLogs: true },
      ...details,
    });
  });

  return stats;
}
