import crypto from "crypto";

const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

function encryptionKey() {
  const configured = String(process.env.MFA_ENCRYPTION_KEY || "");
  const material = configured || "CAREBRIDGE-DEVELOPMENT-MFA-KEY-CHANGE-IN-PRODUCTION";
  return crypto.createHash("sha256").update(material).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decrypt(value) {
  const [version, iv64, tag64, body64] = String(value || "").split(".");
  if (version !== "v1" || !iv64 || !tag64 || !body64) throw new Error("Invalid MFA secret envelope.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv64, "base64url"));
  decipher.setAuthTag(Buffer.from(tag64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body64, "base64url")), decipher.final()]).toString("utf8");
}

function encodeBase32(buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    output += BASE32[Number.parseInt(chunk, 2)];
  }
  return output;
}

function decodeBase32(value) {
  const normalized = String(value || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of normalized) {
    const index = BASE32.indexOf(char);
    if (index >= 0) bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret, counter) {
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % (10 ** DIGITS));
  return String(code).padStart(DIGITS, "0");
}

function mfaMap(db) {
  db.securityMfa = db.securityMfa && typeof db.securityMfa === "object" ? db.securityMfa : {};
  return db.securityMfa;
}

function account(db, userId) {
  return mfaMap(db)[userId] || null;
}

function generateRecoveryCodes() {
  return Array.from({ length: 8 }, () => `${crypto.randomBytes(3).toString("hex").toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`);
}

export function totp(secret, at = Date.now()) {
  return hotp(secret, Math.floor(at / 1000 / STEP_SECONDS));
}

export function verifyTotp(secret, code, at = Date.now(), window = 1) {
  const candidate = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(candidate)) return false;
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  for (let drift = -window; drift <= window; drift += 1) {
    const expected = hotp(secret, counter + drift);
    const left = Buffer.from(candidate);
    const right = Buffer.from(expected);
    if (left.length === right.length && crypto.timingSafeEqual(left, right)) return true;
  }
  return false;
}

export function ensureMfaState(db) {
  mfaMap(db);
  return db;
}

export function beginEnrollment(db, user) {
  const secret = encodeBase32(crypto.randomBytes(20));
  const current = account(db, user.id) || {};
  mfaMap(db)[user.id] = {
    ...current,
    pending: {
      secret: encrypt(secret),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    },
  };
  const label = encodeURIComponent(`CareBridge:${user.email}`);
  const issuer = encodeURIComponent("CareBridge Health");
  return {
    secret,
    otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`,
    expiresAt: mfaMap(db)[user.id].pending.expiresAt,
  };
}

export function confirmEnrollment(db, user, code) {
  const record = account(db, user.id);
  const pending = record?.pending;
  if (!pending || new Date(pending.expiresAt || 0).getTime() <= Date.now()) return { ok: false, message: "MFA setup expired. Start setup again." };
  let secret;
  try { secret = decrypt(pending.secret); } catch { return { ok: false, message: "MFA setup could not be verified." }; }
  if (!verifyTotp(secret, code)) return { ok: false, message: "That authenticator code is not valid." };
  const codes = generateRecoveryCodes();
  mfaMap(db)[user.id] = {
    enabled: true,
    method: "totp",
    secret: encrypt(secret),
    recoveryHashes: codes.map((value) => sha256(value.toUpperCase())),
    enabledAt: new Date().toISOString(),
  };
  return { ok: true, recoveryCodes: codes, enabledAt: mfaMap(db)[user.id].enabledAt };
}

export function regenerateRecoveryCodes(db, userId, verificationCode) {
  const verified = verifyUserMfa(db, userId, verificationCode, { consumeRecovery: false });
  if (!verified.ok || verified.method !== "totp") return { ok: false, message: "Verify with your authenticator code before replacing recovery codes." };
  const codes = generateRecoveryCodes();
  const record = account(db, userId);
  record.recoveryHashes = codes.map((value) => sha256(value.toUpperCase()));
  record.recoveryCodesRegeneratedAt = new Date().toISOString();
  return { ok: true, recoveryCodes: codes };
}

export function disableMfa(db, userId) {
  delete mfaMap(db)[userId];
}

export function mfaStatus(db, userId) {
  const record = account(db, userId);
  return {
    enabled: record?.enabled === true,
    method: record?.enabled ? record.method || "totp" : null,
    enabledAt: record?.enabledAt || null,
    recoveryCodesRemaining: Array.isArray(record?.recoveryHashes) ? record.recoveryHashes.length : 0,
    enrollmentPending: Boolean(record?.pending && new Date(record.pending.expiresAt || 0).getTime() > Date.now()),
  };
}

export function verifyUserMfa(db, userId, input, { consumeRecovery = false } = {}) {
  const record = account(db, userId);
  if (!record?.enabled || !record.secret) return { ok: false, method: "none" };
  const candidate = String(input || "").trim();
  if (/^\d{6}$/.test(candidate)) {
    try {
      return { ok: verifyTotp(decrypt(record.secret), candidate), method: "totp" };
    } catch {
      return { ok: false, method: "totp" };
    }
  }
  const hash = sha256(candidate.toUpperCase());
  const index = (record.recoveryHashes || []).findIndex((item) => item === hash);
  if (index >= 0) {
    if (consumeRecovery) record.recoveryHashes.splice(index, 1);
    return { ok: true, method: "recovery" };
  }
  return { ok: false, method: "recovery" };
}

export function mfaEnabled(db, userId) {
  return account(db, userId)?.enabled === true;
}

export function mfaEncryptionConfigured() {
  return Boolean(process.env.MFA_ENCRYPTION_KEY);
}
