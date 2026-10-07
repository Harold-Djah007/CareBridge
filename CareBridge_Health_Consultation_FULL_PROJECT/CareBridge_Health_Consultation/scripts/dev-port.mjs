import net from "node:net";

export async function availablePort(start = 5000, attempts = 20) {
  if (!Number.isInteger(start) || start < 1 || start > 65535) throw new Error("PORT must be an integer between 1 and 65535.");
  for (let port = start; port < Math.min(start + attempts, 65536); port++) {
    const available = await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once("error", (error) => ["EADDRINUSE", "EACCES"].includes(error.code) ? resolve(false) : reject(error));
      probe.listen(port, "0.0.0.0", () => probe.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new Error(`No available API port starting at ${start}. Close an existing development session or choose another PORT.`);
}
