export function smtpOptions(env = process.env) {
  const port = Number(env.SMTP_PORT || 587);
  const production = env.NODE_ENV === "production";
  return {
    host: env.SMTP_HOST,
    port,
    secure: env.SMTP_SECURE === "true" || port === 465,
    requireTLS: production || env.SMTP_REQUIRE_TLS === "true",
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    tls: { rejectUnauthorized: production || env.SMTP_REJECT_UNAUTHORIZED !== "false" },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  };
}

export function assertAcceptedEmail(info) {
  if (!Array.isArray(info?.accepted) || !info.accepted.length || info.rejected?.length) {
    throw new Error("The mail server did not accept every recipient.");
  }
}
