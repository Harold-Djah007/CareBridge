import React, { useState } from "react";
import { Link } from "react-router-dom";
import { HeartPulse, ArrowRight, ShieldCheck } from "lucide-react";
import { api } from "../api";
import PhotoPicker from "../components/PhotoPicker";
import { useAuth, useToast } from "../state";
import { HOSPITAL } from "../utils";
import { GoldDust } from "../components/LiveFX";
import { UtilBar } from "../components/PublicChrome";

export default function Register() {
  const { login } = useAuth();
  const { push } = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", city: "", insurance: "", photo: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await api("/register", { method: "POST", body: JSON.stringify(form) });
      login(r.user);
      push("Account created. A welcome email is in your alerts.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-shell">
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
              <ShieldCheck size={14} /> Patient registration
            </div>
            <h1>Open a patient file at Ridge Campus.</h1>
            <p className="muted">Patients only. After registration you can book visits, pay published fees, collect receipts, and reserve a ward.</p>
            <p className="portal-secure">Secure access to your record · Staff use the portal chooser on sign-in</p>
          </div>
          <p className="muted">{HOSPITAL.phone} · {HOSPITAL.email}</p>
        </section>
        <section className="login-panel">
          <form className="login-card" onSubmit={submit}>
            <div>
              <span className="eyebrow">New patient</span>
              <h2>Create an account</h2>
              <p className="muted">{HOSPITAL.name} · {HOSPITAL.campus}</p>
            </div>
            <PhotoPicker value={form.photo} name={form.name} onChange={(photo) => set("photo", photo)} onError={setError} />
            <label>Full name<input value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required /></label>
            <label>Password<input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={6} /></label>
            <div className="form-grid">
              <label>Phone<input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
              <label>City<input value={form.city} onChange={(e) => set("city", e.target.value)} /></label>
            </div>
            <label>NHIS / insurance number<input value={form.insurance} onChange={(e) => set("insurance", e.target.value)} placeholder="Leave blank for self-pay" /></label>
            {error && <div className="error-box">{error}</div>}
            <button className="primary-btn full cta-pulse" disabled={loading}>{loading ? "Creating..." : <>Create account <ArrowRight size={18} /></>}</button>
            <p className="muted">Already registered? <Link to="/login"><b>Sign in to the patient portal</b></Link></p>
            <p className="muted"><Link to="/">Back to {HOSPITAL.campus}</Link></p>
          </form>
        </section>
      </div>
    </div>
  );
}
