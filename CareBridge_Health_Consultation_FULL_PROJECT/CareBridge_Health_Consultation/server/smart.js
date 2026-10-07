import crypto from "crypto";

const TOKEN_TTL_SECONDS = Math.max(300, Number(process.env.SMART_TOKEN_TTL_SECONDS || 3600));
const DEFAULT_SCOPES = [
  "system/Patient.read",
  "system/Practitioner.read",
  "system/Appointment.read",
  "system/Observation.read",
  "system/Condition.read",
  "system/MedicationRequest.read",
  "system/Encounter.read",
];

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const randomSecret = () => crypto.randomBytes(32).toString("base64url");
const normalizeScopes = (value) => [...new Set(String(value || "").split(/\s+/).map((item) => item.trim()).filter(Boolean))];

function ensureState(db) {
  if (!Array.isArray(db.smartClients)) db.smartClients = [];
  if (!Array.isArray(db.smartAccessTokens)) db.smartAccessTokens = [];
  const now = Date.now();
  db.smartAccessTokens = db.smartAccessTokens.filter((token) => new Date(token.expiresAt || 0).getTime() > now && !token.revokedAt);
  return db;
}

function safeClient(client) {
  const { secretHash, ...safe } = client;
  return safe;
}

function scopeAllowed(allowed, requested) {
  const grant = new Set(allowed || []);
  return requested.every((scope) => grant.has(scope) || grant.has("system/*.read"));
}

export function smartAuthFromRequest(db, req) {
  ensureState(db);
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const tokenHash = sha256(token);
  const row = db.smartAccessTokens.find((item) => item.tokenHash === tokenHash && !item.revokedAt && new Date(item.expiresAt || 0).getTime() > Date.now());
  if (!row) return null;
  const client = db.smartClients.find((item) => item.id === row.clientId && item.status === "active");
  if (!client) return null;
  return {
    kind: "smart",
    clientId: client.id,
    name: client.name,
    scopes: row.scopes || [],
    tokenId: row.id,
    expiresAt: row.expiresAt,
  };
}

export function smartScopeAllows(auth, resourceType, interaction = "read") {
  if (!auth) return false;
  const scopes = new Set(auth.scopes || []);
  if (interaction !== "read") return false;
  return scopes.has("system/*.read") || scopes.has(`system/${resourceType}.read`);
}

export function mountSmart(app, { readDb, writeDb }) {
  app.get("/api/fhir/R4/.well-known/smart-configuration", (req, res) => {
    const root = `${req.protocol}://${req.get("host")}/api`;
    res.json({
      authorization_endpoint: `${root}/smart/authorize`,
      token_endpoint: `${root}/smart/token`,
      token_endpoint_auth_methods_supported: ["client_secret_post"],
      scopes_supported: [...DEFAULT_SCOPES, "system/*.read"],
      response_types_supported: ["token"],
      grant_types_supported: ["client_credentials"],
      capabilities: ["client-confidential-symmetric", "context-standalone-patient", "permission-v2"],
    });
  });

  app.get("/api/smart/authorize", (_req, res) => {
    res.status(400).json({
      error: "unsupported_response_type",
      error_description: "CareBridge currently supports confidential SMART backend services through client_credentials. Interactive authorization-code support is reserved for the external identity-provider deployment profile.",
    });
  });

  app.post("/api/smart/token", (req, res) => {
    const clientId = String(req.body.client_id || "").trim();
    const clientSecret = String(req.body.client_secret || "");
    const grantType = String(req.body.grant_type || "");
    if (grantType !== "client_credentials") return res.status(400).json({ error: "unsupported_grant_type" });
    const db = readDb();
    ensureState(db);
    const client = db.smartClients.find((item) => item.id === clientId && item.status === "active");
    if (!client || sha256(clientSecret) !== client.secretHash) return res.status(401).json({ error: "invalid_client" });
    const requested = normalizeScopes(req.body.scope || client.scopes.join(" "));
    if (!requested.length || !scopeAllowed(client.scopes, requested)) return res.status(400).json({ error: "invalid_scope" });

    const raw = randomSecret();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + TOKEN_TTL_SECONDS * 1000);
    const token = {
      id: `smarttok_${crypto.randomUUID()}`,
      clientId: client.id,
      tokenHash: sha256(raw),
      scopes: requested,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      revokedAt: null,
    };
    db.smartAccessTokens.push(token);
    client.lastTokenAt = issuedAt.toISOString();
    writeDb(db);
    res.json({
      access_token: raw,
      token_type: "Bearer",
      expires_in: TOKEN_TTL_SECONDS,
      scope: requested.join(" "),
    });
  });

  app.get("/api/admin/integrations/smart", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    ensureState(db);
    res.json(db.smartClients.map(safeClient));
  });

  app.post("/api/admin/integrations/smart", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Integration client name is required." });
    const db = readDb();
    ensureState(db);
    const scopes = normalizeScopes(req.body.scopes || DEFAULT_SCOPES.join(" "));
    if (!scopes.length || scopes.some((scope) => !DEFAULT_SCOPES.includes(scope) && scope !== "system/*.read")) {
      return res.status(400).json({ message: "One or more SMART scopes are not allowed." });
    }
    const secret = randomSecret();
    const client = {
      id: `smart_${crypto.randomUUID()}`,
      name,
      status: "active",
      scopes,
      secretHash: sha256(secret),
      createdAt: new Date().toISOString(),
      createdBy: req.authUser.id,
      lastTokenAt: null,
    };
    db.smartClients.push(client);
    writeDb(db);
    res.status(201).json({ ...safeClient(client), clientSecret: secret });
  });

  app.patch("/api/admin/integrations/smart/:id", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    ensureState(db);
    const client = db.smartClients.find((item) => item.id === req.params.id);
    if (!client) return res.status(404).json({ message: "SMART client not found." });
    if (req.body.status && ["active", "revoked"].includes(req.body.status)) client.status = req.body.status;
    if (req.body.scopes) {
      const scopes = normalizeScopes(req.body.scopes);
      if (scopes.some((scope) => !DEFAULT_SCOPES.includes(scope) && scope !== "system/*.read")) return res.status(400).json({ message: "One or more SMART scopes are not allowed." });
      client.scopes = scopes;
    }
    client.updatedAt = new Date().toISOString();
    client.updatedBy = req.authUser.id;
    if (client.status === "revoked") {
      db.smartAccessTokens.forEach((token) => { if (token.clientId === client.id && !token.revokedAt) token.revokedAt = new Date().toISOString(); });
    }
    writeDb(db);
    res.json(safeClient(client));
  });

  app.post("/api/admin/integrations/smart/:id/rotate-secret", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    ensureState(db);
    const client = db.smartClients.find((item) => item.id === req.params.id);
    if (!client) return res.status(404).json({ message: "SMART client not found." });
    const secret = randomSecret();
    client.secretHash = sha256(secret);
    client.updatedAt = new Date().toISOString();
    client.updatedBy = req.authUser.id;
    db.smartAccessTokens.forEach((token) => { if (token.clientId === client.id && !token.revokedAt) token.revokedAt = new Date().toISOString(); });
    writeDb(db);
    res.json({ ...safeClient(client), clientSecret: secret });
  });
}
