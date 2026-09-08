import crypto from "crypto";
import { mfaEnabled, verifyUserMfa } from "./mfa.js";

const SESSION_DAYS = Math.max(1, Number(process.env.SESSION_DAYS || 7));
const SESSION_MAX_PER_USER = Math.max(1, Number(process.env.SESSION_MAX_PER_USER || 8));
const PASSWORD_MIN_LENGTH = Math.max(8, Number(process.env.PASSWORD_MIN_LENGTH || 10));
const SCRYPT_KEY_LENGTH = 64;

export const MFA_REQUIRED_TOKEN = "CAREBRIDGE_MFA_REQUIRED";
export const MFA_INVALID_TOKEN = "CAREBRIDGE_MFA_INVALID";

const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const hashUserAgent = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");

export function validatePassword(password) {
  const value = String(password || "");
  const failures = [];
  if (value.length < PASSWORD_MIN_LENGTH) failures.push(`at least ${PASSWORD_MIN_LENGTH} characters`);
  if (!/[A-Za-z]/.test(value)) failures.push("a letter");
  if (!/\d/.test(value)) failures.push("a number");
  const common = new Set(["password", "password123", "12345678", "qwerty123", "admin123", "carebridge"]);
  if (common.has(value.toLowerCase())) failures.push("a less common password");
  return {
    ok: failures.length === 0,
    minLength: PASSWORD_MIN_LENGTH,
    failures,
    message: failures.length ? `Use a password with ${failures.join(", ")}.` : "",
  };
}

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
  const valid = db.sessions.filter((session) => new Date(session.expiresAt || 0).getTime() > now && session.tokenHash);
  if (valid.length !== db.sessions.length) {
    db.sessions = valid;
    changed = true;
  }
  return changed;
}

export function issueSession(db, user, req = null) {
  if (mfaEnabled(db, user.id) && req?.mfaVerified !== true) {
    const mfaCode = String(req?.body?.mfaCode || "").trim();
    if (!mfaCode) return { token: MFA_REQUIRED_TOKEN, expiresAt: null, mfaRequired: true };
    const verified = verifyUserMfa(db, user.id, mfaCode);
    if (!verified.ok) return { token: MFA_INVALID_TOKEN, expiresAt: null, mfaRequired: true, mfaInvalid: true };
    if (req) {
      req.mfaVerified = true;
      req.mfaMethod = verified.method;
    }
  }

  db.sessions = Array.isArray(db.sessions) ? db.sessions : [];
  const raw = crypto.randomBytes(32).toString("base64url");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const activeForUser = db.sessions
    .filter((session) => session.userId === user.id && new Date(session.expiresAt || 0).getTime() > Date.now())
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, Math.max(0, SESSION_MAX_PER_USER - 1));
  const otherUsers = db.sessions.filter((session) => session.userId !== user.id && new Date(session.expiresAt || 0).getTime() > Date.now());
  const userAgent = String(req?.headers?.["user-agent"] || "");
  const sessionId = `sess_${crypto.randomUUID()}`;
  db.sessions = [...otherUsers, ...activeForUser];
  db.sessions.push({
    id: sessionId,
    userId: user.id,
    tokenHash: hashToken(raw),
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    userAgentHash: userAgent ? hashUserAgent(userAgent) : "",
    ip: String(req?.ip || req?.socket?.remoteAddress || "").replace(/^::ffff:/, ""),
    mfaMethod: req?.mfaMethod || null,
  });
  return {
    id: sessionId,
    token: raw,
    expiresAt: expiresAt.toISOString(),
    mfaRequired: false,
    mfaMethod: req?.mfaMethod || null,
  };
}

export function authSessionFromRequest(db, req) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token === MFA_REQUIRED_TOKEN || token === MFA_INVALID_TOKEN) return null;
  const digest = hashToken(token);
  const now = Date.now();
  const session = (db.sessions || []).find(
    (row) => row.tokenHash === digest && new Date(row.expiresAt || 0).getTime() > now
  );
  if (!session) return null;
  if (process.env.SESSION_BIND_USER_AGENT === "true" && session.userAgentHash) {
    const actual = hashUserAgent(req.headers?.["user-agent"] || "");
    if (actual !== session.userAgentHash) return null;
  }
  return session;
}

export function authUserFromRequest(db, req) {
  const session = authSessionFromRequest(db, req);
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

export function revokeAllUserSessions(db, userId, exceptSessionId = "") {
  const before = (db.sessions || []).length;
  db.sessions = (db.sessions || []).filter((row) => row.userId !== userId || (exceptSessionId && row.id === exceptSessionId));
  return before - db.sessions.length;
}

export function activeSessionsForUser(db, userId) {
  const now = Date.now();
  return (db.sessions || [])
    .filter((row) => row.userId === userId && new Date(row.expiresAt || 0).getTime() > now)
    .map(({ tokenHash, ...safe }) => safe)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
