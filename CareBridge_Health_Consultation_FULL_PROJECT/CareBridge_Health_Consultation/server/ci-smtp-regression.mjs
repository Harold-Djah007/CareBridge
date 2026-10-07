import assert from "node:assert/strict";
import fs from "node:fs";
import tls from "node:tls";
import { verifySmtp } from "../scripts/integration-checks.mjs";

if (!process.env.CAREBRIDGE_SMTP_TEST_CERT || !process.env.CAREBRIDGE_SMTP_TEST_KEY) throw new Error("An isolated SMTP TLS fixture certificate is required.");
const sockets = new Set();
let mailCommands = 0;
const server = tls.createServer({ cert: fs.readFileSync(process.env.CAREBRIDGE_SMTP_TEST_CERT), key: fs.readFileSync(process.env.CAREBRIDGE_SMTP_TEST_KEY) }, (socket) => {
  socket.on("error", () => {});
  socket.write("220 localhost CareBridge test SMTP\r\n");
  let buffer = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    while (buffer.includes("\r\n")) {
      const index = buffer.indexOf("\r\n");
      const line = buffer.slice(0, index); buffer = buffer.slice(index + 2);
      if (/^EHLO /i.test(line)) socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
      else if (/^AUTH PLAIN /i.test(line)) {
        const values = Buffer.from(line.slice(11), "base64").toString().split("\0");
        socket.write(values.at(-2) === "fixture-user" && values.at(-1) === "fixture-pass" ? "235 Authentication successful\r\n" : "535 Authentication failed\r\n");
      } else if (/^QUIT/i.test(line)) socket.end("221 Goodbye\r\n");
      else { if (/^MAIL /i.test(line)) mailCommands += 1; socket.write("550 Test fixture never delivers mail\r\n"); }
    }
  });
});
server.on("connection", (socket) => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
await new Promise((resolve) => server.listen(0, resolve));
const env = { SMTP_HOST: "localhost", SMTP_PORT: String(server.address().port), SMTP_SECURE: "true", SMTP_USER: "fixture-user", SMTP_PASS: "fixture-pass", SMTP_FROM: "test@example.invalid" };
try {
  await verifySmtp(env);
  await assert.rejects(() => verifySmtp({ ...env, SMTP_PASS: "wrong-pass" }));
  await assert.rejects(() => verifySmtp({ ...env, SMTP_HOST: "127.0.0.1" }));
  assert.equal(mailCommands, 0);
  console.log("✓ real SMTP over trusted TLS: authentication succeeds; wrong password and hostname fail; no mail is sent");
} finally {
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => server.close(resolve));
}
