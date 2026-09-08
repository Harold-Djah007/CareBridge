import React, { useEffect, useMemo, useState } from "react";
import {
  BedDouble, Bell, CalendarDays, CheckCircle2, ClipboardList, Eye, EyeOff,
  FolderOpen, HeartPulse, LayoutDashboard, LifeBuoy, MessageCircle, RefreshCw,
  Save, ShoppingBag, Sparkles, Stethoscope, Video,
} from "lucide-react";
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

export default function AdminPatientExperience() {
  const { config, loading, save } = usePatientExperience();
  const { push } = useToast();
  const [draft, setDraft] = useState(config);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft(config), [config]);

  const visibleModules = useMemo(
    () => MODULES.filter((item) => draft.modules?.[item.id] !== false).length,
    [draft]
  );
  const visibleHome = useMemo(
    () => HOME_SECTIONS.filter((item) => draft.home?.[item.id] !== false).length,
    [draft]
  );

  const changed = useMemo(
    () => JSON.stringify({ modules: draft.modules, home: draft.home }) !== JSON.stringify({ modules: config.modules, home: config.home }),
    [draft, config]
  );

  const setModule = (id, value) => setDraft((current) => ({
    ...current,
    modules: { ...current.modules, [id]: value },
  }));

  const setHome = (id, value) => setDraft((current) => ({
    ...current,
    home: { ...current.home, [id]: value },
  }));

  const resetAll = () => setDraft({
    ...draft,
    modules: { ...DEFAULT_PATIENT_EXPERIENCE.modules },
    home: { ...DEFAULT_PATIENT_EXPERIENCE.home },
  });

  const publish = async () => {
    setBusy(true);
    try {
      await save(draft);
      push("Patient experience published. Patient workspaces will update automatically.");
    } catch (error) {
      push(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cb-px-page">
      <section className="cb-px-hero">
        <div>
          <span className="cb-px-kicker"><Sparkles size={14} /> Patient experience control</span>
          <h1>Choose what patients can see.</h1>
          <p>Publish a controlled patient workspace without changing clinical, doctor, nurse or operations views. Hidden modules disappear from patient navigation, Home and direct patient routes.</p>
        </div>
        <div className="cb-px-score">
          <HeartPulse size={22} />
          <span>Patient workspace</span>
          <strong>{visibleModules}<small>/ {MODULES.length}</small></strong>
          <em>modules visible</em>
        </div>
      </section>

      <section className="cb-px-statusbar">
        <div><CheckCircle2 size={17} /><span><strong>{visibleModules}</strong> visible patient modules</span></div>
        <div><LayoutDashboard size={17} /><span><strong>{visibleHome}</strong> Home sections enabled</span></div>
        <div><RefreshCw size={17} /><span>Patient sessions refresh this policy automatically within seconds.</span></div>
      </section>

      <div className="cb-px-layout">
        <main className="cb-px-config">
          <section className="cb-px-panel">
            <header>
              <div><span>Navigation & pages</span><h2>Patient modules</h2><p>Turn a patient-facing feature on or off across navigation, shortcuts and protected patient routes.</p></div>
              <span>{visibleModules} visible</span>
            </header>
            <div className="cb-px-module-list">
              {MODULES.map((item) => {
                const Icon = item.icon;
                const visible = draft.modules?.[item.id] !== false;
                return (
                  <div className={`cb-px-module-row ${visible ? "is-visible" : "is-hidden"}`} key={item.id}>
                    <span className="cb-px-module-icon"><Icon size={19} /></span>
                    <div><strong>{item.label}</strong><p>{item.description}</p></div>
                    <Toggle checked={visible} label={item.label} onChange={(value) => setModule(item.id, value)} />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="cb-px-panel">
            <header>
              <div><span>Home composition</span><h2>Patient Home sections</h2><p>Control the major information blocks patients see after signing in.</p></div>
              <span>{visibleHome} enabled</span>
            </header>
            <div className="cb-px-home-list">
              {HOME_SECTIONS.map((item) => {
                const visible = draft.home?.[item.id] !== false;
                return (
                  <div className="cb-px-home-row" key={item.id}>
                    <div><strong>{item.label}</strong><p>{item.description}</p></div>
                    <Toggle checked={visible} label={item.label} onChange={(value) => setHome(item.id, value)} />
                  </div>
                );
              })}
            </div>
          </section>
        </main>

        <aside className="cb-px-preview">
          <div className="cb-px-preview-head">
            <span>Live configuration preview</span>
            <h2>Patient navigation</h2>
            <p>Only visible modules appear here. Home and Settings remain available so patients are never locked out of the workspace.</p>
          </div>

          <div className="cb-px-preview-nav">
            <span className="always"><LayoutDashboard size={16} /> Home</span>
            {MODULES.map((item) => {
              const Icon = item.icon;
              const visible = draft.modules?.[item.id] !== false;
              return <span key={item.id} className={visible ? "" : "hidden"}><Icon size={16} /> {item.label}</span>;
            })}
          </div>

          <div className="cb-px-preview-home">
            <small>HOME LAYOUT</small>
            {HOME_SECTIONS.map((item) => (
              <div key={item.id} className={draft.home?.[item.id] !== false ? "" : "off"}>
                <i /> <span>{item.label}</span><b>{draft.home?.[item.id] !== false ? "Shown" : "Hidden"}</b>
              </div>
            ))}
          </div>

          <div className="cb-px-safety">
            <CheckCircle2 size={17} />
            <p>These controls change patient presentation and route availability. They do not delete patient data or alter staff access to clinical records.</p>
          </div>
        </aside>
      </div>

      <footer className="cb-px-publishbar">
        <div>
          <strong>{changed ? "Unpublished changes" : "Patient experience is up to date"}</strong>
          <span>{config.updatedAt ? `Last published ${new Date(config.updatedAt).toLocaleString()}` : "Using the full default patient workspace"}</span>
        </div>
        <div>
          <button type="button" className="secondary-btn" onClick={resetAll} disabled={busy}><RefreshCw size={16} /> Show everything</button>
          <button type="button" className="primary-btn" onClick={publish} disabled={busy || loading || !changed}><Save size={16} /> {busy ? "Publishing…" : "Publish patient view"}</button>
        </div>
      </footer>
    </div>
  );
}
