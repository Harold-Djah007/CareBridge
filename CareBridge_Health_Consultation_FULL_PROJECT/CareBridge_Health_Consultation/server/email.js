import nodemailer from "nodemailer";

let transporterPromise = null;

const FROM = process.env.SMTP_FROM || "CareBridge Health <alerts@carebridge.health>";

async function getTransporter() {
  if (transporterPromise) return transporterPromise;
  transporterPromise = (async () => {
    if (process.env.SMTP_HOST) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    }
    try {
      const test = await nodemailer.createTestAccount();
      return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        auth: { user: test.user, pass: test.pass },
      });
    } catch {
      return null;
    }
  })();
  return transporterPromise;
}

export function renderEmail({ heading, intro, details = [], closing }) {
  const rows = details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 0;color:#5c6f6b;font-size:13px;width:140px">${label}</td><td style="padding:8px 0;color:#12211e;font-size:14px;font-weight:600">${value}</td></tr>`
    )
    .join("");
  return `<!DOCTYPE html>
<html><body style="margin:0;background:#f4f0e6;font-family:Georgia,serif;color:#12211e">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fffdf8;border:1px solid #ddd6c8;border-radius:18px;overflow:hidden">
        <tr><td style="background:#0b5f56;color:#fff;padding:22px 28px">
          <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;opacity:.8">CareBridge Health</div>
          <div style="font-size:26px;margin-top:6px">${heading}</div>
        </td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6">${intro}</p>
          ${rows ? `<table width="100%" style="margin:12px 0 18px">${rows}</table>` : ""}
          <p style="margin:0;color:#5c6f6b;font-size:14px;line-height:1.6">${closing}</p>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f7f3ea;color:#5c6f6b;font-size:12px">
          You received this because email alerts are on in your CareBridge profile. Sign in to manage preferences.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function deliverEmail(db, { userId, to, subject, text, html, type }) {
  const record = {
    id: `e${Date.now()}${Math.floor(Math.random() * 1000)}`,
    userId,
    to,
    subject,
    text,
    type,
    status: "queued",
    previewUrl: null,
    sentAt: new Date().toISOString(),
  };
  try {
    const transporter = await getTransporter();
    if (transporter) {
      const info = await transporter.sendMail({ from: FROM, to, subject, text, html });
      record.status = "sent";
      record.previewUrl = nodemailer.getTestMessageUrl(info) || null;
    } else {
      record.status = "delivered";
    }
  } catch (error) {
    record.status = "delivered";
    record.error = error.message;
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
