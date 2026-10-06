import "../server/load-env.js";
import { verifySmtp, verifyPayment, verifyTurn } from "./integration-checks.mjs";

const checks = [
  ["SMTP authentication and TLS", verifySmtp, "Configure SMTP_HOST/PORT/USER/PASS/FROM with a trusted provider."],
  ["Existing live payment verification", verifyPayment, "Configure live FLW credentials and CAREBRIDGE_VALIDATE_TRANSACTION_ID/PAYMENT_REFERENCE/PAYMENT_AMOUNT."],
  ["Forced TURN relay and data exchange", verifyTurn, "Configure CAREBRIDGE_TURN_URLS/SECRET and install Playwright Chromium."],
];
let failed = 0;
for (const [name, check, help] of checks) {
  try { await check(); console.log(`PASS: ${name}`); }
  catch { failed += 1; console.error(`FAIL: ${name}. ${help}`); }
}
console.log("This check creates no charge and sends no email. SMTP acceptance does not prove inbox delivery; a relay check from this machine does not prove every customer's network.");
console.log("Before sale, complete the real browser payment/webhook/receipt path, confirm a test email in the intended inbox, and complete a two-device call across Wi-Fi and mobile data.");
process.exitCode = failed ? 1 : 0;
