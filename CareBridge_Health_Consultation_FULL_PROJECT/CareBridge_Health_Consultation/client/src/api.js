const API = import.meta.env.VITE_API_URL || "/api";

export async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

export const socketUrl = import.meta.env.VITE_SOCKET_URL || (
  import.meta.env.DEV ? "http://127.0.0.1:5000" : window.location.origin
);
