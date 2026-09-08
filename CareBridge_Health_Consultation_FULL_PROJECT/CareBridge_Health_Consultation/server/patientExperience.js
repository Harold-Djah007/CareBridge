export const DEFAULT_PATIENT_EXPERIENCE = {
  version: 1,
  modules: {
    appointments: true,
    records: true,
    messages: true,
    prescriptions: true,
    admissions: true,
    shop: true,
    careTeam: true,
    notifications: true,
    support: true,
    video: true,
  },
  home: {
    welcome: true,
    recommended: true,
    summary: true,
    careStream: true,
    clinician: true,
    quickActions: true,
  },
  updatedAt: null,
  updatedBy: null,
};

const MODULE_KEYS = Object.keys(DEFAULT_PATIENT_EXPERIENCE.modules);
const HOME_KEYS = Object.keys(DEFAULT_PATIENT_EXPERIENCE.home);

function boolMap(source, keys, fallback) {
  return Object.fromEntries(keys.map((key) => [key, source?.[key] === undefined ? fallback[key] : Boolean(source[key])]));
}

export function patientExperienceFromDb(db) {
  const stored = db.patientExperience || {};
  return {
    version: 1,
    modules: boolMap(stored.modules, MODULE_KEYS, DEFAULT_PATIENT_EXPERIENCE.modules),
    home: boolMap(stored.home, HOME_KEYS, DEFAULT_PATIENT_EXPERIENCE.home),
    updatedAt: stored.updatedAt || null,
    updatedBy: stored.updatedBy || null,
  };
}

function mergeExperience(current, body, actorId) {
  return {
    version: 1,
    modules: boolMap({ ...current.modules, ...(body?.modules || {}) }, MODULE_KEYS, DEFAULT_PATIENT_EXPERIENCE.modules),
    home: boolMap({ ...current.home, ...(body?.home || {}) }, HOME_KEYS, DEFAULT_PATIENT_EXPERIENCE.home),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId || null,
  };
}

export function mountPatientExperience(app, { readDb, writeDb }) {
  app.get("/api/patient-experience", (_req, res) => {
    const db = readDb();
    res.json(patientExperienceFromDb(db));
  });

  app.patch("/api/admin/patient-experience", (req, res) => {
    if (req.authUser?.role !== "admin") {
      return res.status(403).json({ message: "Only hospital operations can change the patient experience." });
    }
    const db = readDb();
    const current = patientExperienceFromDb(db);
    const next = mergeExperience(current, req.body || {}, req.authUser.id);
    db.patientExperience = next;
    writeDb(db);
    res.json(next);
  });
}
