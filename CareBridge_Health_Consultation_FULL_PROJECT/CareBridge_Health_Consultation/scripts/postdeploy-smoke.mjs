const base = String(process.env.CAREBRIDGE_BASE_URL || "").replace(/\/$/, "");
if (!base) throw new Error("CAREBRIDGE_BASE_URL is required, for example https://carebridge.example.com");
if (!base.startsWith("https://") && process.env.CAREBRIDGE_SMOKE_ALLOW_HTTP !== "true") {
  throw new Error("Production smoke certification requires HTTPS. Set CAREBRIDGE_SMOKE_ALLOW_HTTP=true only for a controlled local rehearsal.");
}

const timeoutMs = Number(process.env.CAREBRIDGE_SMOKE_TIMEOUT_MS || 12_000);

async function request(path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, { ...init, signal: controller.signal });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { response, body, text };
  } finally {
    clearTimeout(timer);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const health = await request("/api/health");
assert(health.response.ok && health.body?.ok === true, `Health check failed: ${health.response.status} ${health.text}`);
console.log("✓ /api/health");

const ready = await request("/api/ready");
assert(ready.response.ok && ready.body?.ok === true, `Readiness failed: ${ready.response.status} ${ready.text}`);
assert(ready.body?.environment === "production", `Expected production environment, received ${ready.body?.environment}`);
assert(ready.body?.persistence?.provider === "postgres" && ready.body?.persistence?.primaryRuntime === true, "PostgreSQL is not the deployed primary runtime.");
assert(ready.body?.coordination?.ok === true && ready.body?.coordination?.provider === "redis", "Redis coordination is not healthy.");
assert(ready.body?.mfa?.encryptionConfigured === true, "Production MFA encryption key is not active.");
console.log("✓ production readiness: PostgreSQL + Redis + encrypted MFA");

const headers = ready.response.headers;
assert(Boolean(headers.get("strict-transport-security")), "HSTS is missing from production responses.");
assert(Boolean(headers.get("content-security-policy")), "Content-Security-Policy is missing.");
assert(headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options is missing or incorrect.");
assert(headers.get("x-frame-options") === "DENY", "X-Frame-Options is missing or incorrect.");
assert(String(headers.get("cache-control") || "").includes("no-store"), "API responses must be no-store.");
assert(Boolean(headers.get("x-request-id")), "Request correlation ID is missing.");
assert(Boolean(headers.get("traceparent")), "W3C trace context is missing.");
console.log("✓ production security and observability headers");

const shell = await request("/");
assert(shell.response.ok, `Web shell failed: ${shell.response.status}`);
assert(String(shell.response.headers.get("content-type") || "").includes("text/html"), "Production root did not return the CareBridge web application.");
assert(/CareBridge/i.test(String(shell.text || "")), "Production HTML does not identify CareBridge.");
console.log("✓ production web shell");

const email = String(process.env.CAREBRIDGE_SMOKE_EMAIL || "").trim();
const password = String(process.env.CAREBRIDGE_SMOKE_PASSWORD || "");
const role = String(process.env.CAREBRIDGE_SMOKE_ROLE || "").trim();
if (email || password || role) {
  assert(email && password && role, "Authenticated smoke testing requires CAREBRIDGE_SMOKE_EMAIL, CAREBRIDGE_SMOKE_PASSWORD and CAREBRIDGE_SMOKE_ROLE together.");
  const login = await request("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, expectedRole: role }),
  });
  assert(login.response.ok && login.body?.token, `Smoke login failed: ${login.response.status} ${login.text}`);
  assert(login.body?.user?.role === role, `Smoke login returned role ${login.body?.user?.role} instead of ${role}.`);
  const token = login.body.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  const sessions = await request("/api/security/sessions", { headers: authHeaders });
  assert(sessions.response.ok && Array.isArray(sessions.body?.sessions), "Authenticated session inventory failed.");

  const badges = await request(`/api/badges?userId=${encodeURIComponent(login.body.user.id)}&role=${encodeURIComponent(role)}`, { headers: authHeaders });
  assert(badges.response.ok, `Authenticated badge query failed: ${badges.response.status} ${badges.text}`);

  if (role === "admin") {
    const adminReady = await request("/api/admin/system/readiness", { headers: authHeaders });
    assert(adminReady.response.ok && adminReady.body?.ready === true && Number(adminReady.body?.failed || 0) === 0, `Admin readiness is blocked: ${adminReady.text}`);
    console.log(`✓ admin readiness: ${adminReady.body?.grade || "ready"}`);
  }
  console.log(`✓ authenticated ${role} smoke path`);
} else {
  console.log("• authenticated smoke path skipped (set CAREBRIDGE_SMOKE_EMAIL/PASSWORD/ROLE to enable it)");
}

console.log("CareBridge post-deploy smoke certification passed.");
