import { audit } from "./clinical.js";
import { passwordMatches, revokeAllUserSessions } from "./auth.js";
import {
  beginEnrollment,
  confirmEnrollment,
  disableMfa,
  mfaEncryptionConfigured,
  mfaStatus,
  regenerateRecoveryCodes,
  verifyUserMfa,
} from "./mfa.js";

export const DEFAULT_PATIENT_EXPERIENCE = {
  version: 2,
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

function cleanOverrideMap(source, keys) {
  const next = {};
  keys.forEach((key) => {
    if (typeof source?.[key] === "boolean") next[key] = source[key];
  });
  return next;
}

function emptyOverride() {
  return { modules: {}, home: {}, updatedAt: null, updatedBy: null };
}

function hasRules(override) {
  return Object.keys(override?.modules || {}).length > 0 || Object.keys(override?.home || {}).length > 0;
}

export function patientExperienceFromDb(db) {
  const stored = db.patientExperience || {};
  return {
    version: 2,
    modules: boolMap(stored.modules, MODULE_KEYS, DEFAULT_PATIENT_EXPERIENCE.modules),
    home: boolMap(stored.home, HOME_KEYS, DEFAULT_PATIENT_EXPERIENCE.home),
    updatedAt: stored.updatedAt || null,
    updatedBy: stored.updatedBy || null,
  };
}

export function patientOverrideFromDb(db, patientId) {
  const stored = db.patientExperienceOverrides?.[patientId] || {};
  return {
    modules: cleanOverrideMap(stored.modules, MODULE_KEYS),
    home: cleanOverrideMap(stored.home, HOME_KEYS),
    updatedAt: stored.updatedAt || null,
    updatedBy: stored.updatedBy || null,
  };
}

export function effectivePatientExperience(db, patientId) {
  const global = patientExperienceFromDb(db);
  const override = patientOverrideFromDb(db, patientId);
  return {
    ...global,
    modules: { ...global.modules, ...override.modules },
    home: { ...global.home, ...override.home },
    scope: hasRules(override) ? "patient" : "all",
    patientId: patientId || null,
    hasOverride: hasRules(override),
    overrideUpdatedAt: override.updatedAt,
    overrideUpdatedBy: override.updatedBy,
  };
}

function mergeExperience(current, body, actorId) {
  return {
    version: 2,
    modules: boolMap({ ...current.modules, ...(body?.modules || {}) }, MODULE_KEYS, DEFAULT_PATIENT_EXPERIENCE.modules),
    home: boolMap({ ...current.home, ...(body?.home || {}) }, HOME_KEYS, DEFAULT_PATIENT_EXPERIENCE.home),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId || null,
  };
}

function mergeOverride(current, body, actorId) {
  const next = {
    modules: { ...(current?.modules || {}) },
    home: { ...(current?.home || {}) },
    updatedAt: new Date().toISOString(),
    updatedBy: actorId || null,
  };

  for (const [group, keys] of [["modules", MODULE_KEYS], ["home", HOME_KEYS]]) {
    if (!body?.[group] || typeof body[group] !== "object") continue;
    keys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(body[group], key)) return;
      const value = body[group][key];
      if (value === null || value === "inherit" || value === undefined) delete next[group][key];
      else if (typeof value === "boolean") next[group][key] = value;
    });
  }
  return next;
}

function patientAccount(db, patientId) {
  return (db.users || []).find((user) => user.id === patientId && user.role === "patient" && user.status !== "inactive");
}

