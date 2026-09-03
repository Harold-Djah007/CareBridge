export const roomIdFor = (...ids) => ids.filter(Boolean).sort().join("-");

export const firstName = (name = "") => name.split(" ")[0] || name;

export const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

export const formatTime = (value) => {
  if (!value) return "";
  const [h, m] = String(value).split(":");
  const date = new Date();
  date.setHours(Number(h), Number(m || 0));
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export const prettyDate = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const isUpcoming = (item) => {
  if (!item?.date) return false;
  if (["cancelled", "declined", "completed"].includes(item.status)) return false;
  return `${item.date}T${item.time || "23:59"}` >= new Date().toISOString().slice(0, 16);
};

export const homeFor = (user) => {
  if (!user) return "/login";
  return user.role === "admin" ? "/admin" : "/home";
};

export const roleLabel = (role) => ({
  patient: "Patient",
  doctor: "Doctor",
  admin: "Administrator",
}[role] || role);
