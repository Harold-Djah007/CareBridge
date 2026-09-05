import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HeartPulse, ShieldCheck, ArrowRight, UserRound, Stethoscope, Pill, Building2 } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { HOSPITAL } from "../utils";
import { GoldDust } from "../components/LiveFX";
import { UtilBar } from "../components/PublicChrome";

const DEMOS = {
  patient: { email: "patient@carebridge.test", password: "patient123", label: "Fill patient login" },
  doctor: { email: "doctor@carebridge.test", password: "doctor123", label: "Fill doctor login" },
  nurse: { email: "nurse@carebridge.test", password: "nurse123", label: "Fill nurse login" },
  admin: { email: "admin@carebridge.test", password: "admin123", label: "Fill administrator login" },
};

const PORTALS = [
  {
    id: "patient",
    tab: "Patient",
    icon: UserRound,
    eyebrow: "Patient portal",
    title: "Patient sign-in",
    hero: "Secure access to your record.",
    blurb: `Book visits, pay invoices, collect receipts, and reserve a bed at ${HOSPITAL.name}.`,
    status: "Patient portal",
  },
  {
    id: "doctor",
    tab: "Clinician",
    icon: Stethoscope,
    eyebrow: "Staff entry",
    title: "Clinician sign-in",
    hero: "Clinic board and charts.",
    blurb: "Doctors use the clinic list, write prescriptions from chat or video, and manage the admission queue.",
    status: "Clinical access",
  },
  {
    id: "nurse",
    tab: "Nurse",
    icon: Pill,
    eyebrow: "Pharmacy nursing",
    title: "Nurse sign-in",
    hero: "Dispensary and stock.",
    blurb: "Pharmacy nurses prepare hospital pickup orders and keep the Ridge cupboard current.",
    status: "Pharmacy nursing",
  },
  {
    id: "admin",
    tab: "Operations",
    icon: Building2,
    eyebrow: "Hospital operations",
    title: "Administrator sign-in",
    hero: "Beds, staff, and accounts.",
    blurb: "Operations covers the bed board, staff directory, clinic diary, tariff, receipts, and the audit log.",
    status: "Hospital operations",
  },
];

export default function Login() {
  const { login } = useAuth();
  const { push } = useToast();
  const [params] = useSearchParams();
  const roleParam = params.get("role");
  const [portal, setPortal] = useState(["doctor", "nurse", "admin"].includes(roleParam) ? roleParam : "patient");
  const [email, setEmail] = useState(roleParam === "admin" ? DEMOS.admin.email : roleParam === "nurse" ? DEMOS.nurse.email : "");
  const [password, setPassword] = useState(roleParam === "admin" ? DEMOS.admin.password : roleParam === "nurse" ? DEMOS.nurse.password : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const meta = PORTALS.find((p) => p.id === portal) || PORTALS[0];
  const isStaff = portal !== "patient";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await api("/login", { method: "POST", body: JSON.stringify({ email, password, expectedRole: portal }) });
      login(r.user);
      push(`Signed in to ${HOSPITAL.short}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`portal-shell ${isStaff ? "staff-login" : ""} ${portal === "nurse" ? "nurse-login" : ""} ${portal === "admin" ? "admin-login" : ""} ${portal === "doctor" ? "doctor-login" : ""}`}>
      <UtilBar tone="teal" />
      <div className="login-page">
        <section className="login-hero">
          <div className="kb-layer" aria-hidden="true" />
          <GoldDust count={12} />
          <Link to="/" className="brand large">
            <div className="brand-mark live"><HeartPulse size={24} /></div>
            <div><b>{HOSPITAL.name}</b><span>{HOSPITAL.campus}, {HOSPITAL.city}</span></div>
          </Link>
          <div>
            <div className="status confirmed" style={{ display: "inline-flex", gap: 6, marginBottom: 16 }}>
              <ShieldCheck size={14} /> {meta.status}
            </div>
            <h1>{meta.hero}</h1>
            <p className="muted">{meta.blurb}</p>
            <p className="portal-secure">Secure access to your record · Access-controlled</p>
          </div>
          <p className="muted">{HOSPITAL.phone} · Records office · Emergency {HOSPITAL.emergency}</p>
        </section>
        <section className="login-panel">
          <form className="login-card" onSubmit={submit}>
            <div>
              <span className="eyebrow">{meta.eyebrow}</span>
              <h2>{meta.title}</h2>
              <p className="muted">{HOSPITAL.name} · {HOSPITAL.campus}</p>
            </div>
            <div className="portal-chooser" role="tablist" aria-label="Choose a portal">
              {PORTALS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={portal === p.id}
                    key={p.id}
                    className={portal === p.id ? "active" : ""}
                    onClick={() => { setPortal(p.id); setEmail(""); setPassword(""); setError(""); }}
                  >
                    <Icon size={18} />
                    <span>{p.tab}</span>
                  </button>
                );
              })}
            </div>
            <label>{isStaff ? "Staff email" : "Email used at registration"}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
            {error && <div className="error-box">{error}</div>}
            <button className="primary-btn full cta-pulse" disabled={loading}>{loading ? "Signing in..." : <>Sign in <ArrowRight size={18} /></>}</button>
            <details className="demo-box">
              <summary className="muted" style={{ cursor: "pointer" }}>Demonstration credentials for this hospital build</summary>
              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={() => { setEmail(DEMOS[portal].email); setPassword(DEMOS[portal].password); }}>{DEMOS[portal].label}</button>
              </div>
            </details>
            {!isStaff && <p className="muted">New here? <Link to="/register"><b>Create a patient account</b></Link></p>}
            {isStaff && <p className="muted">Staff accounts are issued by hospital operations. Patients register separately.</p>}
            <p className="muted"><Link to="/">Back to {HOSPITAL.campus}</Link></p>
          </form>
        </section>
      </div>
    </div>
  );
}
