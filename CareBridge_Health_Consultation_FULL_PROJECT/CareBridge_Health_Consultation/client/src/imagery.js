/** Local campus/clinical plates. Scene keys follow the page wording. */
export const IMAGERY = {
  campus: "/imagery/hero-campus.jpg",
  patient: "/imagery/login-patient.jpg",
  clinic: "/imagery/clinic.jpg",
  pharmacy: "/imagery/pharmacy.jpg",
  nurse: "/imagery/login-nurse.jpg",
  ops: "/imagery/login-ops.jpg",
  consult: "/imagery/teleconsult.jpg",
  wards: "/imagery/wards.jpg",
  records: "/imagery/records.jpg",
  corridor: "/imagery/corridor.jpg",
};

export const SCENE_PHOTOS = {
  home: IMAGERY.patient,
  clinic: IMAGERY.clinic,
  pharmacy: IMAGERY.pharmacy,
  shop: IMAGERY.pharmacy,
  ops: IMAGERY.ops,
  billing: IMAGERY.records,
  tariff: IMAGERY.campus,
  consult: IMAGERY.consult,
  schedule: IMAGERY.clinic,
  messages: IMAGERY.consult,
  wards: IMAGERY.wards,
  records: IMAGERY.records,
  settings: IMAGERY.records,
  support: IMAGERY.ops,
  care: IMAGERY.clinic,
  profile: IMAGERY.patient,
  alerts: IMAGERY.ops,
  directory: IMAGERY.campus,
  reports: IMAGERY.ops,
  cases: IMAGERY.records,
  nurse: IMAGERY.nurse,
};

export function photoFor(scene) {
  return SCENE_PHOTOS[scene] || IMAGERY.campus;
}

export function sceneFor(pathname = "", role) {
  if (pathname.startsWith("/pay") && role !== "admin") return "shop";
  if (pathname.startsWith("/pay") || pathname.startsWith("/receipts")) return "billing";
  if (pathname.includes("tariff")) return "tariff";
  if (pathname.startsWith("/pharmacy") || pathname.startsWith("/prescriptions")) return "pharmacy";
  if (pathname === "/home" && role === "nurse") return "nurse";
  if (pathname.startsWith("/video")) return "consult";
  if (pathname.startsWith("/appointments") || pathname.startsWith("/admin/appointments")) return "schedule";
  if (pathname.startsWith("/messages")) return "messages";
  if (pathname.startsWith("/wards") || pathname.startsWith("/admin/hospital")) return "wards";
  if (pathname.startsWith("/records")) return "records";
  if (pathname.startsWith("/settings") || pathname.startsWith("/profile")) return "settings";
  if (pathname.startsWith("/support") || pathname.startsWith("/admin/support") || pathname.startsWith("/guide")) return "support";
  if (pathname.startsWith("/care")) return "care";
  if (pathname.startsWith("/alerts")) return "alerts";
  if (pathname.startsWith("/admin/users")) return "directory";
  if (pathname.startsWith("/admin/reports")) return "reports";
  if (pathname.startsWith("/admin/cases")) return "cases";
  if (pathname.startsWith("/admin")) return "ops";
  if (pathname === "/home" && role === "doctor") return "clinic";
  return role === "admin" ? "ops" : "home";
}
