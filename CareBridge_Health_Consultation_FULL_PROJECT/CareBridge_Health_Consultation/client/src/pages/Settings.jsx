import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bell, Building2, Check, Copy, Gauge, HeartPulse, IdCard, KeyRound, LogOut, MonitorCog,
  Palette, RefreshCw, Shield, ShieldCheck, Smartphone, Sparkles, UserRound, Wallet,
} from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { HOSPITAL, roleLabel } from "../utils";
import PhotoPicker from "../components/PhotoPicker";
import DutyToggle from "../components/DutyToggle";
import Avatar from "../components/Avatar";

const DEFAULT_APPEARANCE = { theme: "pearl", density: "comfortable", motion: "full", nav: "floating" };

const FILE_NOTE = {
  patient: "This identity follows you across receipts, admissions and your clinical record.",
  doctor: "This identity appears on prescriptions, clinic queues and staff workflows.",
  nurse: "This identity appears in dispensing, inventory and hospital staff workflows.",
  admin: "This identity appears in operations, notices and governance workflows.",
};

function readAppearance() {
  try {
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(localStorage.getItem("carebridge-appearance") || "{}") };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function tabFromParams(params, role) {
  const tab = params.get("tab");
  if (["profile", "account", "identity"].includes(tab)) return "profile";
  if (["security", "signin", "password"].includes(tab)) return "security";
  if (tab === "pay" && role === "patient") return "pay";
  if (["notifications", "notices", "alerts"].includes(tab)) return "notifications";
  if (["experience", "appearance", "display"].includes(tab)) return "experience";
  return "profile";
}

function Segmented({ value, options, onChange, ariaLabel }) {
  return (
    <div className="cbx-settings-segment" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={value === option.id ? "is-selected" : ""}
          onClick={() => onChange(option.id)}
        >
          {option.swatch && <i className={`cbx-settings-swatch ${option.swatch}`} />}
          <span>{option.label}</span>
          {value === option.id && <Check size={15} />}
        </button>
      ))}
    </div>
  );
}

function PreferenceRow({ icon: Icon, title, description, children }) {
  return (
    <div className="cbx-settings-preference-row">
      <div className="cbx-settings-preference-copy">
        <span className="cbx-settings-row-icon"><Icon size={18} /></span>
        <div><strong>{title}</strong><p>{description}</p></div>
      </div>
      <div className="cbx-settings-preference-control">{children}</div>
    </div>
  );
}

