import crypto from "crypto";

const API_BASE = "https://api.flutterwave.com/v3";
const NETWORKS = {
  mtn: "MTN",
  telecel: "VODAFONE",
  vodafone: "VODAFONE",
  at: "TIGO",
  airteltigo: "TIGO",
  tigo: "TIGO",
};

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

function config() {
  return {
    secretKey: String(process.env.FLW_SECRET_KEY || "").trim(),
    secretHash: String(process.env.FLW_SECRET_HASH || "").trim(),
    appUrl: String(process.env.APP_URL || process.env.CLIENT_URL || "").trim().replace(/\/$/, ""),
    shopName: String(process.env.SHOP_NAME || "CareBridge Health").trim(),
  };
}

export function flutterwaveStatus() {
  const cfg = config();
  return {
    configured: Boolean(cfg.secretKey && cfg.secretHash),
    testMode: /_TEST-|TEST/i.test(cfg.secretKey),
    webhookPath: "/api/payments/webhook",
  };
}

function requireConfig() {
  const cfg = config();
  if (!cfg.secretKey || !cfg.secretHash) {
    const error = new Error("Flutterwave is not configured on the server. Add FLW_SECRET_KEY and FLW_SECRET_HASH to server/.env.");
    error.status = 503;
    throw error;
  }
  return cfg;
}

function flwHeaders() {
  const { secretKey } = requireConfig();
  return {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...flwHeaders(), ...(options.headers || {}) },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.message || payload?.data?.message || `Flutterwave request failed (${response.status}).`);
      error.status = 502;
      error.providerStatus = response.status;
      error.providerPayload = payload;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeout = new Error("Flutterwave did not respond in time. Check the payment status before retrying.");
      timeout.status = 504;
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyFlutterwaveTransaction(transactionId) {
  if (!transactionId) throw Object.assign(new Error("Flutterwave transaction id is required."), { status: 400 });
  const payload = await request(`/transactions/${encodeURIComponent(transactionId)}/verify`, { method: "GET" });
  return payload?.data || null;
}

export function paymentMatchesVerification(payment, verification) {
  if (!payment || !verification) return false;
  const amount = Number(verification.amount);
  const expected = Number(payment.amount);
  return verification.status === "successful"
    && String(verification.currency || "").toUpperCase() === String(payment.currency || "GHS").toUpperCase()
    && String(verification.tx_ref || "") === String(payment.reference || "")
    && Number.isFinite(amount)
    && amount + 0.00001 >= expected;
}

function callbackBase(req) {
  const cfg = config();
  if (cfg.appUrl) return cfg.appUrl;
  const origin = String(req.get?.("origin") || "").trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(origin)) return origin;
  const forwardedProto = String(req.get?.("x-forwarded-proto") || "").split(",")[0].trim();
  const proto = forwardedProto || req.protocol || "http";
  const host = String(req.get?.("host") || "").trim();
  return host ? `${proto}://${host}` : "http://localhost:5173";
}

function customerPayload(user, payment) {
  return {
    email: user?.email || "",
    name: payment.payerName || user?.name || "CareBridge patient",
    phonenumber: payment.phone || user?.phone || "",
  };
}

export async function startFlutterwavePayment({ req, payment, user }) {
  requireConfig();
  const method = payment.method;
  const amount = Number(payment.amount || 0).toFixed(2);
  const redirectUrl = `${callbackBase(req)}/payment/callback?paymentId=${encodeURIComponent(payment.id)}`;
  const customer = customerPayload(user, payment);
  const meta = {
    carebridge_payment_id: payment.id,
    patient_id: payment.patientId,
    invoice_ids: (payment.invoiceIds || []).join(","),
  };

  if (method === "card") {
    const result = await request("/payments", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: payment.reference,
        amount,
        currency: "GHS",
        redirect_url: redirectUrl,
        payment_options: "card",
        customer,
        customizations: {
          title: config().shopName,
          description: `CareBridge payment ${payment.reference}`,
        },
        meta,
      }),
    });
    const checkoutUrl = result?.data?.link;
    if (!checkoutUrl) throw Object.assign(new Error("Flutterwave did not return a card checkout link."), { status: 502 });
    return { mode: "redirect", checkoutUrl, gatewayTransactionId: null, provider: result };
  }

  if (method === "momo") {
    const network = NETWORKS[String(payment.network || "mtn").toLowerCase()];
    if (!network) throw Object.assign(new Error("Choose MTN, Telecel, or AirtelTigo Mobile Money."), { status: 400 });
    if (!payment.phone) throw Object.assign(new Error("A Mobile Money phone number is required."), { status: 400 });
    const result = await request("/charges?type=mobile_money_ghana", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: payment.reference,
        amount,
        currency: "GHS",
        country: "GH",
        email: customer.email,
        phone_number: payment.phone,
        fullname: customer.name,
        network,
        redirect_url: redirectUrl,
        client_ip: String(req.get?.("x-forwarded-for") || req.ip || "").split(",")[0].trim(),
        meta,
      }),
    });
    const checkoutUrl = result?.meta?.authorization?.redirect || result?.data?.redirect_url || null;
    return {
      mode: checkoutUrl ? "redirect" : "pending",
      checkoutUrl,
      gatewayTransactionId: result?.data?.id ? String(result.data.id) : null,
      flwRef: result?.data?.flw_ref || null,
      provider: result,
    };
  }

  if (method === "bank") {
    const result = await request("/charges?type=bank_transfer", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: payment.reference,
        amount,
        currency: "GHS",
        email: customer.email,
        fullname: customer.name,
        phone_number: payment.phone || user?.phone || "",
        bank_transfer_options: { expires: 3600 },
        meta,
      }),
    });
    const auth = result?.meta?.authorization || {};
    const account = auth.transfer_account || auth.account_number || result?.data?.account_number;
    if (!account) throw Object.assign(new Error("Flutterwave did not return a temporary bank-transfer account."), { status: 502 });
    return {
      mode: "bank_transfer",
      gatewayTransactionId: result?.data?.id ? String(result.data.id) : null,
      flwRef: result?.data?.flw_ref || null,
      bankTransfer: {
        bank: auth.transfer_bank || auth.bank_name || result?.data?.bank_name || "Flutterwave transfer account",
        account,
        amount: auth.transfer_amount || result?.data?.amount || amount,
        expiration: auth.account_expiration || auth.expiration || result?.data?.account_expiration || "1 hour",
        transferReference: auth.transfer_reference || payment.reference,
      },
      provider: result,
    };
  }

  throw Object.assign(new Error("Flutterwave is only used for card, Mobile Money, and bank transfer payments."), { status: 400 });
}

export function validFlutterwaveWebhook(req) {
  const { secretHash } = config();
  if (!secretHash) return false;
  const signature = req.get?.("flutterwave-signature");
  if (signature) {
    const expected = crypto.createHmac("sha256", secretHash).update(req.rawBody || "").digest("base64");
    return safeEqual(expected, signature);
  }
  const legacy = req.get?.("verif-hash");
  return Boolean(legacy) && safeEqual(legacy, secretHash);
}
