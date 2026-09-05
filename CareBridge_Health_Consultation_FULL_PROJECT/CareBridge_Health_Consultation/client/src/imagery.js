/** Local FOCOS campus/clinical plates. Reused on login, public pages, and the HIS. */
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
  ops: IMAGERY.ops,
  billing: IMAGERY.corridor,
  consult: IMAGERY.consult,
  schedule: IMAGERY.clinic,
  messages: IMAGERY.consult,
  wards: IMAGERY.wards,
  records: IMAGERY.records,
  settings: IMAGERY.records,
  support: IMAGERY.ops,
  care: IMAGERY.clinic,
  profile: IMAGERY.patient,
  alerts: IMAGERY.records,
  directory: IMAGERY.corridor,
  reports: IMAGERY.ops,
  cases: IMAGERY.records,
};

export function photoFor(scene) {
  return SCENE_PHOTOS[scene] || IMAGERY.corridor;
}

export function sceneFor(pathname = "", role) {
  if (pathname.startsWith("/pay") || pathname.startsWith("/receipts") || pathname.includes("tariff")) return "billing";
  if (pathname.startsWith("/pharmacy") || pathname.startsWith("/prescriptions") || (pathname === "/home" && role === "nurse")) return "pharmacy";
  if (pathname.startsWith("/video")) return "consult";
  if (pathname.startsWith("/appointments") || pathname.startsWith("/admin/appointments")) return "schedule";
  if (pathname.startsWith("/messages")) return "messages";
  if (pathname.startsWith("/wards") || pathname.startsWith("/admin/hospital")) return "wards";
  if (pathname.startsWith("/records")) return "records";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/support") || pathname.startsWith("/admin/support") || pathname.startsWith("/guide")) return "support";
  if (pathname.startsWith("/care")) return "care";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/alerts")) return "alerts";
  if (pathname.startsWith("/admin/users")) return "directory";
  if (pathname.startsWith("/admin/reports")) return "reports";
  if (pathname.startsWith("/admin/cases")) return "cases";
  if (pathname.startsWith("/admin")) return "ops";
  if (pathname === "/home" && role === "doctor") return "clinic";
  return role === "admin" ? "ops" : "home";
}
