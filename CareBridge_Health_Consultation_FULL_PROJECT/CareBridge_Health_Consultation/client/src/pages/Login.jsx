import React, { useState } from "react";
import { HeartPulse, ShieldCheck, Video, MessageCircle, BedDouble, ArrowRight, Stethoscope } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../main";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("patient@carebridge.test");
  const [password, setPassword] = useState("patient123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try { const r = await api("/login", { method: "POST", body: JSON.stringify({ email, password }) }); login(r.user); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const fill = (role) => {
    if (role === "doctor") { setEmail("doctor@carebridge.test"); setPassword("doctor123"); }
    else { setEmail("patient@carebridge.test"); setPassword("patient123"); }
  };

  return <div className="login-page">
    <section className="login-hero">
      <div className="brand large"><div className="brand-mark"><HeartPulse size={24}/></div><div><b>CareBridge</b><span>Health</span></div></div>
      <div className="hero-copy">
        <div className="tag"><ShieldCheck size={16}/> Secure digital healthcare</div>
        <h1>Your hospital, closer than ever.</h1>
        <p>Consult a doctor, message your care team, join a video visit, and reserve a ward before you arrive.</p>
        <div className="hero-features">
          <div><Video/><span><b>Video consultations</b><small>Meet your doctor from anywhere.</small></span></div>
          <div><MessageCircle/><span><b>Live care chat</b><small>Stay connected before and after visits.</small></span></div>
          <div><BedDouble/><span><b>Ward reservations</b><small>Plan admissions before reaching hospital.</small></span></div>
        </div>
      </div>
      <div className="trust-row"><span><ShieldCheck size={16}/> Privacy-first design</span><span><Stethoscope size={16}/> Built for modern clinical care</span></div>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <div><span className="eyebrow">Welcome back</span><h2>Sign in to CareBridge</h2><p>Access your personalized healthcare workspace.</p></div>
        <label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
        {error && <div className="error-box">{error}</div>}
        <button className="primary-btn full" disabled={loading}>{loading ? "Signing in..." : <>Sign in <ArrowRight size={18}/></>}</button>
        <div className="demo-box"><span>Demo access</span><div><button type="button" onClick={()=>fill("patient")}>Use patient account</button><button type="button" onClick={()=>fill("doctor")}>Use doctor account</button></div></div>
      </form>
    </section>
  </div>;
}
