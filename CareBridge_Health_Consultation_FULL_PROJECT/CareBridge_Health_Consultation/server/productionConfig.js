const nonEmpty = (value) => String(value ?? "").trim();
const truthy = (value) => ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
const number = (value) => Number.parseInt(String(value ?? ""), 10);

const PLACEHOLDER = /(YOUR-|replace-with|change-me|changeme|example-secret|placeholder|dummy|sample-secret)/i;

function httpsOrigins(env) {
  return String(env.CLIENT_URLS || env.CLIENT_URL || "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function secretIssue(name, value, minLength = 24) {
  const text = nonEmpty(value);
  if (!text) return `${name} is required.`;
  if (text.length < minLength) return `${name} must be at least ${minLength} characters.`;
  if (PLACEHOLDER.test(text)) return `${name} still contains a placeholder value.`;
  return null;
}

export function productionConfigurationReport(env = process.env) {
  const issues = [];
  const warnings = [];
  const origins = httpsOrigins(env);
  const appUrl = nonEmpty(env.APP_URL);
  const persistenceProvider = nonEmpty(env.PERSISTENCE_PROVIDER).toLowerCase();
  const smtpPort = number(env.SMTP_PORT);
  const sessionDays = number(env.SESSION_DAYS);
  const sessionCap = number(env.SESSION_MAX_PER_USER);
  const passwordMin = number(env.PASSWORD_MIN_LENGTH);

  if (nonEmpty(env.NODE_ENV) !== "production") issues.push("NODE_ENV must be production for the production runtime.");
  if (persistenceProvider !== "postgres") issues.push("PERSISTENCE_PROVIDER must be postgres in production.");
  if (!nonEmpty(env.DATABASE_URL)) issues.push("DATABASE_URL is required in production.");
  if (!nonEmpty(env.REDIS_URL)) issues.push("REDIS_URL is required in production.");
  if (!truthy(env.REDIS_SESSION_ENFORCE)) issues.push("REDIS_SESSION_ENFORCE must be true in production so revoked sessions are enforced across instances.");

  if (!origins.length) issues.push("CLIENT_URL or CLIENT_URLS is required in production.");
  for (const origin of origins) {
    if (!origin.startsWith("https://")) issues.push(`Production browser origin must use HTTPS: ${origin}`);
  }
  if (!appUrl) issues.push("APP_URL is required in production.");
  else if (!appUrl.startsWith("https://")) issues.push("APP_URL must use HTTPS in production.");

  for (const issue of [
    secretIssue("MFA_ENCRYPTION_KEY", env.MFA_ENCRYPTION_KEY, 32),
    secretIssue("BACKUP_ENCRYPTION_KEY", env.BACKUP_ENCRYPTION_KEY, 32),
    secretIssue("FLW_SECRET_HASH", env.FLW_SECRET_HASH, 24),
  ]) if (issue) issues.push(issue);

  const flutterwaveKey = nonEmpty(env.FLW_SECRET_KEY);
  if (!flutterwaveKey) issues.push("FLW_SECRET_KEY is required in production.");
  else if (PLACEHOLDER.test(flutterwaveKey)) issues.push("FLW_SECRET_KEY still contains a placeholder value.");
  else if (/TEST/i.test(flutterwaveKey) && !truthy(env.CAREBRIDGE_ALLOW_TEST_PAYMENT_KEYS)) {
    issues.push("Flutterwave TEST credentials are blocked in production. Use live credentials or explicitly set CAREBRIDGE_ALLOW_TEST_PAYMENT_KEYS=true for a non-live staging deployment.");
  }

  if (!nonEmpty(env.SMTP_HOST)) issues.push("SMTP_HOST is required in production.");
  if (!Number.isFinite(smtpPort) || smtpPort < 1 || smtpPort > 65535) issues.push("SMTP_PORT must be a valid TCP port.");
  if (!nonEmpty(env.SMTP_USER)) issues.push("SMTP_USER is required in production.");
  if (!nonEmpty(env.SMTP_PASS) || PLACEHOLDER.test(nonEmpty(env.SMTP_PASS))) issues.push("SMTP_PASS must contain a real production secret.");
  if (!nonEmpty(env.SMTP_FROM)) issues.push("SMTP_FROM is required in production.");
  if (String(env.SMTP_REJECT_UNAUTHORIZED ?? "true").toLowerCase() === "false") {
    warnings.push("SMTP_REJECT_UNAUTHORIZED=false weakens TLS certificate verification and should only be used for a controlled private relay.");
  }

  if (!Number.isFinite(sessionDays) || sessionDays < 1 || sessionDays > 7) issues.push("SESSION_DAYS must be between 1 and 7 in production.");
  if (!Number.isFinite(sessionCap) || sessionCap < 1 || sessionCap > 8) issues.push("SESSION_MAX_PER_USER must be between 1 and 8 in production.");
  if (!Number.isFinite(passwordMin) || passwordMin < 10) issues.push("PASSWORD_MIN_LENGTH must be at least 10 in production.");

  if (!truthy(env.BACKUP_REQUIRED)) warnings.push("Set BACKUP_REQUIRED=true in the deployment environment to document that automated database backups are part of the operational contract.");
  if (!truthy(env.CAREBRIDGE_BEHIND_TLS_PROXY)) warnings.push("Set CAREBRIDGE_BEHIND_TLS_PROXY=true when the production app is served behind Caddy, Cloudflare, a load balancer, or another HTTPS reverse proxy.");

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    summary: {
      origins: origins.length,
      postgres: persistenceProvider === "postgres" && Boolean(nonEmpty(env.DATABASE_URL)),
      redis: Boolean(nonEmpty(env.REDIS_URL)),
      distributedSessionEnforcement: truthy(env.REDIS_SESSION_ENFORCE),
      mfaKey: !secretIssue("MFA_ENCRYPTION_KEY", env.MFA_ENCRYPTION_KEY, 32),
      backupKey: !secretIssue("BACKUP_ENCRYPTION_KEY", env.BACKUP_ENCRYPTION_KEY, 32),
      smtp: Boolean(nonEmpty(env.SMTP_HOST) && nonEmpty(env.SMTP_USER) && nonEmpty(env.SMTP_PASS)),
      payments: Boolean(flutterwaveKey && !PLACEHOLDER.test(flutterwaveKey)),
    },
  };
}

export function assertProductionConfiguration(env = process.env) {
  const report = productionConfigurationReport(env);
  if (!report.ok) {
    const error = new Error(`CareBridge production configuration is incomplete:\n- ${report.issues.join("\n- ")}`);
    error.code = "CAREBRIDGE_PRODUCTION_CONFIG_INVALID";
    error.report = report;
    throw error;
  }
  return report;
}
