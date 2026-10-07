import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { smtpOptions, assertAcceptedEmail } from "./smtp.js";
import { productionConfigurationReport } from "./productionConfig.js";
import { flutterwaveStatus, startFlutterwavePayment, paymentMatchesVerification, validFlutterwaveWebhook, verifyFlutterwaveTransaction } from "./flutterwave.js";
import { verifySmtp, verifyPayment } from "../scripts/integration-checks.mjs";

const secure = smtpOptions({ NODE_ENV: "production", SMTP_REJECT_UNAUTHORIZED: "false", SMTP_REQUIRE_TLS: "false" });
assert.equal(secure.requireTLS, true);
assert.equal(secure.tls.rejectUnauthorized, true);
assert.equal(secure.connectionTimeout, 10000);
assert.equal(secure.socketTimeout, 15000);
assert.equal(smtpOptions({ SMTP_PORT: "465" }).secure, true);
assert.throws(() => assertAcceptedEmail({ accepted: [], rejected: ["test@example.invalid"] }));
assert.throws(() => assertAcceptedEmail({ accepted: ["one@example.invalid"], rejected: ["two@example.invalid"] }));
assert.doesNotThrow(() => assertAcceptedEmail({ accepted: ["test@example.invalid"], rejected: [] }));

const env = {
  NODE_ENV: "production", PERSISTENCE_PROVIDER: "postgres", DATABASE_URL: "postgres://test", REDIS_URL: "redis://test", REDIS_SESSION_ENFORCE: "true",
  CLIENT_URL: "https://carebridge.invalid", APP_URL: "https://carebridge.invalid", SESSION_DAYS: "7", SESSION_MAX_PER_USER: "8", PASSWORD_MIN_LENGTH: "10",
  MFA_ENCRYPTION_KEY: "integration-mfa-secret-32-characters", BACKUP_ENCRYPTION_KEY: "integration-backup-secret-32-characters",
  FLW_SECRET_KEY: "FLWSECK-LIVE-INTEGRATION-CONTRACT", FLW_SECRET_HASH: "integration-webhook-secret-32-characters",
  SMTP_HOST: "smtp.invalid", SMTP_PORT: "587", SMTP_USER: "test", SMTP_PASS: "integration-mail-secret", SMTP_FROM: "test@example.invalid", SMTP_REQUIRE_TLS: "true",
  CAREBRIDGE_TURN_URLS: "turns:relay.invalid:443?transport=tcp", CAREBRIDGE_TURN_SECRET: "integration-relay-secret-32-characters",
};
assert.equal(productionConfigurationReport(env).ok, true);
for (const change of [{ CAREBRIDGE_TURN_URLS: "" }, { CAREBRIDGE_TURN_SECRET: "short" }, { CAREBRIDGE_TURN_URLS: "https://relay.invalid" }, { SMTP_REQUIRE_TLS: "false" }, { SMTP_REJECT_UNAUTHORIZED: "false" }, { SMTP_PORT: "587garbage" }, { SMTP_PORT: "587.5" }]) {
  assert.equal(productionConfigurationReport({ ...env, ...change }).ok, false);
}
console.log("✓ production requires a relay, strong relay secret and verified SMTP TLS");

Object.assign(process.env, { FLW_SECRET_KEY: env.FLW_SECRET_KEY, FLW_SECRET_HASH: env.FLW_SECRET_HASH, SMTP_HOST: env.SMTP_HOST });
const payment = { reference: "carebridge-payment-1", amount: 20, currency: "GHS" };
const transaction = { id: 123, status: "successful", tx_ref: payment.reference, amount: 20, currency: "GHS" };
assert.equal(paymentMatchesVerification(payment, transaction), true);
for (const change of [{ status: "failed" }, { tx_ref: "different" }, { currency: "USD" }, { amount: 19 }, { amount: "NaN" }]) assert.equal(paymentMatchesVerification(payment, { ...transaction, ...change }), false);
for (const change of [{ amount: -1 }, { amount: undefined }, { reference: "" }]) assert.equal(paymentMatchesVerification({ ...payment, ...change }, transaction), false);
const rawBody = JSON.stringify({ event: "charge.completed", data: { id: 123 } });
const signature = createHmac("sha256", env.FLW_SECRET_HASH).update(rawBody).digest("base64");
assert.equal(validFlutterwaveWebhook({ rawBody, get: (name) => name === "flutterwave-signature" ? signature : null }), true);
assert.equal(validFlutterwaveWebhook({ rawBody: rawBody + " ", get: (name) => name === "flutterwave-signature" ? signature : env.FLW_SECRET_HASH }), false);
console.log("✓ payment amount/reference/currency/status checks and signed-body tamper rejection");

