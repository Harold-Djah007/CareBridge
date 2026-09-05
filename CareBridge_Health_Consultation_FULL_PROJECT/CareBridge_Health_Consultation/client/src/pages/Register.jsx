import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HeartPulse, ArrowRight, Check } from "lucide-react";
import { api } from "../api";
import PhotoPicker from "../components/PhotoPicker";
import { useAuth, useToast } from "../state";
import { HOSPITAL } from "../utils";
import { UtilBar } from "../components/PublicChrome";

function readIntent(params) {
  try {
    const raw = params.get("intent");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      name: parsed.name || "",
      email: parsed.email || "",
      phone: parsed.phone || "",
    };
  } catch {
    return {};
  }
}

export default function Register() {
  const { login } = useAuth();
  const { push } = useToast();
  const [params] = useSearchParams();
  const [form, setForm] = useState(() => ({
    name: "", email: "", password: "", phone: "", city: "", insurance: "", photo: "", ...readIntent(params),
  }));
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
    <div className="portal-shell split-login">
      <UtilBar tone="navy" />
      <div className="login-page login-split">
        <section className="login-panel">
          <form className="login-card" onSubmit={submit}>
            <Link to="/" className="brand">
              <div className="brand-mark live"><HeartPulse size={22} /></div>
              <div><b>{HOSPITAL.name}</b><span>{HOSPITAL.campus}, {HOSPITAL.city}</span></div>
            </Link>
            <div>
              <span className="eyebrow">New patient</span>
              <h2>Create an account</h2>
              <p className="muted">Patients only. After registration you can book visits, pay published fees, and reserve a ward.</p>
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
        <section className="login-hero login-benefits">
          <div className="kb-layer" aria-hidden="true" />
          <div>
            <span className="eyebrow">Patient registration</span>
            <h1>Open a patient file at Ridge Campus.</h1>
            <ul className="benefit-list">
              <li><Check size={18} /> Book a named Ridge consultant</li>
              <li><Check size={18} /> Pay published fees and collect receipts</li>
              <li><Check size={18} /> Keep labs and prescriptions on one MRN</li>
              <li><Check size={18} /> Reserve a ward before you travel</li>
            </ul>
          </div>
          <p className="muted">{HOSPITAL.phone} · {HOSPITAL.email}</p>
        </section>
      </div>
    </div>
  );
}
