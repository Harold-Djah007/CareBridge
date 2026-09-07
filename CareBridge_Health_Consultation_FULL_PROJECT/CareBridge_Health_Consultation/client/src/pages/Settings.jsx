import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bell, Building2, Check, Gauge, HeartPulse, IdCard, LogOut, MonitorCog,
  Palette, Shield, Sparkles, UserRound, Wallet,
} from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { HOSPITAL, roleLabel } from "../utils";
import PhotoPicker from "../components/PhotoPicker";
import DutyToggle from "../components/DutyToggle";
import Avatar from "../components/Avatar";
import PageHero from "../components/PageHero";

const DEFAULT_APPEARANCE = { theme: "pearl", density: "comfortable", motion: "full", nav: "floating" };

const FILE_NOTE = {
  patient: "Used across receipts, admissions and the clinical record your care team sees.",
  doctor: "Used across prescriptions, clinic queues and the staff directory.",
  nurse: "Used across dispensing queues and hospital staff workflows.",
  admin: "Used across operations, notices and hospital governance workflows.",
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

function SettingChoice({ active, icon: Icon, title, text, onClick }) {
  return (
    <button type="button" className={`cbv6-choice ${active ? "is-selected" : ""}`} onClick={onClick}>
      <span><Icon size={18} /></span>
      <div><strong>{title}</strong><small>{text}</small></div>
      {active && <Check size={16} />}
    </button>
  );
}

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const prefs = user.paymentPrefs || {};
  const sections = [
    { id: "profile", label: "Profile & identity", icon: UserRound, help: "Personal and clinical identity" },
    { id: "experience", label: "Experience", icon: Sparkles, help: "Theme, motion and density" },
    { id: "security", label: "Security", icon: Shield, help: "Password and access" },
    ...(user.role === "patient" ? [{ id: "pay", label: "Payments", icon: Wallet, help: "Preferred payment defaults" }] : []),
    { id: "notifications", label: "Notifications", icon: Bell, help: "Email and in-app alerts" },
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
  const desk = user.role === "patient" ? (account.insurance || user.insurance || "Self-pay") : (user.department || account.specialty || user.specialty || roleLabel(user.role));

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

  const saveAccount = async (e) => {
    e.preventDefault();
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

  const savePassword = async (e) => {
    e.preventDefault();
    if (security.password !== security.confirm) return push("New passwords do not match.", "error");
    setBusy("security");
    try {
      await patch({ currentPassword: security.currentPassword, password: security.password }, "Password updated.");
      setSecurity({ currentPassword: "", password: "", confirm: "" });
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const savePay = async (e) => {
    e.preventDefault();
    setBusy("pay");
    try {
      await patch({ paymentPrefs: pay, insurance: pay.nhisNumber || user.insurance }, "Payment defaults saved.");
    } catch (err) { push(err.message, "error"); } finally { setBusy(""); }
  };

  const saveAlerts = async (e) => {
    e.preventDefault();
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
    <div className="cbv6-settings">
      <PageHero
        scene="settings"
        eyebrow="Personal workspace"
        title="Settings"
        lead="Control your identity, security, notifications and the way CareBridge feels to use."
        actions={<button className="secondary-btn" type="button" onClick={() => { logout(); navigate("/login"); }}><LogOut size={16} /> Sign out</button>}
      />

      <div className="cbv6-settings-shell">
        <aside className="cbv6-settings-nav">
          <div className="cbv6-settings-identity">
            <Avatar person={{ ...user, photo: account.photo, name: account.name }} className="large" />
            <div><strong>{account.name || user.name}</strong><span>{account.email || user.email}</span></div>
          </div>
          <div className="cbv6-settings-meta">
            <span><IdCard size={14} /> {fileNo}</span>
            <span><Building2 size={14} /> {HOSPITAL.campus}</span>
            <span><HeartPulse size={14} /> {roleLabel(user.role)}</span>
          </div>
          <nav>
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button key={section.id} type="button" className={tab === section.id ? "is-active" : ""} onClick={() => goTab(section.id)}>
                  <span><Icon size={17} /></span>
                  <div><strong>{section.label}</strong><small>{section.help}</small></div>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="cbv6-settings-workspace">
          {tab === "profile" && (
            <form className="cbv6-settings-panel" onSubmit={saveAccount}>
              <header><div><small>Hospital identity</small><h2>Profile & clinical identity</h2><p>{FILE_NOTE[user.role] || FILE_NOTE.patient}</p></div><span className="cbv6-panel-icon"><UserRound size={22} /></span></header>
              <div className="cbv6-profile-row">
                <PhotoPicker value={account.photo} name={account.name} onChange={(photo) => setAccount({ ...account, photo })} onError={(m) => push(m, "error")} />
                <div><strong>{account.name || user.name}</strong><span>{desk}</span><small>{fileNo}</small></div>
              </div>
              <div className="cbv6-form-section">
                <div className="cbv6-section-title"><span>01</span><div><h3>Contact details</h3><p>Used for hospital communication and receipts.</p></div></div>
                <div className="form-grid">
                  <label>Full name<input value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} required /></label>
                  <label>Email<input type="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} required /></label>
                  <label>Phone<input value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} /></label>
                  <label>City<input value={account.city} onChange={(e) => setAccount({ ...account, city: e.target.value })} /></label>
                </div>
              </div>
              {user.role === "patient" && (
                <div className="cbv6-form-section">
                  <div className="cbv6-section-title"><span>02</span><div><h3>Clinical essentials</h3><p>High-value facts clinicians should see quickly.</p></div></div>
                  <div className="form-grid">
                    <label>Emergency contact<input value={account.emergencyContact} onChange={(e) => setAccount({ ...account, emergencyContact: e.target.value })} /></label>
                    <label>Allergies<input value={account.allergies} onChange={(e) => setAccount({ ...account, allergies: e.target.value })} /></label>
                    <label>Insurance / NHIS<input value={account.insurance} onChange={(e) => setAccount({ ...account, insurance: e.target.value })} /></label>
                    <label>Blood type<input value={account.bloodType} onChange={(e) => setAccount({ ...account, bloodType: e.target.value })} /></label>
                  </div>
                </div>
              )}
              {(user.role === "doctor" || user.role === "admin" || user.role === "nurse") && <label>Title / specialty<input value={account.specialty} onChange={(e) => setAccount({ ...account, specialty: e.target.value })} /></label>}
              {user.role === "doctor" && <div className="cbv6-duty-row"><span><b>Directory availability</b><small>Controls whether patients see you as available.</small></span><DutyToggle available={account.available} onChange={async (available) => { setAccount({ ...account, available }); try { const next = await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ available }) }); updateUser({ ...user, ...next }); push(available ? "You are now available." : "You are now marked busy."); } catch (err) { push(err.message, "error"); } }} /></div>}
              <label>About<textarea rows="4" value={account.about} onChange={(e) => setAccount({ ...account, about: e.target.value })} /></label>
              <footer><button className="primary-btn" disabled={busy === "profile"}>{busy === "profile" ? "Saving…" : "Save profile"}</button></footer>
            </form>
          )}

          {tab === "experience" && (
            <div className="cbv6-settings-panel cbv6-experience-panel">
              <header><div><small>Interface engine</small><h2>Appearance & experience</h2><p>Personalize CareBridge without changing clinical or operational data.</p></div><span className="cbv6-panel-icon"><MonitorCog size={22} /></span></header>
              <div className={`cbv6-experience-preview cbv6-preview-${appearance.theme}`}>
                <div className="cbv6-preview-rail"><i /><i /><i /></div>
                <div><span>CareBridge</span><strong>Preview your workspace</strong><small>{appearance.density} · {appearance.motion} motion</small></div>
              </div>
              <div className="cbv6-form-section">
                <div className="cbv6-section-title"><span><Palette size={17} /></span><div><h3>Color atmosphere</h3><p>Choose the visual personality of your workspace.</p></div></div>
                <div className="cbv6-choice-grid">
                  <SettingChoice active={appearance.theme === "pearl"} icon={Sparkles} title="Pearl" text="Warm white, ink and emerald" onClick={() => saveAppearance({ ...appearance, theme: "pearl" })} />
                  <SettingChoice active={appearance.theme === "midnight"} icon={Sparkles} title="Midnight" text="Deep navy clinical command" onClick={() => saveAppearance({ ...appearance, theme: "midnight" })} />
                  <SettingChoice active={appearance.theme === "sage"} icon={Sparkles} title="Sage" text="Calm green healthcare palette" onClick={() => saveAppearance({ ...appearance, theme: "sage" })} />
                </div>
              </div>
              <div className="cbv6-form-section">
                <div className="cbv6-section-title"><span><Gauge size={17} /></span><div><h3>Information density</h3><p>Balance breathing room and operational throughput.</p></div></div>
                <div className="cbv6-choice-grid">
                  <SettingChoice active={appearance.density === "comfortable"} icon={Gauge} title="Comfortable" text="Premium spacing and larger controls" onClick={() => saveAppearance({ ...appearance, density: "comfortable" })} />
                  <SettingChoice active={appearance.density === "compact"} icon={Gauge} title="Compact" text="More information on one screen" onClick={() => saveAppearance({ ...appearance, density: "compact" })} />
                </div>
              </div>
              <div className="cbv6-form-section">
                <div className="cbv6-section-title"><span><Sparkles size={17} /></span><div><h3>Motion system</h3><p>Control page transitions and ambient movement.</p></div></div>
                <div className="cbv6-choice-grid">
                  <SettingChoice active={appearance.motion === "full"} icon={Sparkles} title="Cinematic" text="Premium transitions and live ambient motion" onClick={() => saveAppearance({ ...appearance, motion: "full" })} />
                  <SettingChoice active={appearance.motion === "subtle"} icon={Sparkles} title="Subtle" text="Shorter, quieter transitions" onClick={() => saveAppearance({ ...appearance, motion: "subtle" })} />
                  <SettingChoice active={appearance.motion === "reduced"} icon={Sparkles} title="Reduced" text="Minimal movement for accessibility" onClick={() => saveAppearance({ ...appearance, motion: "reduced" })} />
                </div>
              </div>
              <div className="cbv6-form-section">
                <div className="cbv6-section-title"><span><MonitorCog size={17} /></span><div><h3>Navigation character</h3><p>Choose how navigation feels on desktop.</p></div></div>
                <div className="cbv6-choice-grid">
                  <SettingChoice active={appearance.nav === "floating"} icon={MonitorCog} title="Floating" text="Layered premium navigation with glass depth" onClick={() => saveAppearance({ ...appearance, nav: "floating" })} />
                  <SettingChoice active={appearance.nav === "flush"} icon={MonitorCog} title="Flush" text="Crisp enterprise edges with less depth" onClick={() => saveAppearance({ ...appearance, nav: "flush" })} />
                </div>
              </div>
            </div>
          )}

          {tab === "security" && (
            <form className="cbv6-settings-panel" onSubmit={savePassword}>
              <header><div><small>Access control</small><h2>Password & sign-in</h2><p>Protect access to your {roleLabel(user.role).toLowerCase()} workspace.</p></div><span className="cbv6-panel-icon"><Shield size={22} /></span></header>
              <div className="cbv6-security-banner"><Shield size={19} /><div><strong>Encrypted session protection</strong><span>Your browser stores only a session token, not your password.</span></div></div>
              <label>Current password<input type="password" value={security.currentPassword} onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })} required autoComplete="current-password" /></label>
              <div className="form-grid">
                <label>New password<input type="password" value={security.password} onChange={(e) => setSecurity({ ...security, password: e.target.value })} required minLength={6} autoComplete="new-password" /></label>
                <label>Confirm new password<input type="password" value={security.confirm} onChange={(e) => setSecurity({ ...security, confirm: e.target.value })} required minLength={6} autoComplete="new-password" /></label>
              </div>
              <footer><button className="primary-btn" disabled={busy === "security"}>{busy === "security" ? "Updating…" : "Update password"}</button></footer>
            </form>
          )}

          {tab === "pay" && user.role === "patient" && (
            <form className="cbv6-settings-panel" onSubmit={savePay}>
              <header><div><small>Checkout defaults</small><h2>Payment preferences</h2><p>These choices speed up Shop & pay; you can still change them at checkout.</p></div><span className="cbv6-panel-icon"><Wallet size={22} /></span></header>
              <label>Preferred method<select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option value="momo">Mobile money</option><option value="bank">Bank transfer</option><option value="nhis">NHIS / insurance</option><option value="cash">Cash at cashier</option></select></label>
              <div className="form-grid">
                <label>MoMo network<select value={pay.momoNetwork} onChange={(e) => setPay({ ...pay, momoNetwork: e.target.value })}><option value="mtn">MTN MoMo</option><option value="telecel">Telecel Cash</option><option value="at">AirtelTigo Money</option></select></label>
                <label>Wallet number<input value={pay.momoNumber} onChange={(e) => setPay({ ...pay, momoNumber: e.target.value })} placeholder="024…" /></label>
              </div>
              <label>NHIS / policy number<input value={pay.nhisNumber} onChange={(e) => setPay({ ...pay, nhisNumber: e.target.value })} /></label>
              <footer><button className="primary-btn" disabled={busy === "pay"}>{busy === "pay" ? "Saving…" : "Save payment defaults"}</button></footer>
            </form>
          )}

          {tab === "notifications" && (
            <form className="cbv6-settings-panel" onSubmit={saveAlerts}>
              <header><div><small>Communication control</small><h2>Notifications</h2><p>Choose which changes should reach your inbox as well as CareBridge.</p></div><span className="cbv6-panel-icon"><Bell size={22} /></span></header>
              <label className="cbv6-switch-row"><div><strong>Email notifications</strong><small>Send hospital updates to {user.email}</small></div><input type="checkbox" checked={alerts.emailAlerts} onChange={(e) => setAlerts({ ...alerts, emailAlerts: e.target.checked })} /></label>
              {[["appointments", "Appointments", "Consultations scheduled or changed"],["wards", "Admissions", "Bed requests and admission decisions"],["messages", "Messages", "New care-team communication"],["account", "Account", "Receipts and billing notices"],["support", "Support", "Help-desk replies and operations updates"]].map(([key, title, text]) => (
                <label className="cbv6-switch-row" key={key}><div><strong>{title}</strong><small>{text}</small></div><input type="checkbox" checked={alerts.alertPrefs[key]} disabled={!alerts.emailAlerts} onChange={(e) => setAlerts((f) => ({ ...f, alertPrefs: { ...f.alertPrefs, [key]: e.target.checked } }))} /></label>
              ))}
              <footer><button className="primary-btn" disabled={busy === "notifications"}>{busy === "notifications" ? "Saving…" : "Save notifications"}</button><button type="button" className="secondary-btn" onClick={testEmail}>Send test notice</button></footer>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
