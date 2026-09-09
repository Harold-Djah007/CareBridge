import React, { useEffect, useMemo, useState } from "react";
import {
  BedDouble, Bell, CalendarDays, Check, CheckCircle2, ClipboardList, Eye, EyeOff,
  FolderOpen, HeartPulse, LayoutDashboard, LifeBuoy, MessageCircle, RefreshCw,
  Save, Search, ShoppingBag, Sparkles, Stethoscope, UserRound, Users, Video,
} from "lucide-react";
import { api } from "../../api";
import { usePatientExperience, DEFAULT_PATIENT_EXPERIENCE } from "../../patientExperience";
import { useToast } from "../../state";

const MODULES = [
  { id: "appointments", label: "Appointments", description: "Booking, upcoming visits and appointment management.", icon: CalendarDays },
  { id: "records", label: "Health record", description: "Clinical timeline, vitals, notes, labs and history.", icon: FolderOpen },
  { id: "messages", label: "Messages", description: "Secure patient-to-care-team conversations.", icon: MessageCircle },
  { id: "prescriptions", label: "Prescriptions", description: "Medication orders and fulfilment status.", icon: ClipboardList },
  { id: "admissions", label: "Admissions", description: "Ward availability, bed requests and admission status.", icon: BedDouble },
  { id: "shop", label: "Shop & pay", description: "Bills, medicines, services, payments and receipts.", icon: ShoppingBag },
  { id: "careTeam", label: "Care team", description: "Preferred clinician and connected care relationships.", icon: Stethoscope },
  { id: "notifications", label: "Notifications", description: "Hospital notices and live care alerts.", icon: Bell },
  { id: "support", label: "Support", description: "Hospital operations support and ticketing.", icon: LifeBuoy },
  { id: "video", label: "Video consultation", description: "Patient access to teleconsultation rooms.", icon: Video },
];

