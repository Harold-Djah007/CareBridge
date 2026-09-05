import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LogOut, Shield, Wallet, Bell, UserRound, Building2, IdCard, HeartPulse } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { HOSPITAL, roleLabel } from "../utils";
import PhotoPicker from "../components/PhotoPicker";
import DutyToggle from "../components/DutyToggle";
import Avatar from "../components/Avatar";
import PageHero from "../components/PageHero";

const FILE_NOTE = {
  patient: "Printed on receipts, letters, and the ward board. Clinical facts on this same file are what the care team reads.",
  doctor: "Used on prescriptions, the clinic board, and the staff directory.",
  nurse: "Used on the dispensary queue and the staff directory.",
  admin: "Used on operations notices and the staff directory.",
};

function tabFromParams(params, role) {
  const tab = params.get("tab");
  if (tab === "account" || tab === "identity") return "account";
  if (tab === "signin" || tab === "password") return "signin";
  if (tab === "pay" && role === "patient") return "pay";
  if (tab === "notices" || tab === "alerts") return "notices";
  return "account";
}

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const prefs = user.paymentPrefs || {};
  const tabs = [
    { id: "account", label: "Account" },
    { id: "signin", label: "Password" },
    ...(user.role === "patient" ? [{ id: "pay", label: "How you pay" }] : []),
    { id: "notices", label: "Notices" },
  ];
  const [tab, setTab] = useState(() => tabFromParams(params, user.role));
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

  const saveAccount = async (e) => {
    e.preventDefault();
    setBusy("account");
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
      }, "Account details saved to your hospital file.");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy("");
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (security.password !== security.confirm) {
      push("New passwords do not match.", "error");
      return;
    }
    setBusy("password");
    try {
      await patch(
        { currentPassword: security.currentPassword, password: security.password },
        "Password updated. Use it the next time you sign in."
      );
      setSecurity({ currentPassword: "", password: "", confirm: "" });
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy("");
    }
  };

  const savePay = async (e) => {
    e.preventDefault();
    setBusy("pay");
    try {
      await patch({ paymentPrefs: pay, insurance: pay.nhisNumber || user.insurance }, "Payment defaults saved. Shop & pay will open with these.");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy("");
    }
  };

  const saveAlerts = async (e) => {
    e.preventDefault();
    setBusy("alerts");
    try {
      await patch(alerts, "Notice preferences saved.");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy("");
    }
  };

  const testEmail = async () => {
    try {
      await api("/emails/test", { method: "POST", body: JSON.stringify({ userId: user.id }) });
      push("Test notice sent. Open Notifications to read it.");
    } catch (err) {
      push(err.message, "error");
    }
  };

  return (
    <div className="settings-desk">
      <PageHero
        scene="records"
        eyebrow={`${HOSPITAL.campus} · hospital file`}
        title="Account"
        lead="Your hospital file, password, and notices live here. Each save is used on the next visit, bill, or letter."
        actions={(
          <button className="secondary-btn" type="button" onClick={() => { logout(); navigate("/login"); }}>
            <LogOut size={16} /> Sign out
          </button>
        )}
      />

      <div className="settings-layout">
        <aside className="settings-jacket">
          <div className="settings-jacket-photo" style={{ backgroundImage: "url(/imagery/records.jpg)" }} aria-hidden="true" />
          <div className="settings-jacket-body">
            <Avatar person={{ ...user, photo: account.photo, name: account.name }} className="large" />
            <b>{account.name || user.name}</b>
            <span className="muted">{account.email || user.email}</span>
            <ul className="settings-meta">
              <li><IdCard size={14} /> {user.role === "patient" ? "MRN" : "Staff"} <strong>{fileNo}</strong></li>
              <li><UserRound size={14} /> {roleLabel(user.role)}</li>
              <li><Building2 size={14} /> {HOSPITAL.campus}</li>
              <li>{desk}</li>
            </ul>
            <p className="muted settings-jacket-note">Password, notices{user.role === "patient" ? ", and how you pay" : ""} are on this same page.</p>
          </div>
        </aside>

        <div className="settings-work">
          <div className="settings-tabs" role="tablist" aria-label="Account sections">
            <label className="jump-menu">
              <span>Section</span>
              <select value={tab} onChange={(e) => goTab(e.target.value)}>
                {tabs.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <div className="chip-row">
              {tabs.map((t) => (
                <button key={t.id} type="button" className={`chip-link ${tab === t.id ? "on" : ""}`} onClick={() => goTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === "account" && (
            <form className="card settings-card" onSubmit={saveAccount}>
              <div className="card-head">
                <div>
                  <span className="eyebrow">Hospital file</span>
                  <h3><UserRound size={16} /> Name and contact</h3>
                </div>
              </div>
              <p className="muted">{FILE_NOTE[user.role] || FILE_NOTE.patient}</p>
              <PhotoPicker value={account.photo} name={account.name} onChange={(photo) => setAccount({ ...account, photo })} onError={(m) => push(m, "error")} />
              <div className="form-grid">
                <label>Full name<input value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} required /></label>
                <label>Email<input type="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} required /></label>
              </div>
              <div className="form-grid">
                <label>Phone<input value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} /></label>
                <label>City<input value={account.city} onChange={(e) => setAccount({ ...account, city: e.target.value })} /></label>
              </div>
              {user.role === "patient" && (
                <>
                  <div className="card-head" style={{ marginTop: 8 }}>
                    <div>
                      <span className="eyebrow">Clinical facts</span>
                      <h3><HeartPulse size={16} /> On your record</h3>
                    </div>
                  </div>
                  <p className="muted">Shown on the clinical file and the ward board. Staff read these before they treat or dispense.</p>
                  <div className="form-grid">
                    <label>Emergency contact<input value={account.emergencyContact} onChange={(e) => setAccount({ ...account, emergencyContact: e.target.value })} /></label>
                    <label>Allergies<input value={account.allergies} onChange={(e) => setAccount({ ...account, allergies: e.target.value })} /></label>
                  </div>
                  <div className="form-grid">
                    <label>Insurance / NHIS<input value={account.insurance} onChange={(e) => setAccount({ ...account, insurance: e.target.value })} /></label>
                    <label>Blood type<input value={account.bloodType} onChange={(e) => setAccount({ ...account, bloodType: e.target.value })} /></label>
                  </div>
                </>
              )}
              {(user.role === "doctor" || user.role === "admin" || user.role === "nurse") && (
                <label>Title / specialty<input value={account.specialty} onChange={(e) => setAccount({ ...account, specialty: e.target.value })} /></label>
              )}
              {user.role === "doctor" && (
                <div className="avail-row">
                  <span className="eyebrow">Duty on the directory</span>
                  <DutyToggle
                    available={account.available}
                    onChange={async (available) => {
                      setAccount({ ...account, available });
                      try {
                        const next = await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ available }) });
                        updateUser({ ...user, ...next });
                        push(available ? "Patients now see you as available." : "Patients now see you as busy.");
                      } catch (err) {
                        push(err.message, "error");
                      }
                    }}
                  />
                </div>
              )}
              <label>About<textarea rows="3" value={account.about} onChange={(e) => setAccount({ ...account, about: e.target.value })} placeholder={user.role === "doctor" ? "Short note for the consultant directory" : "Optional note on your file"} /></label>
              <button className="primary-btn" disabled={busy === "account"}>{busy === "account" ? "Saving…" : "Save to file"}</button>
            </form>
          )}

          {tab === "signin" && (
            <form className="card settings-card" onSubmit={savePassword}>
              <div className="card-head">
                <div>
                  <span className="eyebrow">Hospital sign-in</span>
                  <h3><Shield size={16} /> Password</h3>
                </div>
              </div>
              <p className="muted">This password opens the {user.role === "patient" ? "patient portal" : user.role === "doctor" ? "clinical workspace" : user.role === "nurse" ? "pharmacy workspace" : "operations desk"} at {HOSPITAL.short}. It is not shared with other staff.</p>
              <label>Current password<input type="password" value={security.currentPassword} onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })} required autoComplete="current-password" /></label>
              <div className="form-grid">
                <label>New password<input type="password" value={security.password} onChange={(e) => setSecurity({ ...security, password: e.target.value })} required minLength={6} autoComplete="new-password" /></label>
                <label>Confirm new password<input type="password" value={security.confirm} onChange={(e) => setSecurity({ ...security, confirm: e.target.value })} required minLength={6} autoComplete="new-password" /></label>
              </div>
              <button className="primary-btn" disabled={busy === "password"}>{busy === "password" ? "Updating…" : "Update password"}</button>
            </form>
          )}

          {tab === "pay" && user.role === "patient" && (
            <form className="card settings-card" onSubmit={savePay}>
              <div className="card-head">
                <div>
                  <span className="eyebrow">Ridge cashier</span>
                  <h3><Wallet size={16} /> How you pay hospital bills</h3>
                </div>
              </div>
              <p className="muted">Shop & pay opens with these defaults. You can still choose another method at checkout — MoMo, GCB, NHIS, or cash at the ground-floor desk.</p>
              <label>Preferred method
                <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                  <option value="momo">Mobile money</option>
                  <option value="bank">GCB bank transfer</option>
                  <option value="nhis">NHIS / insurance</option>
                  <option value="cash">Cash at Ridge cashier</option>
                </select>
              </label>
              <div className="form-grid">
                <label>MoMo network
                  <select value={pay.momoNetwork} onChange={(e) => setPay({ ...pay, momoNetwork: e.target.value })}>
                    <option value="mtn">MTN MoMo</option>
                    <option value="telecel">Telecel Cash</option>
                    <option value="at">AirtelTigo Money</option>
                  </select>
                </label>
                <label>Wallet number<input value={pay.momoNumber} onChange={(e) => setPay({ ...pay, momoNumber: e.target.value })} placeholder="024…" /></label>
              </div>
              <label>NHIS / policy number<input value={pay.nhisNumber} onChange={(e) => setPay({ ...pay, nhisNumber: e.target.value })} /></label>
              <button className="primary-btn" disabled={busy === "pay"}>{busy === "pay" ? "Saving…" : "Save payment defaults"}</button>
            </form>
          )}

          {tab === "notices" && (
            <form className="card settings-card" onSubmit={saveAlerts}>
              <div className="card-head">
                <div>
                  <span className="eyebrow">Hospital notices</span>
                  <h3><Bell size={16} /> Email and in-app alerts</h3>
                </div>
              </div>
              <p className="muted">Ridge Campus sends these when a visit, bed, message, bill, or help-desk ticket changes. They also appear under the bell on this portal.</p>
              <label className="check-row">
                <input type="checkbox" checked={alerts.emailAlerts} onChange={(e) => setAlerts({ ...alerts, emailAlerts: e.target.checked })} />
                Email {user.email} when something on this list happens
              </label>
              {[
                ["appointments", "Consultations scheduled or updated"],
                ["wards", "Admissions received or accepted"],
                ["messages", "New messages from the care team"],
                ["account", "Billing receipts and account notices"],
                ["support", "Help-desk tickets and operations replies"],
              ].map(([key, label]) => (
                <label className="check-row" key={key}>
                  <input
                    type="checkbox"
                    checked={alerts.alertPrefs[key]}
                    disabled={!alerts.emailAlerts}
                    onChange={(e) => setAlerts((f) => ({ ...f, alertPrefs: { ...f.alertPrefs, [key]: e.target.checked } }))}
                  />
                  {label}
                </label>
              ))}
              <div className="modal-actions">
                <button className="primary-btn" disabled={busy === "alerts"}>{busy === "alerts" ? "Saving…" : "Save notices"}</button>
                <button type="button" className="secondary-btn" onClick={testEmail}>Send a test notice</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
