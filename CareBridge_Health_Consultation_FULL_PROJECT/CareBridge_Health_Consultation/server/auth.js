import crypto from "crypto";

const SESSION_DAYS = Math.max(1, Number(process.env.SESSION_DAYS || 7));
const SCRYPT_KEY_LENGTH = 64;

const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

export function hashPassword(password) {
  const value = String(password || "");
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(value, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function passwordMatches(password, stored) {
  const candidate = String(password || "");
  const value = String(stored || "");
  if (!value.startsWith("scrypt$")) return candidate === value;
  const [, salt, expectedHex] = value.split("$");
  if (!salt || !expectedHex) return false;
  try {
    const actual = crypto.scryptSync(candidate, salt, SCRYPT_KEY_LENGTH);
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function ensurePasswordSecurity(db) {
  let changed = false;
  for (const user of db.users || []) {
    if (user.password && !String(user.password).startsWith("scrypt$")) {
      user.password = hashPassword(user.password);
      changed = true;
    }
  }
  db.sessions = Array.isArray(db.sessions) ? db.sessions : [];
  const now = Date.now();
  const valid = db.sessions.filter((session) => new Date(session.expiresAt || 0).getTime() > now);
  if (valid.length !== db.sessions.length) {
    db.sessions = valid;
    changed = true;
  }
  return changed;
}

export function issueSession(db, user) {
  db.sessions = Array.isArray(db.sessions) ? db.sessions : [];
  const raw = crypto.randomBytes(32).toString("base64url");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.sessions = db.sessions.filter((session) => session.userId !== user.id || new Date(session.expiresAt || 0).getTime() > Date.now());
  db.sessions.push({
    id: `sess_${crypto.randomUUID()}`,
    userId: user.id,
    tokenHash: hashToken(raw),
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
  return { token: raw, expiresAt: expiresAt.toISOString() };
}

export function authUserFromRequest(db, req) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const digest = hashToken(token);
  const now = Date.now();
  const session = (db.sessions || []).find(
    (row) => row.tokenHash === digest && new Date(row.expiresAt || 0).getTime() > now
  );
  if (!session) return null;
  return (db.users || []).find((user) => user.id === session.userId && user.status !== "inactive") || null;
}

export function revokeSession(db, req) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  const digest = hashToken(token);
  const before = (db.sessions || []).length;
  db.sessions = (db.sessions || []).filter((row) => row.tokenHash !== digest);
  return db.sessions.length !== before;
}
