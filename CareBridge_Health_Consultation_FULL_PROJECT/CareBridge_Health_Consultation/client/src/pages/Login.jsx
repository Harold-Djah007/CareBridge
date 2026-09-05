import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HeartPulse, Check, ArrowRight, UserRound, Stethoscope, Pill, Building2 } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { HOSPITAL } from "../utils";
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
    title: "Patient sign-in",
    blurb: `Welcome. Your visits, medicines, and bills wait here at ${HOSPITAL.name}.`,
  },
  {
    id: "doctor",
    tab: "Clinician",
    icon: Stethoscope,
    title: "Clinician sign-in",
    blurb: "Your clinic list and the people who need you today.",
  },
  {
    id: "nurse",
    tab: "Nurse",
    icon: Pill,
    title: "Nurse sign-in",
    blurb: "The cupboard and the families collecting medicines.",
  },
  {
    id: "admin",
    tab: "Operations",
    icon: Building2,
    title: "Administrator sign-in",
    blurb: "Beds, staff, and the quiet work that keeps Ridge kind.",
  },
];

const BENEFITS = [
  "See your next visit and the notes from last time",
  "Pay published fees and keep a numbered receipt",
  "Read a prescription and collect it at Ridge pharmacy",
  "Write to your named doctor on a private thread",
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
    <div className={`portal-shell split-login ${isStaff ? "staff-login" : ""} ${portal}-login`}>
      <UtilBar tone="navy" />
      <div className="login-page login-split">
        <section className="login-panel">
          <form className="login-card" onSubmit={submit}>
            <Link to="/" className="brand">
              <div className="brand-mark live"><HeartPulse size={22} /></div>
              <div><b>{HOSPITAL.name}</b><span>{HOSPITAL.campus}, {HOSPITAL.city}</span></div>
            </Link>
            <div>
              <span className="eyebrow">Patient portal</span>
              <h2>{meta.title}</h2>
              <p className="muted">{meta.blurb}</p>
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
        <section className="login-hero login-benefits">
          <div className="kb-layer" aria-hidden="true" />
          <div>
            <span className="eyebrow">Secure access</span>
            <h1>Your Ridge record, kept with care.</h1>
            <ul className="benefit-list">
              {BENEFITS.map((item) => (
                <li key={item}><Check size={18} /> {item}</li>
              ))}
            </ul>
          </div>
          <p className="muted">{HOSPITAL.phone} · Emergency {HOSPITAL.emergency}</p>
        </section>
      </div>
    </div>
  );
}
