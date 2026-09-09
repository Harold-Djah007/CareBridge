import fs from "fs";
import { spawn } from "child_process";
import { productionConfigurationReport } from "./productionConfig.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for production release certification.");
if (!process.env.REDIS_URL) throw new Error("REDIS_URL is required for production release certification.");
if (!process.env.DATA_FILE) throw new Error("DATA_FILE is required for production release certification.");

const seed = JSON.parse(fs.readFileSync(process.env.DATA_FILE, "utf8"));
const admin = (seed.users || []).find((user) => user.role === "admin" && user.status !== "inactive");
if (!admin?.email || !admin?.password) throw new Error("Seed administrator credentials are required for production release certification.");

const port = 5063;
const base = `http://127.0.0.1:${port}`;
const productionEnv = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: "production",
  LOG_LEVEL: "silent",
  DATA_FILE: process.env.DATA_FILE,
  PERSISTENCE_PROVIDER: "postgres",
  REDIS_SESSION_ENFORCE: "true",
  CLIENT_URL: "https://carebridge-ci.example",
  APP_URL: "https://carebridge-ci.example",
  SESSION_DAYS: "7",
  SESSION_MAX_PER_USER: "8",
  PASSWORD_MIN_LENGTH: "10",
  MFA_ENCRYPTION_KEY: "carebridge-ci-mfa-encryption-key-2026-strong",
  BACKUP_ENCRYPTION_KEY: "carebridge-ci-backup-encryption-key-2026-strong",
  BACKUP_REQUIRED: "true",
  CAREBRIDGE_BEHIND_TLS_PROXY: "true",
  FLW_SECRET_KEY: "FLWSECK-LIVE-CI-CONTRACT-0123456789",
  FLW_SECRET_HASH: "carebridge-ci-webhook-secret-hash-2026",
  CAREBRIDGE_ALLOW_TEST_PAYMENT_KEYS: "false",
  SMTP_HOST: "smtp.carebridge-ci.invalid",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_REQUIRE_TLS: "true",
  SMTP_REJECT_UNAUTHORIZED: "true",
  SMTP_USER: "ci@carebridge.example",
  SMTP_PASS: "carebridge-ci-smtp-password-2026-strong",
  SMTP_FROM: "CareBridge CI <ci@carebridge.example>",
};

const configReport = productionConfigurationReport(productionEnv);
if (!configReport.ok) throw new Error(`Production configuration contract failed:\n${configReport.issues.join("\n")}`);
const unsafeReport = productionConfigurationReport({
  ...productionEnv,
  DATABASE_URL: "",
  REDIS_URL: "",
  REDIS_SESSION_ENFORCE: "false",
  CLIENT_URL: "http://carebridge.invalid",
  APP_URL: "http://carebridge.invalid",
  MFA_ENCRYPTION_KEY: "short",
});
if (unsafeReport.ok || unsafeReport.issues.length < 5) throw new Error("Unsafe production configuration was not rejected strongly enough.");
console.log("✓ fail-fast production configuration contract + negative safety cases");

const child = spawn(process.execPath, ["index.js"], {
  cwd: new URL(".", import.meta.url),
  env: productionEnv,
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
child.stdout.on("data", (chunk) => { log += chunk; });
child.stderr.on("data", (chunk) => { log += chunk; });

async function waitReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode != null) throw new Error(`Production CareBridge runtime exited early.\n${log}`);
    try {
      const response = await fetch(`${base}/api/ready`);
      if (response.ok) {
        const body = await response.json();
        if (body?.security?.distributedRateLimiting && body?.security?.rateLimiterReady === false) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          continue;
        }
        return { response, body };
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Production CareBridge runtime did not become ready.\n${log}`);
}

async function request(path, token = "", init = {}) {
  const headers = { ...(init.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body, text };
}

async function stop() {
  if (child.exitCode != null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Production release runtime did not stop gracefully.")), 6000)),
  ]);
}

try {
  const ready = await waitReady();
  if (ready.body?.environment !== "production") throw new Error(`Production environment not reported: ${JSON.stringify(ready.body)}`);
  if (ready.body?.persistence?.provider !== "postgres" || ready.body?.persistence?.primaryRuntime !== true) {
    throw new Error(`PostgreSQL is not the production system of record: ${JSON.stringify(ready.body?.persistence)}`);
  }
  if (ready.body?.coordination?.ok !== true || ready.body?.coordination?.provider !== "redis") {
    throw new Error(`Redis production coordination is not ready: ${JSON.stringify(ready.body?.coordination)}`);
  }
  if (ready.body?.security?.distributedRateLimiting !== true || ready.body?.security?.rateLimiterReady !== true) {
    throw new Error(`Distributed Redis rate limiting is not ready: ${JSON.stringify(ready.body?.security)}`);
  }
  if (ready.body?.mfa?.encryptionConfigured !== true) throw new Error("Production MFA encryption is not configured.");
  if (!ready.response.headers.get("strict-transport-security")) throw new Error("Production HSTS header is missing.");
  if (!ready.response.headers.get("content-security-policy")) throw new Error("Production CSP header is missing.");
  console.log("✓ production runtime: PostgreSQL + Redis coordination/throttling + MFA key + HSTS/CSP");

  const login = await request("/api/login", "", {
    method: "POST",
    body: JSON.stringify({ email: admin.email, password: admin.password, expectedRole: "admin" }),
  });
  if (!login.response.ok || !login.body?.token) throw new Error(`Production admin login failed: ${login.response.status} ${login.text}\n${log}`);
  if (login.response.headers.get("ratelimit-policy") !== "distributed-redis") {
    throw new Error(`Production login did not use distributed Redis throttling: ${login.response.headers.get("ratelimit-policy")}`);
  }

  const readiness = await request("/api/admin/system/readiness", login.body.token);
  if (!readiness.response.ok || readiness.body?.ready !== true || Number(readiness.body?.failed || 0) !== 0) {
    throw new Error(`Admin production readiness is blocked: ${readiness.response.status} ${readiness.text}`);
  }
  console.log(`✓ admin production readiness: ${readiness.body?.grade || "ready"}`);

  const capabilities = await request("/api/admin/system/capabilities", login.body.token);
  if (!capabilities.response.ok) throw new Error(`Capabilities endpoint failed: ${capabilities.response.status} ${capabilities.text}`);
  const cap = capabilities.body?.capabilities || capabilities.body;
  if (cap?.persistence?.postgresPrimaryRuntime !== true) throw new Error("Capabilities do not report PostgreSQL primary runtime.");
  if (cap?.coordination?.redisConfigured !== true) throw new Error("Capabilities do not report Redis coordination.");
  if (cap?.security?.mfa?.productionKeyConfigured !== true) throw new Error("Capabilities do not report production MFA key.");
  if (cap?.communications?.smtp !== true) throw new Error("Capabilities do not report SMTP configuration.");
  console.log("✓ production capability contract: persistence, coordination, security, SMTP");

  const sessions = await request("/api/security/sessions", login.body.token);
  if (!sessions.response.ok || !Array.isArray(sessions.body?.sessions)) throw new Error("Production session inventory is unavailable.");
  console.log("✓ authenticated production session control");

  console.log("CareBridge production release certification passed.");
} finally {
  await stop().catch(() => {});
}
