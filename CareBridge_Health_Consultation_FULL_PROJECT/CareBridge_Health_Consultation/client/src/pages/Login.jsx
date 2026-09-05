import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HeartPulse, ShieldCheck, ArrowRight } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { HOSPITAL } from "../utils";
import { GoldDust } from "../components/LiveFX";

const DEMOS = {
  patient: { email: "patient@carebridge.test", password: "patient123", label: "Fill patient login" },
  doctor: { email: "doctor@carebridge.test", password: "doctor123", label: "Fill doctor login" },
  nurse: { email: "nurse@carebridge.test", password: "nurse123", label: "Fill nurse login" },
  admin: { email: "admin@carebridge.test", password: "admin123", label: "Fill administrator login" },
};

const PORTALS = [
  { id: "patient", tab: "Patient", eyebrow: "Patients", title: "Patient sign-in", hero: "Your hospital record, in your hands.", blurb: `Book visits, pay invoices, collect receipts, and reserve a bed at ${HOSPITAL.name}.`, status: "Patient portal" },
  { id: "doctor", tab: "Clinician", eyebrow: "Staff", title: "Clinician sign-in", hero: "Clinical and operations sign-in.", blurb: "Doctors use the clinic board. Write prescriptions from chat or video. Administrators use operations for beds, staff, reports, billing, and the audit log.", status: "Staff access" },
  { id: "nurse", tab: "Nurse", eyebrow: "Pharmacy", title: "Nurse sign-in", hero: "Dispensary sign-in.", blurb: "Pharmacy nurses prepare hospital pickup orders and keep the Ridge cupboard current. Patients see stock live.", status: "Pharmacy nursing" },
  { id: "admin", tab: "Operations", eyebrow: "Staff", title: "Administrator sign-in", hero: "Operations sign-in.", blurb: "Beds, staff directory, clinic diary, tariff, billing, and the audit log.", status: "Hospital operations" },
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
    <div className={`login-page ${isStaff ? "staff-login" : ""} ${portal === "nurse" ? "nurse-login" : ""} ${portal === "admin" ? "admin-login" : ""} ${portal === "doctor" ? "doctor-login" : ""}`}>
      <section className="login-hero">
        <div className="kb-layer" aria-hidden="true" />
        <GoldDust count={12} />
        <Link to="/" className="brand large"><div className="brand-mark live"><HeartPulse size={24} /></div><div><b>{HOSPITAL.short}</b><span>{HOSPITAL.campus}</span></div></Link>
        <div>
          <div className="status confirmed" style={{ display: "inline-flex", gap: 6, marginBottom: 16 }}><ShieldCheck size={14} /> {meta.status}</div>
          <h1>{meta.hero}</h1>
          <p className="muted">{meta.blurb}</p>
        </div>
        <p className="muted">{HOSPITAL.phone} · Records office</p>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div>
            <span className="eyebrow">{meta.eyebrow}</span>
            <h2>{meta.title}</h2>
            <p className="muted">{HOSPITAL.name}, {HOSPITAL.city}</p>
          </div>
          <div className="tabs">
            {PORTALS.map((p) => (
              <button
                type="button"
                key={p.id}
                className={portal === p.id ? "active" : ""}
                onClick={() => { setPortal(p.id); setEmail(""); setPassword(""); setError(""); }}
              >
                {p.tab}
              </button>
            ))}
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
        </form>
      </section>
    </div>
  );
}
