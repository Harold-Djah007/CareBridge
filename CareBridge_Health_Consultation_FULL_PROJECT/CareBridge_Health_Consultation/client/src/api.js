const API = import.meta.env.VITE_API_URL || "/api";

export async function api(path, options = {}) {
  const token = localStorage.getItem("carebridge-token");
  const { timeoutMs = 60000, signal, ...requestOptions } = options;
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort(signal.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(`${API}${path}`, {
      ...requestOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const data = response.status === 204 ? {} : await response.json().catch(() => {
      throw new Error("The server returned an unreadable response. Check your connection and try again.");
    });

    if (response.status === 401 && path !== "/login") {
      if (token && localStorage.getItem("carebridge-token") === token) {
        localStorage.removeItem("carebridge-user");
        localStorage.removeItem("carebridge-token");
        window.dispatchEvent(new CustomEvent("carebridge:session-expired"));
      }
      throw new Error(data.message || "Your session has expired. Please sign in again.");
    }

    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  } catch (error) {
    if (timedOut) throw new Error("The request took too long. Check its status before repeating a payment or booking.");
    if (error instanceof TypeError) throw new Error("Could not reach CareBridge. Check your connection and try again.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
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
