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
  if (user.role === "admin") return "/admin";
  if (user.role === "nurse") return "/home";
  return "/home";
};

export const roleLabel = (role) => ({
  patient: "Patient",
  doctor: "Doctor",
  nurse: "Nurse",
  admin: "Administrator",
}[role] || role);

export const BUILD = "2026.09.05-cart2";

export function rxOrderQty(line, product) {
  const raw = String(line?.qty || "1");
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (/tablet|capsule|sachet|strip|ml|roll|inhaler/i.test(raw) && n > 12) return 1;
  const available = Number(product?.qty || 0);
  if (available > 0) return Math.min(n, available);
  return n;
}

export const HOSPITAL = {
  name: "CareBridge Medical Centre",
  short: "CareBridge",
  campus: "Ridge Campus",
  city: "Accra",
  phone: "+233 30 610 4400",
  emergency: "+233 30 610 4499",
  email: "appointments@carebridge.gh",
  address: "Independence Avenue, Ridge, Accra",
  hours: "Mon–Sat 8:00–17:00",
  emergencyHours: "24 hours",
  visiting: "10:00–11:00 and 16:00–18:00 daily",
};

export const CONSULTANTS = [
  { id: "d1", name: "Dr. Kwame Owusu", specialty: "General Medicine", years: 12, photo: "/portraits/d1.jpg", about: "Primary care and chronic-condition follow-up on campus and by video." },
  { id: "d2", name: "Dr. Efua Boateng", specialty: "Cardiology", years: 15, photo: "/portraits/d2.jpg", about: "Blood pressure, chest pain, and recovery after cardiac events." },
  { id: "d3", name: "Dr. Abena Sarpong", specialty: "Pediatrics", years: 9, photo: "/portraits/d3.jpg", about: "Infants, children, and adolescents — family-centred clinic days." },
  { id: "d4", name: "Dr. Kojo Mensah", specialty: "Orthopedics", years: 11, photo: "/portraits/d4.jpg", about: "Joints, bone, and mobility with a rehabilitation plan after each visit." },
];

export const greeting = (name) => {
  const hour = new Date().getHours();
  const when = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${when}, ${name}`;
};

export const longDate = () =>
  new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const ghs = (n) => `GHS ${Number(n || 0).toLocaleString()}`;

export function consultQuote(rates, specialty, mode) {
  if (!rates) return null;
  const base = rates.consults?.[specialty] || 380;
  return mode === "video" ? base : base + Number(rates.campusSurcharge || 0);
}

export function wardQuote(rates, ward, roomType, nights = 1) {
  if (!rates) return null;
  const base = rates.wards?.[ward] || 650;
  const room = rates.rooms?.[roomType] || 0;
  return (base + room) * Math.max(1, Number(nights || 1));
}
