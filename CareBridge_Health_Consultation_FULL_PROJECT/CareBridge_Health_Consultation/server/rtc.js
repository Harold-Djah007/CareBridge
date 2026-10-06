import { createHmac } from "node:crypto";

export function rtcConfig(userId, env = process.env, now = Date.now()) {
  const urls = String(env.CAREBRIDGE_TURN_URLS || "").split(",").map((url) => url.trim()).filter(Boolean);
  const secret = env.CAREBRIDGE_TURN_SECRET;
  if (urls.some((url) => !/^turns?:[^\s]+$/i.test(url)) || Boolean(urls.length) !== Boolean(secret)) {
    throw new Error("Video relay configuration is incomplete or invalid.");
  }
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  if (urls.length) {
    const username = `${Math.floor(now / 1000) + 3600}:${userId}`;
    iceServers.push({ urls, username, credential: createHmac("sha1", secret).update(username).digest("base64") });
  }
  return { iceServers };
}