function RecoveryCodes({ codes, onCopy }) {
  if (!codes?.length) return null;
  return (
    <div className="cbx-settings-section" role="status" aria-live="polite">
      <div className="cbx-settings-section-head">
        <div><h3>Save your recovery codes now</h3><p>Each code works once. Store them somewhere private and separate from this device.</p></div>
        <button type="button" className="secondary-btn" onClick={onCopy}><Copy size={16} /> Copy codes</button>
      </div>
      <div className="cbx-settings-form-grid">
        {codes.map((code) => <code key={code} style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: ".04em" }}>{code}</code>)}
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const prefs = user.paymentPrefs || {};
  const sections = [
    { id: "profile", label: "Profile", icon: UserRound, help: "Identity & clinical details" },
    { id: "experience", label: "Display", icon: MonitorCog, help: "Appearance & motion" },
    { id: "security", label: "Security", icon: Shield, help: "Password, MFA & sessions" },
    ...(user.role === "patient" ? [{ id: "pay", label: "Payments", icon: Wallet, help: "Checkout defaults" }] : []),
    { id: "notifications", label: "Notifications", icon: Bell, help: "Email & app notices" },
  ];

  const [tab, setTab] = useState(() => tabFromParams(params, user.role));
  const [appearance, setAppearance] = useState(readAppearance);
  const [account, setAccount] = useState({
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    city: user.city || "",
    about: user.about || "",
    specialty: user.specialty || "",
    available: user.available !== false,
    photo: user.photo || "",
    emergencyContact: user.emergencyContact || "",
    allergies: user.allergies || "",
    insurance: user.insurance || "",
    bloodType: user.bloodType || "",
  });
  const [security, setSecurity] = useState({ currentPassword: "", password: "", confirm: "" });
  const [mfa, setMfa] = useState({ enabled: false, recoveryCodesRemaining: 0, enrollmentPending: false, encryptionConfigured: false });
  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaPassword, setMfaPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [sessions, setSessions] = useState({ currentSessionId: "", sessions: [] });
  const [pay, setPay] = useState({
    method: prefs.method || "momo",
    momoNetwork: prefs.momoNetwork || "mtn",
    momoNumber: prefs.momoNumber || user.phone || "",
    nhisNumber: prefs.nhisNumber || user.insurance || "",
  });
  const [alerts, setAlerts] = useState({
    emailAlerts: user.emailAlerts !== false,
    alertPrefs: {
      appointments: user.alertPrefs?.appointments !== false,
      wards: user.alertPrefs?.wards !== false,
      messages: user.alertPrefs?.messages !== false,
      account: user.alertPrefs?.account !== false,
      support: user.alertPrefs?.support !== false,
    },
  });
  const [busy, setBusy] = useState("");

  const fileNo = user.role === "patient" ? (user.mrn || "Pending MRN") : (user.employeeId || "Staff file");
  const desk = user.role === "patient"
    ? (account.insurance || user.insurance || "Self-pay")
    : (user.department || account.specialty || user.specialty || roleLabel(user.role));

  const loadSecurityState = async () => {
    try {
      const [mfaState, sessionState] = await Promise.all([api("/security/mfa"), api("/security/sessions")]);
      setMfa(mfaState);
      setSessions(sessionState);
    } catch (err) {
      push(err.message, "error");
    }
  };

  useEffect(() => {
    if (tab === "security") loadSecurityState();
  }, [tab]);

  const goTab = (id) => {
    setTab(id);
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next, { replace: true });
  };

  const patch = async (body, ok) => {
    const next = await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify(body) });
    updateUser({ ...user, ...next });
    push(ok);
    return next;
  };

  const saveAppearance = (next) => {
    setAppearance(next);
    localStorage.setItem("carebridge-appearance", JSON.stringify(next));
    window.dispatchEvent(new Event("carebridge:appearance"));
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    setBusy("profile");
    try {
      await patch({
        name: account.name,
        email: account.email,
        phone: account.phone,
        city: account.city,
        about: account.about,
        specialty: account.specialty,
        photo: account.photo,
        ...(user.role === "patient" ? {
          emergencyContact: account.emergencyContact,
          allergies: account.allergies,
          insurance: account.insurance,
          bloodType: account.bloodType,
        } : {}),
      }, "Profile saved to your hospital identity.");
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (security.password !== security.confirm) return push("New passwords do not match.", "error");
    setBusy("security");
    try {
      await patch({ currentPassword: security.currentPassword, password: security.password }, "Password updated. Other signed-in devices were revoked.");
      setSecurity({ currentPassword: "", password: "", confirm: "" });
      await loadSecurityState();
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const startMfa = async () => {
    if (!mfaPassword) return push("Enter your current password before starting MFA setup.", "error");
    setBusy("mfa-start");
    try {
      const setup = await api("/security/mfa/enroll", { method: "POST", body: JSON.stringify({ currentPassword: mfaPassword }) });
      setMfaSetup(setup);
      setMfaCode("");
      setRecoveryCodes([]);
      push("Authenticator setup started.");
      await loadSecurityState();
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const confirmMfa = async () => {
    if (!mfaCode.trim()) return push("Enter the six-digit authenticator code.", "error");
    setBusy("mfa-confirm");
    try {
      const result = await api("/security/mfa/confirm", { method: "POST", body: JSON.stringify({ code: mfaCode }) });
      setRecoveryCodes(result.recoveryCodes || []);
      setMfaSetup(null);
      setMfaCode("");
      setMfaPassword("");
      push("Multi-factor authentication enabled.");
      await loadSecurityState();
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const replaceRecoveryCodes = async () => {
    if (!mfaCode.trim()) return push("Enter a current authenticator code first.", "error");
    setBusy("mfa-recovery");
    try {
      const result = await api("/security/mfa/recovery-codes", { method: "POST", body: JSON.stringify({ code: mfaCode }) });
      setRecoveryCodes(result.recoveryCodes || []);
      setMfaCode("");
      push("Old recovery codes are invalid. Save the new set.");
      await loadSecurityState();
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const turnOffMfa = async () => {
    if (!disablePassword || !mfaCode.trim()) return push("Enter your password and authenticator or recovery code.", "error");
    setBusy("mfa-disable");
    try {
      await api("/security/mfa/disable", { method: "POST", body: JSON.stringify({ currentPassword: disablePassword, code: mfaCode }) });
      setMfaSetup(null);
      setRecoveryCodes([]);
      setMfaCode("");
      setDisablePassword("");
      push("Multi-factor authentication disabled. Other sessions were revoked.");
      await loadSecurityState();
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const revokeOthers = async () => {
    setBusy("sessions");
    try {
      const result = await api("/security/sessions/revoke-others", { method: "POST" });
      push(`${result.revoked || 0} other session${result.revoked === 1 ? "" : "s"} revoked.`);
      await loadSecurityState();
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const copyRecoveryCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      push("Recovery codes copied.");
    } catch {
      push("Copy was blocked by the browser. Save the codes manually.", "error");
    }
  };

  const savePay = async (event) => {
    event.preventDefault();
    setBusy("pay");
    try {
      await patch({ paymentPrefs: pay, insurance: pay.nhisNumber || user.insurance }, "Payment defaults saved.");
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const saveAlerts = async (event) => {
    event.preventDefault();
    setBusy("notifications");
    try {
      await patch(alerts, "Notification preferences saved.");
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const testEmail = async () => {
    try {
      await api("/emails/test", { method: "POST", body: JSON.stringify({ userId: user.id }) });
      push("Test notice sent.");
    } catch (err) { push(err.message, "error"); }
  };

  return (
    <div className="cbx-settings-page">
      <header className="cbx-settings-masthead">
        <div>
          <span className="cbx-settings-kicker">System preferences</span>
          <h1>Control centre</h1>
          <p>Manage your identity, privacy, notifications and workspace experience from one clear settings console.</p>
        </div>
        <button className="cbx-settings-signout" type="button" onClick={() => { logout(); navigate("/login"); }}>
          <LogOut size={17} /> Sign out
        </button>
      </header>

      <div className="cbx-settings-shell">
        <aside className="cbx-settings-sidebar">
          <div className="cbx-settings-person">
            <Avatar person={{ ...user, photo: account.photo, name: account.name }} className="large" />
            <div>
              <strong>{account.name || user.name}</strong>
              <span>{roleLabel(user.role)}</span>
              <small>{fileNo}</small>
            </div>
          </div>

          <div className="cbx-settings-context">
            <span><Building2 size={15} /> {HOSPITAL.campus}</span>
            <span><HeartPulse size={15} /> {desk}</span>
          </div>

          <nav className="cbx-settings-nav" aria-label="Settings sections">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  className={tab === section.id ? "is-active" : ""}
                  onClick={() => goTab(section.id)}
                >
                  <Icon size={18} />
                  <span><strong>{section.label}</strong><small>{section.help}</small></span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="cbx-settings-main">
          {tab === "profile" && (
            <form className="cbx-settings-document" onSubmit={saveAccount}>
              <div className="cbx-settings-document-head">
                <div><span>Identity</span><h2>Profile & clinical identity</h2><p>{FILE_NOTE[user.role] || FILE_NOTE.patient}</p></div>
                <IdCard size={24} />
              </div>

              <section className="cbx-settings-section">
                <div className="cbx-settings-section-head"><div><h3>Profile photo</h3><p>Your visual identity across CareBridge.</p></div></div>
                <div className="cbx-settings-profile-line">
                  <PhotoPicker value={account.photo} name={account.name} onChange={(photo) => setAccount({ ...account, photo })} onError={(message) => push(message, "error")} />
                  <div><strong>{account.name || user.name}</strong><span>{desk}</span><small>{fileNo}</small></div>
                </div>
              </section>

              <section className="cbx-settings-section">
                <div className="cbx-settings-section-head"><div><h3>Contact details</h3><p>Used for hospital communication, receipts and account recovery.</p></div></div>
                <div className="cbx-settings-form-grid">
                  <label>Full name<input value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} required /></label>
                  <label>Email<input type="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} required /></label>
                  <label>Phone<input value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} /></label>
                  <label>City<input value={account.city} onChange={(e) => setAccount({ ...account, city: e.target.value })} /></label>
                </div>
              </section>

              {user.role === "patient" && (
                <section className="cbx-settings-section">
                  <div className="cbx-settings-section-head"><div><h3>Clinical essentials</h3><p>Important facts clinicians should be able to identify quickly.</p></div></div>
                  <div className="cbx-settings-form-grid">
                    <label>Emergency contact<input value={account.emergencyContact} onChange={(e) => setAccount({ ...account, emergencyContact: e.target.value })} /></label>
                    <label>Allergies<input value={account.allergies} onChange={(e) => setAccount({ ...account, allergies: e.target.value })} /></label>
                    <label>Insurance / NHIS<input value={account.insurance} onChange={(e) => setAccount({ ...account, insurance: e.target.value })} /></label>
                    <label>Blood type<input value={account.bloodType} onChange={(e) => setAccount({ ...account, bloodType: e.target.value })} /></label>
                  </div>
                </section>
              )}

              {(user.role === "doctor" || user.role === "admin" || user.role === "nurse") && (
                <section className="cbx-settings-section">
                  <div className="cbx-settings-section-head"><div><h3>Professional identity</h3><p>Shown in clinical and hospital operations workflows.</p></div></div>
                  <label>Title / specialty<input value={account.specialty} onChange={(e) => setAccount({ ...account, specialty: e.target.value })} /></label>
                  {user.role === "doctor" && (
                    <div className="cbx-settings-inline-setting">
                      <div><strong>Directory availability</strong><p>Controls whether patients see you as currently available.</p></div>
                      <DutyToggle available={account.available} onChange={async (available) => {
                        setAccount({ ...account, available });
                        try {
                          const next = await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ available }) });
                          updateUser({ ...user, ...next });
                          push(available ? "You are now available." : "You are now marked busy.");
                        } catch (err) { push(err.message, "error"); }
                      }} />
                    </div>
                  )}
                </section>
              )}

              <section className="cbx-settings-section">
                <div className="cbx-settings-section-head"><div><h3>About</h3><p>A short description used where your profile is shown.</p></div></div>
                <label>Profile description<textarea rows="4" value={account.about} onChange={(e) => setAccount({ ...account, about: e.target.value })} /></label>
              </section>

              <footer className="cbx-settings-actions"><button className="primary-btn" disabled={busy === "profile"}>{busy === "profile" ? "Saving…" : "Save profile"}</button></footer>
            </form>
          )}

          {tab === "experience" && (
            <section className="cbx-settings-document">
              <div className="cbx-settings-document-head">
                <div><span>Display</span><h2>Workspace experience</h2><p>Choose the visual and interaction style that works best for you.</p></div>
                <MonitorCog size={24} />
              </div>

              <div className={`cbx-settings-preview cbx-settings-preview-${appearance.theme}`}>
                <div><i /><i /><i /></div>
                <span><small>Live preview</small><strong>CareBridge workspace</strong><em>{appearance.density} density · {appearance.motion} motion</em></span>
              </div>

              <div className="cbx-settings-preferences">
                <PreferenceRow icon={Palette} title="Theme" description="Choose a calm clinical color system rather than decorative page styling.">
                  <Segmented ariaLabel="Theme" value={appearance.theme} onChange={(theme) => saveAppearance({ ...appearance, theme })} options={[
                    { id: "pearl", label: "Pearl", swatch: "pearl" },
                    { id: "midnight", label: "Midnight", swatch: "midnight" },
                    { id: "sage", label: "Sage", swatch: "sage" },
                  ]} />
                </PreferenceRow>
                <PreferenceRow icon={Gauge} title="Information density" description="Control how much information appears on one screen.">
                  <Segmented ariaLabel="Information density" value={appearance.density} onChange={(density) => saveAppearance({ ...appearance, density })} options={[
                    { id: "comfortable", label: "Comfortable" },
                    { id: "compact", label: "Compact" },
                  ]} />
                </PreferenceRow>
                <PreferenceRow icon={Sparkles} title="Motion" description="Control transitions and ambient movement across CareBridge.">
                  <Segmented ariaLabel="Motion" value={appearance.motion} onChange={(motion) => saveAppearance({ ...appearance, motion })} options={[
                    { id: "full", label: "Cinematic" },
                    { id: "subtle", label: "Subtle" },
                    { id: "reduced", label: "Reduced" },
                  ]} />
                </PreferenceRow>
                <PreferenceRow icon={MonitorCog} title="Navigation" description="Choose between layered floating navigation or a flatter enterprise frame.">
                  <Segmented ariaLabel="Navigation" value={appearance.nav} onChange={(nav) => saveAppearance({ ...appearance, nav })} options={[
                    { id: "floating", label: "Floating" },
                    { id: "flush", label: "Flush" },
                  ]} />
                </PreferenceRow>
              </div>
            </section>
          )}

          {tab === "security" && (
            <section className="cbx-settings-document">
              <div className="cbx-settings-document-head"><div><span>Security</span><h2>Password, MFA & sessions</h2><p>Control every layer that protects your {roleLabel(user.role).toLowerCase()} workspace.</p></div><Shield size={24} /></div>
              <div className="cbx-settings-security-note"><ShieldCheck size={19} /><div><strong>{mfa.enabled ? "Multi-factor protection is on" : "Protected session"}</strong><p>{mfa.enabled ? `Authenticator MFA is active with ${mfa.recoveryCodesRemaining || 0} recovery codes remaining.` : "Your browser keeps a revocable session token, not your password."}</p></div></div>

              <form className="cbx-settings-section" onSubmit={savePassword}>
                <div className="cbx-settings-section-head"><div><h3>Password</h3><p>Changing your password revokes other active devices.</p></div><KeyRound size={19} /></div>
                <div className="cbx-settings-form-grid single">
                  <label>Current password<input type="password" value={security.currentPassword} onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })} required autoComplete="current-password" /></label>
                  <label>New password<input type="password" value={security.password} onChange={(e) => setSecurity({ ...security, password: e.target.value })} required minLength={10} autoComplete="new-password" /></label>
                  <label>Confirm new password<input type="password" value={security.confirm} onChange={(e) => setSecurity({ ...security, confirm: e.target.value })} required minLength={10} autoComplete="new-password" /></label>
                </div>
                <footer className="cbx-settings-actions"><button className="primary-btn" disabled={busy === "security"}>{busy === "security" ? "Updating…" : "Update password"}</button></footer>
              </form>

              <section className="cbx-settings-section">
                <div className="cbx-settings-section-head">
                  <div><h3>Authenticator MFA</h3><p>Require a rotating six-digit code after your password. Recovery codes provide one-time emergency access.</p></div>
                  <span className={`status ${mfa.enabled ? "complete" : "pending"}`}>{mfa.enabled ? "Enabled" : "Off"}</span>
                </div>

                {!mfa.enabled && !mfaSetup && (
                  <div className="cbx-settings-form-grid single">
                    <label>Current password<input type="password" value={mfaPassword} onChange={(e) => setMfaPassword(e.target.value)} autoComplete="current-password" placeholder="Confirm your identity" /></label>
                    <div className="cbx-settings-actions"><button type="button" className="primary-btn" onClick={startMfa} disabled={busy === "mfa-start"}><Smartphone size={17} /> {busy === "mfa-start" ? "Starting…" : "Set up authenticator"}</button></div>
                  </div>
                )}

                {!mfa.enabled && mfaSetup && (
                  <div className="cbx-settings-form-grid single">
                    <div className="cbx-settings-security-note"><Smartphone size={19} /><div><strong>Add CareBridge to your authenticator app</strong><p>Scan/import the URI or enter the setup key manually. The setup expires automatically.</p></div></div>
                    <label>Setup key<input value={mfaSetup.secret || ""} readOnly aria-label="Authenticator setup key" /></label>
                    <label>Authenticator URI<textarea rows="3" value={mfaSetup.otpauthUri || ""} readOnly aria-label="Authenticator URI" /></label>
                    <label>Six-digit verification code<input inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="123456" /></label>
                    <div className="cbx-settings-actions"><button type="button" className="primary-btn" onClick={confirmMfa} disabled={busy === "mfa-confirm"}><ShieldCheck size={17} /> {busy === "mfa-confirm" ? "Verifying…" : "Verify & enable MFA"}</button><button type="button" className="secondary-btn" onClick={() => { setMfaSetup(null); setMfaCode(""); }}>Cancel setup</button></div>
                  </div>
                )}

                {mfa.enabled && (
                  <div className="cbx-settings-form-grid single">
                    <div className="cbx-settings-inline-setting"><div><strong>Recovery codes</strong><p>{mfa.recoveryCodesRemaining || 0} unused code{mfa.recoveryCodesRemaining === 1 ? "" : "s"} remain.</p></div><ShieldCheck size={20} /></div>
                    <label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="123456" /></label>
                    <div className="cbx-settings-actions"><button type="button" className="secondary-btn" onClick={replaceRecoveryCodes} disabled={busy === "mfa-recovery"}><RefreshCw size={16} /> Replace recovery codes</button></div>
                    <label>Password to disable MFA<input type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} autoComplete="current-password" /></label>
                    <div className="cbx-settings-actions"><button type="button" className="secondary-btn" onClick={turnOffMfa} disabled={busy === "mfa-disable"}>Disable MFA</button></div>
                  </div>
                )}
              </section>

              <RecoveryCodes codes={recoveryCodes} onCopy={copyRecoveryCodes} />

              <section className="cbx-settings-section">
                <div className="cbx-settings-section-head"><div><h3>Active sessions</h3><p>Review devices currently allowed to use your CareBridge account.</p></div><button type="button" className="secondary-btn" onClick={loadSecurityState}><RefreshCw size={15} /> Refresh</button></div>
                <div className="cbx-settings-notification-list">
                  {(sessions.sessions || []).map((session) => (
                    <div key={session.id} className="cbx-settings-inline-setting">
                      <div><strong>{session.id === sessions.currentSessionId ? "This device" : "Signed-in device"}</strong><p>{session.createdAt ? new Date(session.createdAt).toLocaleString() : "Session"} · expires {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : "later"}{session.ip ? ` · ${session.ip}` : ""}</p></div>
                      <span className={`status ${session.id === sessions.currentSessionId ? "complete" : "pending"}`}>{session.id === sessions.currentSessionId ? "Current" : "Active"}</span>
                    </div>
                  ))}
                  {!sessions.sessions?.length && <p className="muted">Session inventory is loading.</p>}
                </div>
                <footer className="cbx-settings-actions"><button type="button" className="secondary-btn" onClick={revokeOthers} disabled={busy === "sessions"}>{busy === "sessions" ? "Revoking…" : "Sign out every other device"}</button></footer>
              </section>
            </section>
          )}

          {tab === "pay" && user.role === "patient" && (
            <form className="cbx-settings-document" onSubmit={savePay}>
              <div className="cbx-settings-document-head"><div><span>Payments</span><h2>Checkout preferences</h2><p>Save your usual payment details without locking you into one method.</p></div><Wallet size={24} /></div>
              <section className="cbx-settings-section">
                <div className="cbx-settings-form-grid">
                  <label>Preferred method<select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option value="momo">Mobile money</option><option value="bank">Bank transfer</option><option value="nhis">NHIS / insurance</option><option value="cash">Cash at cashier</option></select></label>
                  <label>MoMo network<select value={pay.momoNetwork} onChange={(e) => setPay({ ...pay, momoNetwork: e.target.value })}><option value="mtn">MTN MoMo</option><option value="telecel">Telecel Cash</option><option value="at">AirtelTigo Money</option></select></label>
                  <label>Wallet number<input value={pay.momoNumber} onChange={(e) => setPay({ ...pay, momoNumber: e.target.value })} placeholder="024…" /></label>
                  <label>NHIS / policy number<input value={pay.nhisNumber} onChange={(e) => setPay({ ...pay, nhisNumber: e.target.value })} /></label>
                </div>
              </section>
              <footer className="cbx-settings-actions"><button className="primary-btn" disabled={busy === "pay"}>{busy === "pay" ? "Saving…" : "Save payment defaults"}</button></footer>
            </form>
          )}

          {tab === "notifications" && (
            <form className="cbx-settings-document" onSubmit={saveAlerts}>
              <div className="cbx-settings-document-head"><div><span>Notifications</span><h2>Communication preferences</h2><p>Choose which hospital events should reach your inbox.</p></div><Bell size={24} /></div>
              <div className="cbx-settings-notification-list">
                <label><span><strong>Email notifications</strong><small>Send hospital updates to {user.email}</small></span><input type="checkbox" checked={alerts.emailAlerts} onChange={(e) => setAlerts({ ...alerts, emailAlerts: e.target.checked })} /></label>
                {[["appointments", "Appointments", "Consultations scheduled or changed"],["wards", "Admissions", "Bed requests and admission decisions"],["messages", "Messages", "New care-team communication"],["account", "Account", "Receipts and billing notices"],["support", "Support", "Help-desk replies and operations updates"]].map(([key, title, text]) => (
                  <label key={key}><span><strong>{title}</strong><small>{text}</small></span><input type="checkbox" checked={alerts.alertPrefs[key]} disabled={!alerts.emailAlerts} onChange={(e) => setAlerts((current) => ({ ...current, alertPrefs: { ...current.alertPrefs, [key]: e.target.checked } }))} /></label>
                ))}
              </div>
              <footer className="cbx-settings-actions"><button className="primary-btn" disabled={busy === "notifications"}>{busy === "notifications" ? "Saving…" : "Save notifications"}</button><button type="button" className="secondary-btn" onClick={testEmail}>Send test notice</button></footer>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
