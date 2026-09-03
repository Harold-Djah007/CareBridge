import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HeartPulse, ShieldCheck, ArrowRight } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { HOSPITAL } from "../utils";

const STAFF = {
  doctor: { email: "doctor@carebridge.test", password: "doctor123" },
  admin: { email: "admin@carebridge.test", password: "admin123" },
};
const PATIENT = { email: "patient@carebridge.test", password: "patient123" };

export default function Login() {
  const { login } = useAuth();
  const { push } = useToast();
  const [params] = useSearchParams();
  const staffFirst = params.get("role") === "doctor" || params.get("role") === "admin";
  const [portal, setPortal] = useState(staffFirst ? "staff" : "patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await api("/login", { method: "POST", body: JSON.stringify({ email, password }) });
      login(r.user);
      push(`Signed in to ${HOSPITAL.short}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isStaff = portal === "staff";

  return (
    <div className={`login-page ${isStaff ? "staff-login" : ""}`}>
      <section className="login-hero">
        <Link to="/" className="brand large"><div className="brand-mark"><HeartPulse size={24} /></div><div><b>{HOSPITAL.short}</b><span>{HOSPITAL.campus}</span></div></Link>
        <div>
          <div className="status confirmed" style={{ display: "inline-flex", gap: 6, marginBottom: 16 }}><ShieldCheck size={14} /> {isStaff ? "Staff access" : "Patient portal"}</div>
          <h1>{isStaff ? "Clinical and operations sign-in." : "Your hospital record, in your hands."}</h1>
          <p className="muted">{isStaff ? "Doctors and administrators use this portal for clinic lists, admissions, and hospital operations." : `Book visits, message consultants, and reserve a bed at ${HOSPITAL.name}.`}</p>
        </div>
        <p className="muted">{HOSPITAL.phone} · Records office</p>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div>
            <span className="eyebrow">{isStaff ? "Staff" : "Patients"}</span>
            <h2>{isStaff ? "Staff sign-in" : "Patient sign-in"}</h2>
            <p className="muted">{HOSPITAL.name}, {HOSPITAL.city}</p>
          </div>
          <div className="tabs">
            <button type="button" className={!isStaff ? "active" : ""} onClick={() => { setPortal("patient"); setError(""); }}>Patient</button>
            <button type="button" className={isStaff ? "active" : ""} onClick={() => { setPortal("staff"); setError(""); }}>Hospital staff</button>
          </div>
          <label>{isStaff ? "Staff email" : "Email used at registration"}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-btn full" disabled={loading}>{loading ? "Signing in..." : <>Sign in <ArrowRight size={18} /></>}</button>
          <details className="demo-box">
            <summary className="muted" style={{ cursor: "pointer" }}>Training accounts for this hospital build</summary>
            <div style={{ marginTop: 10 }}>
              {!isStaff ? (
                <button type="button" onClick={() => { setEmail(PATIENT.email); setPassword(PATIENT.password); }}>Fill patient login</button>
              ) : (
                <>
                  <button type="button" onClick={() => { setEmail(STAFF.doctor.email); setPassword(STAFF.doctor.password); }}>Fill doctor login</button>
                  <button type="button" onClick={() => { setEmail(STAFF.admin.email); setPassword(STAFF.admin.password); }}>Fill administrator login</button>
                </>
              )}
            </div>
          </details>
          {!isStaff && <p className="muted">New here? <Link to="/register"><b>Create a patient account</b></Link></p>}
        </form>
      </section>
    </div>
  );
}
