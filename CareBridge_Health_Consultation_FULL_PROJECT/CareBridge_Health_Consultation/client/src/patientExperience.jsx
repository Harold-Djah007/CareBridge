import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./state";

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

const PatientExperienceContext = createContext({
  config: DEFAULT_PATIENT_EXPERIENCE,
  loading: false,
  refresh: async () => DEFAULT_PATIENT_EXPERIENCE,
  save: async () => DEFAULT_PATIENT_EXPERIENCE,
  moduleVisible: () => true,
  homeVisible: () => true,
});

function normalize(value) {
  return {
    ...DEFAULT_PATIENT_EXPERIENCE,
    ...(value || {}),
    modules: { ...DEFAULT_PATIENT_EXPERIENCE.modules, ...(value?.modules || {}) },
    home: { ...DEFAULT_PATIENT_EXPERIENCE.home, ...(value?.home || {}) },
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
      const next = normalize(await api("/patient-experience"));
      setConfig(next);
      return next;
    } finally {
      setLoading(false);
    }
  };

  const save = async (next) => {
    if (user?.role !== "admin") throw new Error("Only hospital operations can change the patient experience.");
    const saved = normalize(await api("/admin/patient-experience", {
      method: "PATCH",
      body: JSON.stringify({ modules: next.modules, home: next.home }),
    }));
    setConfig(saved);
    window.dispatchEvent(new CustomEvent("carebridge:patient-experience", { detail: saved }));
    return saved;
  };

  useEffect(() => {
    refresh();
    if (!user) return undefined;

    const poll = window.setInterval(refresh, 10000);
    const onFocus = () => refresh();
    const onLocal = (event) => {
      if (event.detail) setConfig(normalize(event.detail));
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
    moduleVisible: (key) => config.modules?.[key] !== false,
    homeVisible: (key) => config.home?.[key] !== false,
  }), [config, loading]);

  return <PatientExperienceContext.Provider value={value}>{children}</PatientExperienceContext.Provider>;
}

export function usePatientExperience() {
  return useContext(PatientExperienceContext);
}
