import React, { useState } from "react";
import { Link } from "react-router-dom";
import { HeartPulse, ArrowRight } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";

export default function Register() {
  const { login } = useAuth();
  const { push } = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", city: "", insurance: "" });
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
    <div className="login-page">
      <section className="login-hero">
        <Link to="/" className="brand large"><div className="brand-mark live"><HeartPulse size={24} /></div><div><b>CareBridge</b><span>Health</span></div></Link>
        <div>
          <h1>Create your patient portal.</h1>
          <p className="muted">Book visits, pay published fees by MoMo, GCB, NHIS or cash, collect receipts, and reserve a ward.</p>
        </div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div><span className="eyebrow">New patient</span><h2>Create an account</h2></div>
          <label>Full name<input value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
          <label>Email<input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required /></label>
          <label>Password<input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={6} /></label>
          <div className="form-grid">
            <label>Phone<input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
            <label>City<input value={form.city} onChange={(e) => set("city", e.target.value)} /></label>
          </div>
          <label>NHIS / insurance number<input value={form.insurance} onChange={(e) => set("insurance", e.target.value)} placeholder="Leave blank for self-pay" /></label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-btn full" disabled={loading}>{loading ? "Creating..." : <>Create account <ArrowRight size={18} /></>}</button>
          <p className="muted">Already registered? <Link to="/login"><b>Sign in</b></Link></p>
        </form>
      </section>
    </div>
  );
}
