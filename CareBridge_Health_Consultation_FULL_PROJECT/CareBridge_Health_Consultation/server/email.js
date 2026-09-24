import nodemailer from "nodemailer";

let transportPromise = null;

const FROM = process.env.SMTP_FROM || "CareBridge Health <alerts@carebridge.health>";
const IS_PRODUCTION = String(process.env.NODE_ENV || "").toLowerCase() === "production";

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

async function getTransport() {
  if (transportPromise) return transportPromise;
  transportPromise = (async () => {
    if (process.env.SMTP_HOST) {
      const port = Number(process.env.SMTP_PORT || 587);
      return {
        mode: "smtp",
        transporter: nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port,
          secure: process.env.SMTP_SECURE === "true" || port === 465,
          requireTLS: process.env.SMTP_REQUIRE_TLS === "true",
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
          tls: process.env.SMTP_REJECT_UNAUTHORIZED === "false"
            ? { rejectUnauthorized: false }
            : undefined,
        }),
      };
    }

    // Local development gets a safe Ethereal preview inbox. Production never
    // silently pretends that an email was delivered when SMTP is not configured.
    if (!IS_PRODUCTION) {
      try {
        const test = await nodemailer.createTestAccount();
        return {
          mode: "preview",
          transporter: nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: { user: test.user, pass: test.pass },
          }),
        };
      } catch {
        return { mode: "none", transporter: null };
      }
    }

    return { mode: "none", transporter: null };
  })();
  return transportPromise;
}

async function sendWithRetry(transporter, message, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await transporter.sendMail(message);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  throw lastError;
}

export function renderEmail({ heading, intro, details = [], closing }) {
  const rows = details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 0;color:#5c6f6b;font-size:13px;width:140px">${escapeHtml(label)}</td><td style="padding:8px 0;color:#12211e;font-size:14px;font-weight:600">${escapeHtml(value)}</td></tr>`
    )
    .join("");
  return `<!DOCTYPE html>
<html><body style="margin:0;background:#f4f0e6;font-family:Arial,Helvetica,sans-serif;color:#12211e">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;background:#f4f0e6">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:100%;background:#fffdf8;border:1px solid #ddd6c8;border-radius:18px;overflow:hidden">
        <tr><td style="background:#0b5f56;color:#fff;padding:22px 28px">
          <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;opacity:.8">CareBridge Health</div>
          <div style="font-size:26px;margin-top:6px;font-weight:700">${escapeHtml(heading)}</div>
        </td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6">${escapeHtml(intro)}</p>
          ${rows ? `<table width="100%" style="margin:12px 0 18px;border-collapse:collapse">${rows}</table>` : ""}
          <p style="margin:0;color:#5c6f6b;font-size:14px;line-height:1.6">${escapeHtml(closing)}</p>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f7f3ea;color:#5c6f6b;font-size:12px;line-height:1.5">
          You received this because email alerts are enabled in your CareBridge profile. Sign in to manage notification preferences.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function deliverEmail(db, { userId, to, subject, text, html, type }) {
  const queuedAt = new Date().toISOString();
  const record = {
    id: `e${Date.now()}${Math.floor(Math.random() * 1000)}`,
    userId,
    to,
    subject,
    text,
    type,
    status: "queued",
    provider: null,
    messageId: null,
    previewUrl: null,
    queuedAt,
    sentAt: null,
  };

  try {
    const { transporter, mode } = await getTransport();
    record.provider = mode;

    if (!transporter) {
      record.status = "not_configured";
      record.error = IS_PRODUCTION
        ? "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM."
        : "No SMTP or development preview transport is available.";
    } else {
      const info = await sendWithRetry(transporter, { from: FROM, to, subject, text, html });
      record.messageId = info.messageId || null;
      record.sentAt = new Date().toISOString();
      if (mode === "preview") {
        record.status = "preview";
        record.previewUrl = nodemailer.getTestMessageUrl(info) || null;
      } else {
        record.status = "sent";
      }
    }
  } catch (error) {
    record.status = "failed";
    record.error = error?.message || "Email delivery failed.";
  }

  db.emails = db.emails || [];
  db.emails.push(record);
  return record;
}

const defaultPrefs = {
  appointments: true,
  wards: true,
  messages: true,
  account: true,
  support: true,
};

export function shouldEmail(user, type) {
  if (!user || !user.email) return false;
  if (user.emailAlerts === false) return false;
  const prefs = { ...defaultPrefs, ...(user.alertPrefs || {}) };
  if (type === "appointment") return prefs.appointments !== false;
  if (type === "ward") return prefs.wards !== false;
  if (type === "message") return prefs.messages !== false;
  if (type === "account" || type === "test") return prefs.account !== false;
  if (type === "support") return prefs.support !== false;
  return true;
}
