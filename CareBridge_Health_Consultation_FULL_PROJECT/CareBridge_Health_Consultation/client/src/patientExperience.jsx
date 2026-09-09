import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./state";

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

const PatientExperienceContext = createContext({
  config: DEFAULT_PATIENT_EXPERIENCE,
  loading: false,
  refresh: async () => DEFAULT_PATIENT_EXPERIENCE,
  save: async () => DEFAULT_PATIENT_EXPERIENCE,
  loadPatient: async () => null,
  savePatient: async () => null,
  resetPatient: async () => null,
  moduleVisible: () => true,
  homeVisible: () => true,
});

export function normalizePatientExperience(value) {
  return {
    ...DEFAULT_PATIENT_EXPERIENCE,
    ...(value || {}),
    modules: { ...DEFAULT_PATIENT_EXPERIENCE.modules, ...(value?.modules || {}) },
    home: { ...DEFAULT_PATIENT_EXPERIENCE.home, ...(value?.home || {}) },
  };
}

function normalizePatientBundle(value) {
  if (!value) return null;
  return {
    ...value,
    global: normalizePatientExperience(value.global),
    effective: normalizePatientExperience(value.effective),
    override: {
      modules: { ...(value.override?.modules || {}) },
      home: { ...(value.override?.home || {}) },
      updatedAt: value.override?.updatedAt || null,
      updatedBy: value.override?.updatedBy || null,
    },
  };
}

export function PatientExperienceProvider({ children }) {
  const { user } = useAuth();
  const [config, setConfig] = useState(DEFAULT_PATIENT_EXPERIENCE);
  const [loading, setLoading] = useState(Boolean(user));

  const refresh = async () => {
    if (!user) {
      setConfig(DEFAULT_PATIENT_EXPERIENCE);
      setLoading(false);
      return DEFAULT_PATIENT_EXPERIENCE;
    }
    try {
      const next = normalizePatientExperience(await api("/patient-experience"));
      setConfig(next);
      return next;
    } finally {
      setLoading(false);
    }
  };

  const save = async (next) => {
    if (user?.role !== "admin") throw new Error("Only hospital operations can change the patient experience.");
    const saved = normalizePatientExperience(await api("/admin/patient-experience", {
      method: "PATCH",
      body: JSON.stringify({ modules: next.modules, home: next.home }),
    }));
    setConfig(saved);
    window.dispatchEvent(new CustomEvent("carebridge:patient-experience", { detail: saved }));
    return saved;
  };

  const loadPatient = async (patientId) => {
    if (user?.role !== "admin") throw new Error("Only hospital operations can inspect patient experience overrides.");
    if (!patientId) return null;
    return normalizePatientBundle(await api(`/admin/patient-experience/${patientId}`));
  };

  const savePatient = async (patientId, override) => {
    if (user?.role !== "admin") throw new Error("Only hospital operations can change a patient's experience.");
    if (!patientId) throw new Error("Choose a patient first.");
    const saved = normalizePatientBundle(await api(`/admin/patient-experience/${patientId}`, {
      method: "PATCH",
      body: JSON.stringify({ modules: override.modules || {}, home: override.home || {} }),
    }));
    window.dispatchEvent(new CustomEvent("carebridge:patient-experience", { detail: config }));
    return saved;
  };

  const resetPatient = async (patientId) => {
    if (user?.role !== "admin") throw new Error("Only hospital operations can reset a patient's experience.");
    if (!patientId) throw new Error("Choose a patient first.");
    const saved = normalizePatientBundle(await api(`/admin/patient-experience/${patientId}`, { method: "DELETE" }));
    window.dispatchEvent(new CustomEvent("carebridge:patient-experience", { detail: config }));
    return saved;
  };

  useEffect(() => {
    refresh();
    if (!user) return undefined;

    const poll = window.setInterval(refresh, 10000);
    const onFocus = () => refresh();
    const onLocal = (event) => {
      if (event.detail) setConfig(normalizePatientExperience(event.detail));
      else refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("carebridge:patient-experience", onLocal);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("carebridge:patient-experience", onLocal);
    };
  }, [user?.id, user?.role]);

  const value = useMemo(() => ({
    config,
    loading,
    refresh,
    save,
    loadPatient,
    savePatient,
    resetPatient,
    moduleVisible: (key) => config.modules?.[key] !== false,
    homeVisible: (key) => config.home?.[key] !== false,
  }), [config, loading]);

  return <PatientExperienceContext.Provider value={value}>{children}</PatientExperienceContext.Provider>;
}

export function usePatientExperience() {
  return useContext(PatientExperienceContext);
}
