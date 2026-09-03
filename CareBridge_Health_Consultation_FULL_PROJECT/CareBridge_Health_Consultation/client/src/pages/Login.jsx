import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HeartPulse, ShieldCheck, Video, MessageCircle, BedDouble, ArrowRight, Stethoscope } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";

const demos = {
  patient: { email: "patient@carebridge.test", password: "patient123", label: "Patient" },
  doctor: { email: "doctor@carebridge.test", password: "doctor123", label: "Doctor" },
  admin: { email: "admin@carebridge.test", password: "admin123", label: "Admin" },
};

export default function Login() {
  const { login } = useAuth();
  const { push } = useToast();
  const [params] = useSearchParams();
  const initialRole = ["patient", "doctor", "admin"].includes(params.get("role")) ? params.get("role") : "patient";
  const [role, setRole] = useState(initialRole);
  const filled = useMemo(() => demos[role], [role]);
  const [email, setEmail] = useState(filled.email);
  const [password, setPassword] = useState(filled.password);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const applyRole = (next) => {
    setRole(next);
    setEmail(demos[next].email);
    setPassword(demos[next].password);
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await api("/login", { method: "POST", body: JSON.stringify({ email, password }) });
      login(r.user);
      push(`Welcome back, ${r.user.name.split(" ")[0]}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-hero">
        <Link to="/" className="brand large"><div className="brand-mark"><HeartPulse size={24} /></div><div><b>CareBridge</b><span>Health</span></div></Link>
        <div>
          <div className="status confirmed" style={{ display: "inline-flex", gap: 6, marginBottom: 16 }}><ShieldCheck size={14} /> Encrypted sign-in</div>
          <h1>Your hospital, closer than ever.</h1>
          <p className="muted">Patients, doctors, and administrators each get a working workspace — not a brochure.</p>
          <div className="feature-grid" style={{ padding: 0, marginTop: 28, gridTemplateColumns: "1fr" }}>
            <div style={{ display: "flex", gap: 12 }}><Video /><span><b>Video consultations</b><br /><small className="muted">Join a live visit with camera controls that work.</small></span></div>
            <div style={{ display: "flex", gap: 12 }}><MessageCircle /><span><b>Live care chat</b><br /><small className="muted">Message before and after the appointment.</small></span></div>
            <div style={{ display: "flex", gap: 12 }}><BedDouble /><span><b>Ward + email alerts</b><br /><small className="muted">Know when a bed is accepted, in your inbox.</small></span></div>
          </div>
        </div>
        <div className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}><Stethoscope size={16} /> Built for modern clinical care</div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div>
            <span className="eyebrow">Welcome back</span>
            <h2>Sign in to CareBridge</h2>
            <p className="muted">Choose your workspace, then continue.</p>
          </div>
          <div className="tabs">
            {Object.keys(demos).map((key) => (
              <button type="button" key={key} className={role === key ? "active" : ""} onClick={() => applyRole(key)}>{demos[key].label}</button>
            ))}
          </div>
          <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-btn full" disabled={loading}>{loading ? "Signing in..." : <>Sign in <ArrowRight size={18} /></>}</button>
          <div className="demo-box">
            <span>Demo access — fills the form, then you can sign in</span>
            <div>
              {Object.keys(demos).map((key) => (
                <button type="button" key={key} onClick={() => applyRole(key)}>Use {demos[key].label.toLowerCase()} account</button>
              ))}
            </div>
          </div>
          <p className="muted">New patient? <Link to="/register"><b>Create an account</b></Link></p>
        </form>
      </section>
    </div>
  );
}