export function mountPatientExperience(app, { readDb, writeDb }) {
  app.get("/api/security/mfa", (req, res) => {
    const db = readDb();
    res.json({ ...mfaStatus(db, req.authUser.id), encryptionConfigured: mfaEncryptionConfigured() });
  });

  app.post("/api/security/mfa/enroll", (req, res) => {
    const db = readDb();
    const user = (db.users || []).find((item) => item.id === req.authUser.id);
    if (!user) return res.status(404).json({ message: "Account not found." });
    if (!req.body.currentPassword || !passwordMatches(req.body.currentPassword, user.password)) {
      return res.status(403).json({ message: "Enter your current password before setting up multi-factor authentication." });
    }
    const enrollment = beginEnrollment(db, user);
    audit(db, { actorId: user.id, action: "mfa.enroll-start", entity: "user", entityId: user.id, detail: "TOTP enrollment started" });
    writeDb(db);
    res.json(enrollment);
  });

  app.post("/api/security/mfa/confirm", (req, res) => {
    const db = readDb();
    const user = (db.users || []).find((item) => item.id === req.authUser.id);
    if (!user) return res.status(404).json({ message: "Account not found." });
    const result = confirmEnrollment(db, user, req.body.code);
    if (!result.ok) return res.status(400).json({ message: result.message });
    const revoked = revokeAllUserSessions(db, user.id, req.authSession?.id || "");
    audit(db, { actorId: user.id, action: "mfa.enable", entity: "user", entityId: user.id, detail: `TOTP enabled; ${revoked} other session(s) revoked` });
    writeDb(db);
    res.json({ enabled: true, method: "totp", enabledAt: result.enabledAt, recoveryCodes: result.recoveryCodes });
  });

  app.post("/api/security/mfa/recovery-codes", (req, res) => {
    const db = readDb();
    const user = (db.users || []).find((item) => item.id === req.authUser.id);
    if (!user) return res.status(404).json({ message: "Account not found." });
    if (!req.body.currentPassword || !passwordMatches(req.body.currentPassword, user.password)) {
      return res.status(403).json({ message: "Enter your current password first." });
    }
    const result = regenerateRecoveryCodes(db, user.id, req.body.code);
    if (!result.ok) return res.status(400).json({ message: result.message });
    audit(db, { actorId: user.id, action: "mfa.recovery-regenerate", entity: "user", entityId: user.id, detail: "MFA recovery codes regenerated" });
    writeDb(db);
    res.json({ recoveryCodes: result.recoveryCodes });
  });

  app.post("/api/security/mfa/disable", (req, res) => {
    const db = readDb();
    const user = (db.users || []).find((item) => item.id === req.authUser.id);
    if (!user) return res.status(404).json({ message: "Account not found." });
    if (!req.body.currentPassword || !passwordMatches(req.body.currentPassword, user.password)) {
      return res.status(403).json({ message: "Enter your current password before disabling multi-factor authentication." });
    }
    const verification = verifyUserMfa(db, user.id, req.body.code, { consumeRecovery: false });
    if (!verification.ok) return res.status(400).json({ message: "Enter a valid authenticator or recovery code." });
    disableMfa(db, user.id);
    const revoked = revokeAllUserSessions(db, user.id, req.authSession?.id || "");
    audit(db, { actorId: user.id, action: "mfa.disable", entity: "user", entityId: user.id, detail: `MFA disabled; ${revoked} other session(s) revoked` });
    writeDb(db);
    res.json({ enabled: false });
  });

  app.get("/api/patient-experience", (req, res) => {
    const db = readDb();
    if (req.authUser?.role === "patient") return res.json(effectivePatientExperience(db, req.authUser.id));
    return res.json({ ...patientExperienceFromDb(db), scope: "all", patientId: null, hasOverride: false });
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
    res.json({ ...next, scope: "all", patientId: null, hasOverride: false });
  });

  app.get("/api/admin/patient-experience/:patientId", (req, res) => {
    if (req.authUser?.role !== "admin") {
      return res.status(403).json({ message: "Only hospital operations can inspect patient experience overrides." });
    }
    const db = readDb();
    const patient = patientAccount(db, req.params.patientId);
    if (!patient) return res.status(404).json({ message: "Patient account not found." });
    const global = patientExperienceFromDb(db);
    const override = patientOverrideFromDb(db, patient.id);
    const effective = effectivePatientExperience(db, patient.id);
    res.json({
      patientId: patient.id,
      patient: { id: patient.id, name: patient.name, email: patient.email, mrn: patient.mrn || "" },
      global,
      override,
      effective,
      hasOverride: hasRules(override),
    });
  });

  app.patch("/api/admin/patient-experience/:patientId", (req, res) => {
    if (req.authUser?.role !== "admin") {
      return res.status(403).json({ message: "Only hospital operations can change a patient's experience." });
    }
    const db = readDb();
    const patient = patientAccount(db, req.params.patientId);
    if (!patient) return res.status(404).json({ message: "Patient account not found." });

    db.patientExperienceOverrides = db.patientExperienceOverrides || {};
    const current = patientOverrideFromDb(db, patient.id);
    const next = mergeOverride(current, req.body || {}, req.authUser.id);
    if (hasRules(next)) db.patientExperienceOverrides[patient.id] = next;
    else delete db.patientExperienceOverrides[patient.id];
    writeDb(db);

    const override = patientOverrideFromDb(db, patient.id);
    res.json({
      patientId: patient.id,
      patient: { id: patient.id, name: patient.name, email: patient.email, mrn: patient.mrn || "" },
      global: patientExperienceFromDb(db),
      override,
      effective: effectivePatientExperience(db, patient.id),
      hasOverride: hasRules(override),
    });
  });

  app.delete("/api/admin/patient-experience/:patientId", (req, res) => {
    if (req.authUser?.role !== "admin") {
      return res.status(403).json({ message: "Only hospital operations can reset a patient's experience." });
    }
    const db = readDb();
    const patient = patientAccount(db, req.params.patientId);
    if (!patient) return res.status(404).json({ message: "Patient account not found." });
    db.patientExperienceOverrides = db.patientExperienceOverrides || {};
    delete db.patientExperienceOverrides[patient.id];
    writeDb(db);
    res.json({
      patientId: patient.id,
      patient: { id: patient.id, name: patient.name, email: patient.email, mrn: patient.mrn || "" },
      global: patientExperienceFromDb(db),
      override: emptyOverride(),
      effective: effectivePatientExperience(db, patient.id),
      hasOverride: false,
    });
  });
}