const originalFetch = globalThis.fetch;
const require = createRequire(import.meta.url);
const nodemailer = require("nodemailer");
const originalTransport = nodemailer.createTransport;
try {
  const charge = { ...payment, id: "payment-1", patientId: "patient-1", invoiceIds: ["invoice-1"], phone: "0240000000" };
  const user = { email: "patient@example.invalid", name: "Test Patient" };
  const req = { get: () => null, protocol: "https", ip: "127.0.0.1" };
  for (const method of ["card", "momo", "bank"]) {
    globalThis.fetch = async (url, options) => {
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, `Bearer ${env.FLW_SECRET_KEY}`);
      const body = JSON.parse(options.body);
      assert.equal(body.tx_ref, payment.reference);
      assert.equal(body.amount, "20.00");
      assert.equal(body.currency, "GHS");
      assert.equal(body.meta.patient_id, charge.patientId);
      if (method === "card") {
        assert.ok(url.endsWith("/payments"));
        assert.equal(body.payment_options, "card");
        return { ok: true, json: async () => ({ data: { link: "https://checkout.flutterwave.com/test" } }) };
      }
      if (method === "momo") {
        assert.ok(url.endsWith("/charges?type=mobile_money_ghana"));
        assert.equal(body.network, "VODAFONE");
        assert.equal(body.phone_number, charge.phone);
        return { ok: true, json: async () => ({ data: { id: 123, status: "pending" } }) };
      }
      assert.ok(url.endsWith("/charges?type=bank_transfer"));
      assert.equal(body.bank_transfer_options.expires, 3600);
      return { ok: true, json: async () => ({ data: { id: 123 }, meta: { authorization: { transfer_account: "0000000000", transfer_bank: "Test bank", transfer_amount: 20 } } }) };
    };
    const result = await startFlutterwavePayment({ req, user, payment: { ...charge, method, network: "telecel" } });
    assert.equal(result.mode, { card: "redirect", momo: "pending", bank: "bank_transfer" }[method]);
    if (method === "bank") assert.equal(result.bankTransfer.account, "0000000000");
  }
  const originalDemo = process.env.CAREBRIDGE_DEMO;
  try {
    process.env.CAREBRIDGE_DEMO = "true";
    assert.equal(flutterwaveStatus().configured, false);
    globalThis.fetch = async () => { assert.fail("Demo must never contact the payment provider"); };
    await assert.rejects(() => startFlutterwavePayment({ req, user, payment: { ...charge, method: "card" } }), { status: 503 });
  } finally {
    if (originalDemo === undefined) delete process.env.CAREBRIDGE_DEMO;
    else process.env.CAREBRIDGE_DEMO = originalDemo;
  }
  console.log("✓ card checkout, Ghana Mobile Money and bank transfer contracts; demo blocks provider charges even with credentials");
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith("/transactions/123/verify"));
    assert.equal(options.method, "GET");
    assert.equal(options.headers.Authorization, `Bearer ${env.FLW_SECRET_KEY}`);
    return { ok: true, json: async () => ({ data: transaction }) };
  };
  await verifyPayment({ CAREBRIDGE_VALIDATE_TRANSACTION_ID: "123", CAREBRIDGE_VALIDATE_PAYMENT_REFERENCE: payment.reference, CAREBRIDGE_VALIDATE_PAYMENT_AMOUNT: "20" });
  await assert.rejects(() => verifyPayment({ CAREBRIDGE_VALIDATE_TRANSACTION_ID: "123", CAREBRIDGE_VALIDATE_PAYMENT_REFERENCE: "wrong", CAREBRIDGE_VALIDATE_PAYMENT_AMOUNT: "20" }));
  globalThis.fetch = async () => { throw Object.assign(new Error("timeout"), { name: "AbortError" }); };
  await assert.rejects(() => verifyFlutterwaveTransaction(123), { status: 504 });
  let closed = 0;
  nodemailer.createTransport = (options) => {
    assert.equal(options.requireTLS, true);
    return { verify: async () => true, close: () => { closed += 1; } };
  };
  await verifySmtp(env);
  assert.equal(closed, 1);
  nodemailer.createTransport = () => ({ verify: async () => { throw new Error("authentication failed"); }, close: () => { closed += 1; } });
  await assert.rejects(() => verifySmtp(env));
  assert.equal(closed, 2);
  nodemailer.createTransport = () => ({ sendMail: async () => ({ accepted: [], rejected: ["test@example.invalid"], messageId: "rejected" }) });
  const { deliverEmail } = await import("./email.js");
  const db = {};
  const record = await deliverEmail(db, { to: "test@example.invalid", subject: "Fixture", text: "Fixture" });
  assert.equal(record.status, "failed");
  assert.equal(record.sentAt, null);
  assert.equal(db.emails.length, 1);
  console.log("✓ read-only integration probes reject mismatches/timeouts/auth failures; rejected mail is never marked sent");
} finally { globalThis.fetch = originalFetch; nodemailer.createTransport = originalTransport; }
