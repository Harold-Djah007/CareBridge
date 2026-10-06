import { createRequire } from "node:module";
import { smtpOptions } from "../server/smtp.js";
import { rtcConfig } from "../server/rtc.js";
import { flutterwaveStatus, paymentMatchesVerification, verifyFlutterwaveTransaction } from "../server/flutterwave.js";

const requireServer = createRequire(new URL("../server/package.json", import.meta.url));

export async function verifySmtp(env = process.env) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM) throw new Error("SMTP configuration is incomplete.");
  const transport = requireServer("nodemailer").createTransport(smtpOptions({ ...env, NODE_ENV: "production" }));
  try { await transport.verify(); }
  finally { transport.close(); }
}

export async function verifyPayment(env = process.env) {
  if (!flutterwaveStatus().configured || flutterwaveStatus().testMode) throw new Error("Live Flutterwave credentials are required.");
  const transactionId = env.CAREBRIDGE_VALIDATE_TRANSACTION_ID;
  const reference = env.CAREBRIDGE_VALIDATE_PAYMENT_REFERENCE;
  const amount = Number(env.CAREBRIDGE_VALIDATE_PAYMENT_AMOUNT);
  if (!transactionId || !reference || !Number.isFinite(amount) || amount <= 0) throw new Error("Provide an existing completed transaction id, CareBridge payment reference and expected amount.");
  const verification = await verifyFlutterwaveTransaction(transactionId);
  if (!paymentMatchesVerification({ reference, amount, currency: env.CAREBRIDGE_VALIDATE_PAYMENT_CURRENCY || "GHS" }, verification)) throw new Error("The provider transaction does not match the expected payment.");
}

export async function verifyRelay(browser, config) {
  if (!config.iceServers.some((server) => server.username && server.credential)) throw new Error("A TURN relay is required.");
  const page = await browser.newPage();
  try {
    return await page.evaluate(async (iceServers) => {
      const peers = [new RTCPeerConnection({ iceServers, iceTransportPolicy: "relay" }), new RTCPeerConnection({ iceServers, iceTransportPolicy: "relay" })];
      let timer;
      try {
        const echo = new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error("TURN connection timed out")), 45000);
          const channel = peers[0].createDataChannel("carebridge-relay-check");
          channel.onopen = () => channel.send("carebridge-relay-check");
          channel.onmessage = (event) => event.data === "carebridge-relay-check" ? resolve() : reject(new Error("Invalid relay response"));
          peers[1].ondatachannel = ({ channel: remote }) => { remote.onmessage = ({ data }) => remote.send(data); };
        });
        // Attach immediately so a gathering timeout cannot leave an unhandled rejection.
        const negotiate = async () => {
          const gather = (peer) => peer.iceGatheringState === "complete" ? Promise.resolve() : new Promise((resolve) => {
            peer.addEventListener("icegatheringstatechange", () => { if (peer.iceGatheringState === "complete") resolve(); });
          });
          await peers[0].setLocalDescription(await peers[0].createOffer());
          await gather(peers[0]);
          await peers[1].setRemoteDescription(peers[0].localDescription);
          await peers[1].setLocalDescription(await peers[1].createAnswer());
          await gather(peers[1]);
          await peers[0].setRemoteDescription(peers[1].localDescription);
        };
        await Promise.all([echo, negotiate()]);
        for (const peer of peers) {
          const stats = await peer.getStats();
          const transport = [...stats.values()].find((row) => row.type === "transport" && row.selectedCandidatePairId);
          const pair = transport && stats.get(transport.selectedCandidatePairId);
          if (!pair || stats.get(pair.localCandidateId)?.candidateType !== "relay") throw new Error("Selected connection did not use TURN");
        }
        return { relay: true, dataEcho: true };
      } finally { clearTimeout(timer); peers.forEach((peer) => peer.close()); }
    }, config.iceServers);
  } finally { await page.close(); }
}

export async function verifyTurn(env = process.env) {
  const config = rtcConfig("deployment-check", env);
  const requireClient = createRequire(new URL("../client/package.json", import.meta.url));
  const browser = await requireClient("@playwright/test").chromium.launch({ headless: true });
  try { return await verifyRelay(browser, config); }
  finally { await browser.close(); }
}
