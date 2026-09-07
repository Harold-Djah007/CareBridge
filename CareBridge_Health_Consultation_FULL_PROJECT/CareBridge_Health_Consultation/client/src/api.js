const API = import.meta.env.VITE_API_URL || "/api";

export async function api(path, options = {}) {
  const token = localStorage.getItem("carebridge-token");
  const response = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

// Use the browser origin by default so Socket.IO follows the same protocol/host
// as the web app. In development Vite proxies /socket.io to the API server;
// in production the reverse proxy can do the same. This avoids mixed-content
// upgrades such as wss://127.0.0.1:5000 when the UI is served over HTTPS.
export const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export const socketOptions = () => ({
  autoConnect: true,
  transports: ["websocket", "polling"],
  auth: { token: localStorage.getItem("carebridge-token") || "" },
});