const HOME_SECTIONS = [
  { id: "welcome", label: "Welcome & patient identity", description: "Greeting, MRN, blood type and insurance summary." },
  { id: "recommended", label: "Recommended next step", description: "Prominent next action based on care, balance or visits." },
  { id: "summary", label: "Summary signals", description: "Next visit, account, admission and care-team snapshot." },
  { id: "careStream", label: "Care stream", description: "The live list of important patient activity." },
  { id: "clinician", label: "Clinician panel", description: "Upcoming clinician relationship and contact actions." },
  { id: "quickActions", label: "Quick actions", description: "Bottom shortcut row for frequently used patient tools." },
];

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`cb-px-toggle ${checked ? "on" : "off"}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      aria-label={`${checked ? "Hide" : "Show"} ${label}`}
    >
      <span>{checked ? <Eye size={16} /> : <EyeOff size={16} />}</span>
      <b>{checked ? "Visible" : "Hidden"}</b>
    </button>
  );
}

function OverrideControl({ value, inherited, onChange, label }) {
  const options = [
    { id: "inherit", label: "Default", icon: RefreshCw },
    { id: "visible", label: "Visible", icon: Eye },
    { id: "hidden", label: "Hidden", icon: EyeOff },
  ];
  const selected = value === true ? "visible" : value === false ? "hidden" : "inherit";
  return (
    <div className="cb-px-override-control" role="group" aria-label={`${label} patient override`}>
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            className={selected === option.id ? "is-selected" : ""}
            onClick={() => onChange(option.id === "inherit" ? undefined : option.id === "visible")}
            title={option.id === "inherit" ? `Follow hospital default: ${inherited ? "Visible" : "Hidden"}` : option.label}
          >
            <Icon size={14} /><span>{option.label}</span>{selected === option.id && <Check size={13} />}
          </button>
        );
      })}
    </div>
  );
}

function cleanDraft(value) {
  return {
    modules: Object.fromEntries(Object.entries(value?.modules || {}).filter(([, item]) => typeof item === "boolean")),
    home: Object.fromEntries(Object.entries(value?.home || {}).filter(([, item]) => typeof item === "boolean")),
  };
}

export default function AdminPatientExperience() {
  const { config, loading, save, loadPatient, savePatient, resetPatient } = usePatientExperience();
  const { push } = useToast();
  const [scope, setScope] = useState("all");
  const [draft, setDraft] = useState(config);
  const [patients, setPatients] = useState([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientBundle, setPatientBundle] = useState(null);
  const [overrideDraft, setOverrideDraft] = useState({ modules: {}, home: {} });
  const [busy, setBusy] = useState(false);
  const [patientLoading, setPatientLoading] = useState(false);

  useEffect(() => setDraft(config), [config]);

  useEffect(() => {
    api("/admin/users")
      .then((rows) => {
        const list = rows.filter((item) => item.role === "patient" && item.status !== "inactive").sort((a, b) => a.name.localeCompare(b.name));
        setPatients(list);
      })
      .catch((error) => push(error.message, "error"));
  }, []);

  const choosePatient = async (id) => {
    setPatientId(id);
    setPatientBundle(null);
    setOverrideDraft({ modules: {}, home: {} });
    if (!id) return;
    setPatientLoading(true);
    try {
      const next = await loadPatient(id);
      setPatientBundle(next);
      setOverrideDraft(cleanDraft(next.override));
    } catch (error) {
      push(error.message, "error");
    } finally {
      setPatientLoading(false);
    }
  };

  const switchScope = (next) => {
    setScope(next);
    if (next === "individual" && !patientId && patients[0]) choosePatient(patients[0].id);
  };

  const selectedPatient = patients.find((item) => item.id === patientId) || patientBundle?.patient || null;
  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((item) => `${item.name} ${item.email} ${item.mrn || ""}`.toLowerCase().includes(q));
  }, [patients, patientQuery]);

  const effective = useMemo(() => {
    if (scope === "all") return draft;
    const global = patientBundle?.global || config;
    return {
      ...global,
      modules: { ...global.modules, ...overrideDraft.modules },
      home: { ...global.home, ...overrideDraft.home },
    };
  }, [scope, draft, config, patientBundle, overrideDraft]);

  const visibleModules = useMemo(
    () => MODULES.filter((item) => effective.modules?.[item.id] !== false).length,
    [effective]
  );
  const visibleHome = useMemo(
    () => HOME_SECTIONS.filter((item) => effective.home?.[item.id] !== false).length,
    [effective]
  );

  const changed = useMemo(() => {
    if (scope === "all") {
      return JSON.stringify({ modules: draft.modules, home: draft.home }) !== JSON.stringify({ modules: config.modules, home: config.home });
    }
    return JSON.stringify(cleanDraft(overrideDraft)) !== JSON.stringify(cleanDraft(patientBundle?.override));
  }, [scope, draft, config, overrideDraft, patientBundle]);

  const setGlobal = (group, id, value) => setDraft((current) => ({
    ...current,
    [group]: { ...current[group], [id]: value },
  }));

  const setOverride = (group, id, value) => setOverrideDraft((current) => {
    const nextGroup = { ...current[group] };
    if (value === undefined) delete nextGroup[id];
    else nextGroup[id] = value;
    return { ...current, [group]: nextGroup };
  });

  const resetAll = async () => {
    if (scope === "all") {
      setDraft({
        ...draft,
        modules: { ...DEFAULT_PATIENT_EXPERIENCE.modules },
        home: { ...DEFAULT_PATIENT_EXPERIENCE.home },
      });
      return;
    }
    if (!patientId) return;
    setBusy(true);
    try {
      const next = await resetPatient(patientId);
      setPatientBundle(next);
      setOverrideDraft({ modules: {}, home: {} });
      push(`${selectedPatient?.name || "Patient"} now follows the all-patient hospital view.`);
    } catch (error) {
      push(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    try {
      if (scope === "all") {
        await save(draft);
        push("All-patient experience published. Every patient without an override will follow it.");
      } else {
        if (!patientId) throw new Error("Choose a patient first.");
        const next = await savePatient(patientId, overrideDraft);
        setPatientBundle(next);
        setOverrideDraft(cleanDraft(next.override));
        push(`${selectedPatient?.name || "Patient"}'s personal workspace has been published.`);
      }
    } catch (error) {
      push(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const globalFor = patientBundle?.global || config;
  const scopeName = scope === "all" ? "All patients" : (selectedPatient?.name || "Choose patient");

  return (
    <div className="cb-px-page">
      <section className="cb-px-hero">
        <div>
          <span className="cb-px-kicker"><Sparkles size={14} /> Patient experience control</span>
          <h1>Control every patient view.</h1>
          <p>Set one hospital-wide experience for everyone, then add precise exceptions for individual patients when their care journey needs a different workspace.</p>
        </div>
        <div className="cb-px-score">
          <HeartPulse size={22} />
          <span>{scope === "all" ? "Hospital default" : "Individual patient"}</span>
          <strong>{visibleModules}<small>/ {MODULES.length}</small></strong>
          <em>{scopeName}</em>
        </div>
      </section>

      <section className="cb-px-scopebar">
        <button type="button" className={scope === "all" ? "is-active" : ""} onClick={() => switchScope("all")}>
          <span><Users size={19} /></span><div><strong>All patients</strong><small>Set the hospital-wide default workspace</small></div>{scope === "all" && <CheckCircle2 size={17} />}
        </button>
        <button type="button" className={scope === "individual" ? "is-active" : ""} onClick={() => switchScope("individual")}>
          <span><UserRound size={19} /></span><div><strong>Specific patient</strong><small>Override the default for one patient only</small></div>{scope === "individual" && <CheckCircle2 size={17} />}
        </button>
      </section>

      {scope === "individual" && (
        <section className="cb-px-patient-picker">
          <div className="cb-px-patient-picker-copy">
            <span>Individual workspace</span>
            <h2>Choose a patient</h2>
            <p>Any setting left on <b>Default</b> follows the All patients policy automatically.</p>
          </div>
          <label className="cb-px-patient-search"><Search size={16} /><input value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} placeholder="Search name, MRN or email" /></label>
          <select value={patientId} onChange={(event) => choosePatient(event.target.value)} disabled={patientLoading}>
            <option value="">Select patient…</option>
            {filteredPatients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.mrn || patient.email}</option>)}
          </select>
          <div className="cb-px-patient-chip">
            <span><UserRound size={18} /></span>
            <div><strong>{selectedPatient?.name || "No patient selected"}</strong><small>{selectedPatient ? `${selectedPatient.mrn || "No MRN"} · ${selectedPatient.email}` : "Choose a patient to configure their workspace"}</small></div>
            {patientBundle?.hasOverride && <em>Custom view</em>}
          </div>
        </section>
      )}

      <section className="cb-px-statusbar">
        <div><CheckCircle2 size={17} /><span><strong>{visibleModules}</strong> visible patient modules</span></div>
        <div><LayoutDashboard size={17} /><span><strong>{visibleHome}</strong> Home sections enabled</span></div>
        <div><RefreshCw size={17} /><span>{scope === "all" ? "This becomes the default for every patient." : "Default settings continue to track the hospital-wide policy."}</span></div>
      </section>

      <div className={`cb-px-layout ${scope === "individual" && !patientId ? "is-disabled" : ""}`}>
        <main className="cb-px-config">
          <section className="cb-px-panel">
            <header>
              <div><span>Navigation & pages</span><h2>Patient modules</h2><p>{scope === "all" ? "Turn a patient-facing feature on or off for the hospital default." : "Choose Default, Visible or Hidden for this patient only."}</p></div>
              <span>{visibleModules} visible</span>
            </header>
            <div className="cb-px-module-list">
              {MODULES.map((item) => {
                const Icon = item.icon;
                const visible = effective.modules?.[item.id] !== false;
                const overrideValue = overrideDraft.modules?.[item.id];
                const inherited = globalFor.modules?.[item.id] !== false;
                return (
                  <div className={`cb-px-module-row ${visible ? "is-visible" : "is-hidden"}`} key={item.id}>
                    <span className="cb-px-module-icon"><Icon size={19} /></span>
                    <div><strong>{item.label}</strong><p>{item.description}{scope === "individual" && overrideValue === undefined ? ` · Default is ${inherited ? "visible" : "hidden"}.` : ""}</p></div>
                    {scope === "all"
                      ? <Toggle checked={visible} label={item.label} onChange={(value) => setGlobal("modules", item.id, value)} />
                      : <OverrideControl value={overrideValue} inherited={inherited} label={item.label} onChange={(value) => setOverride("modules", item.id, value)} />}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="cb-px-panel">
            <header>
              <div><span>Home composition</span><h2>Patient Home sections</h2><p>{scope === "all" ? "Control the major information blocks patients see after signing in." : "Personalize the Home composition for this patient without changing anyone else."}</p></div>
              <span>{visibleHome} enabled</span>
            </header>
            <div className="cb-px-home-list">
              {HOME_SECTIONS.map((item) => {
                const visible = effective.home?.[item.id] !== false;
                const overrideValue = overrideDraft.home?.[item.id];
                const inherited = globalFor.home?.[item.id] !== false;
                return (
                  <div className="cb-px-home-row" key={item.id}>
                    <div><strong>{item.label}</strong><p>{item.description}{scope === "individual" && overrideValue === undefined ? ` · Default is ${inherited ? "shown" : "hidden"}.` : ""}</p></div>
                    {scope === "all"
                      ? <Toggle checked={visible} label={item.label} onChange={(value) => setGlobal("home", item.id, value)} />
                      : <OverrideControl value={overrideValue} inherited={inherited} label={item.label} onChange={(value) => setOverride("home", item.id, value)} />}
                  </div>
                );
              })}
            </div>
          </section>
        </main>

        <aside className="cb-px-preview">
          <div className="cb-px-preview-head">
            <span>{scope === "all" ? "All-patient preview" : "Individual preview"}</span>
            <h2>{scopeName}</h2>
            <p>{scope === "all" ? "This is the baseline patient navigation. Individual overrides can differ." : "This is the effective view after combining the hospital default and this patient's overrides."}</p>
          </div>

          <div className="cb-px-preview-nav">
            <span className="always"><LayoutDashboard size={16} /> Home</span>
            {MODULES.map((item) => {
              const Icon = item.icon;
              const visible = effective.modules?.[item.id] !== false;
              const customized = scope === "individual" && typeof overrideDraft.modules?.[item.id] === "boolean";
              return <span key={item.id} className={`${visible ? "" : "hidden"} ${customized ? "custom" : ""}`}><Icon size={16} /> {item.label}</span>;
            })}
          </div>

          <div className="cb-px-preview-home">
            <small>HOME LAYOUT</small>
            {HOME_SECTIONS.map((item) => {
              const visible = effective.home?.[item.id] !== false;
              const customized = scope === "individual" && typeof overrideDraft.home?.[item.id] === "boolean";
              return (
                <div key={item.id} className={`${visible ? "" : "off"} ${customized ? "custom" : ""}`}>
                  <i /> <span>{item.label}</span><b>{customized ? "Custom" : visible ? "Shown" : "Hidden"}</b>
                </div>
              );
            })}
          </div>

          <div className="cb-px-safety">
            <CheckCircle2 size={17} />
            <p>{scope === "all" ? "All-patient controls establish the default. Existing individual overrides remain intact." : "Individual controls affect only this patient's presentation and route availability. Patient data and staff access are unchanged."}</p>
          </div>
        </aside>
      </div>

      <footer className="cb-px-publishbar">
        <div>
          <strong>{changed ? "Unpublished changes" : scope === "all" ? "All-patient experience is up to date" : patientBundle?.hasOverride ? "Individual patient view is up to date" : "Following all-patient defaults"}</strong>
          <span>{scope === "all"
            ? (config.updatedAt ? `Last published ${new Date(config.updatedAt).toLocaleString()}` : "Using the full default patient workspace")
            : (patientBundle?.override?.updatedAt ? `Patient override updated ${new Date(patientBundle.override.updatedAt).toLocaleString()}` : "No individual override has been published")}</span>
        </div>
        <div>
          <button type="button" className="secondary-btn" onClick={resetAll} disabled={busy || (scope === "individual" && !patientId)}><RefreshCw size={16} /> {scope === "all" ? "Show everything" : "Use all-patient default"}</button>
          <button type="button" className="primary-btn" onClick={publish} disabled={busy || loading || patientLoading || !changed || (scope === "individual" && !patientId)}><Save size={16} /> {busy ? "Publishing…" : scope === "all" ? "Publish for all patients" : "Publish for this patient"}</button>
        </div>
      </footer>
    </div>
  );
}
