import fs from "fs";
import { spawn } from "child_process";

const dataFile = process.env.DATA_FILE;
const port = Number(process.env.PORT || 5056);
const base = `http://127.0.0.1:${port}`;
if (!dataFile) throw new Error("DATA_FILE is required");

const seed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const patient = seed.users.find((user) => user.role === "patient" && user.status !== "inactive");
const admin = seed.users.find((user) => user.role === "admin" && user.status !== "inactive");
if (!patient?.email || !patient?.password) throw new Error("Missing seeded patient credentials");
if (!admin?.email || !admin?.password) throw new Error("Missing seeded admin credentials");

const server = spawn(process.execPath, ["index.js"], {
  cwd: new URL(".", import.meta.url),
  env: { ...process.env, DATA_FILE: dataFile, PORT: String(port), LOG_LEVEL: "silent" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (chunk) => { serverLog += chunk; });
server.stderr.on("data", (chunk) => { serverLog += chunk; });
const stop = () => { if (!server.killed) server.kill("SIGTERM"); };
process.on("exit", stop);

async function waitForReady() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (server.exitCode != null) throw new Error(`CareBridge server exited early\n${serverLog}`);
    try {
      const response = await fetch(`${base}/api/ready`);
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`CareBridge server did not become ready\n${serverLog}`);
}

async function raw(path, init = {}) {
  return fetch(`${base}${path}`, init);
}

async function json(path, token = "", init = {}) {
  const headers = { ...(init.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const response = await raw(path, { ...init, headers });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body, text };
}

async function login(user, role) {
  const { response, body, text } = await json("/api/login", "", {
    method: "POST",
    body: JSON.stringify({ email: user.email, password: user.password, expectedRole: role }),
  });
  if (!response.ok || !body?.token) throw new Error(`${role} login failed: ${response.status} ${text}`);
  return body.token;
}

try {
  const readyResponse = await waitForReady();
  const ready = await readyResponse.json();
  if (!ready.ok || ready.security?.rateLimiting !== true || ready.security?.csp !== true || ready.security?.requestIds !== true) {
    throw new Error("Readiness endpoint does not expose active security controls");
  }
  if (ready.persistence?.provider !== "atomic-json" || ready.persistence?.readable !== true) {
    throw new Error("Durable persistence readiness is not healthy");
  }
  console.log("✓ readiness reports security + durable persistence");

  const healthResponse = await raw("/api/health");
  if (!healthResponse.headers.get("x-request-id")) throw new Error("Missing X-Request-Id header");
  if (!healthResponse.headers.get("content-security-policy")?.includes("frame-ancestors 'none'")) throw new Error("Missing hardened CSP header");
  if (!healthResponse.headers.get("cache-control")?.includes("no-store")) throw new Error("API responses are not marked no-store");
  if (healthResponse.headers.get("x-frame-options") !== "DENY") throw new Error("X-Frame-Options is not DENY");
  console.log("✓ security headers + request IDs");

  const weak = await json("/api/register", "", {
    method: "POST",
    body: JSON.stringify({ name: "Weak Password CI", email: `weak-${Date.now()}@carebridge.test`, password: "abc123" }),
  });
  if (weak.response.status !== 400 || weak.body?.passwordPolicy?.ok !== false) {
    throw new Error(`Weak-password policy regression: ${weak.response.status} ${weak.text}`);
  }
  console.log("✓ weak password rejected");

  const token1 = await login(patient, "patient");
  const token2 = await login(patient, "patient");
  const adminToken = await login(admin, "admin");

  const sessionsBefore = await json("/api/security/sessions", token2);
  if (!sessionsBefore.response.ok || !Array.isArray(sessionsBefore.body?.sessions) || sessionsBefore.body.sessions.length < 2) {
    throw new Error("Session inventory did not expose concurrent sessions");
  }
  const revoked = await json("/api/security/sessions/revoke-others", token2, { method: "POST" });
  if (!revoked.response.ok || Number(revoked.body?.revoked || 0) < 1) throw new Error("Revoke-other-sessions did not revoke a prior session");
  const oldSession = await json(`/api/badges?userId=${patient.id}&role=patient`, token1);
  if (oldSession.response.status !== 401) throw new Error(`Revoked session remained valid: ${oldSession.response.status}`);
  const currentSession = await json(`/api/badges?userId=${patient.id}&role=patient`, token2);
  if (!currentSession.response.ok) throw new Error("Current session was revoked accidentally");
  console.log("✓ bounded session inventory + revoke-others");

  const systemReadiness = await json("/api/admin/system/readiness", adminToken);
  if (!systemReadiness.response.ok || !systemReadiness.body?.capabilities?.security?.rateLimiting || !systemReadiness.body?.capabilities?.persistence?.postgresAdapter) {
    throw new Error(`Admin system readiness is missing enterprise capabilities: ${systemReadiness.text}`);
  }
  const metrics = await json("/api/admin/system/metrics", adminToken);
  if (!metrics.response.ok || !Number.isFinite(metrics.body?.process?.rssBytes) || Number(metrics.body?.http?.requests || 0) < 1) {
    throw new Error(`Admin system metrics are invalid: ${metrics.text}`);
  }
  console.log("✓ admin readiness + process/HTTP telemetry");

  let limited = null;
  for (let attempt = 1; attempt <= 9; attempt += 1) {
    const result = await json("/api/login", "", {
      method: "POST",
      headers: { "X-Forwarded-For": "203.0.113.99" },
      body: JSON.stringify({ email: "nobody@carebridge.test", password: "WrongPassword123" }),
    });
    if (attempt <= 8 && result.response.status === 429) throw new Error(`Login limiter activated too early on attempt ${attempt}`);
    if (attempt === 9) limited = result;
  }
  if (limited?.response.status !== 429 || !limited.response.headers.get("retry-after")) {
    throw new Error("Login brute-force limiter did not return 429 + Retry-After");
  }
  console.log("✓ login brute-force throttling");

  for (const suffix of [".sha256", ".bak1", ".journal.ndjson"]) {
    if (!fs.existsSync(`${dataFile}${suffix}`)) throw new Error(`Persistence artifact missing: ${suffix}`);
  }
  const journalLines = fs.readFileSync(`${dataFile}.journal.ndjson`, "utf8").trim().split("\n").filter(Boolean);
  if (!journalLines.length) throw new Error("Persistence journal is empty");
  console.log("✓ atomic persistence checksum + backup + journal");

  console.log("CareBridge security + persistence regression passed.");
} finally {
  stop();
}
