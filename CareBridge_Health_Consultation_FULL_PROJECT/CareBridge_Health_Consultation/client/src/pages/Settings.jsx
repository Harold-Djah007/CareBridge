import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Shield, Wallet, Bell, UserRound, PanelTop } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { useTopbar } from "../chrome";

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const prefs = user.paymentPrefs || {};
  const [account, setAccount] = useState({
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    city: user.city || "",
    about: user.about || "",
    specialty: user.specialty || "",
    available: user.available !== false,
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
  const [topbarOn, setTopbarOn] = useTopbar();

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
      await patch(account, "Account details saved");
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
      await patch({ paymentPrefs: pay, insurance: pay.nhisNumber || user.insurance }, "Payment defaults saved. Pay bills will use these next.");
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
      await patch(alerts, "Notification preferences saved");
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
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Account</span>
          <h1>Settings</h1>
          <p>These controls write to your hospital file. Nothing here is decorative — each save is stored and used on the next visit, bill, or alert.</p>
        </div>
        <button className="secondary-btn" type="button" onClick={() => { logout(); navigate("/login"); }}>
          <LogOut size={16} /> Sign out
        </button>
      </div>

      <form className="card settings-card" onSubmit={saveAccount}>
        <div className="card-head">
          <div><span className="eyebrow">Identity</span><h3><UserRound size={16} /> Name and contact</h3></div>
        </div>
        <div className="form-grid">
          <label>Full name<input value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} required /></label>
          <label>Email<input type="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} required /></label>
        </div>
        <div className="form-grid">
          <label>Phone<input value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} /></label>
          <label>City<input value={account.city} onChange={(e) => setAccount({ ...account, city: e.target.value })} /></label>
        </div>
        {(user.role === "doctor" || user.role === "admin") && (
          <label>Title / specialty<input value={account.specialty} onChange={(e) => setAccount({ ...account, specialty: e.target.value })} /></label>
        )}
        {user.role === "doctor" && (
          <label className="check-row">
            <input type="checkbox" checked={account.available} onChange={(e) => setAccount({ ...account, available: e.target.checked })} />
            Show me as available for new consultations
          </label>
        )}
        <label>About<textarea rows="3" value={account.about} onChange={(e) => setAccount({ ...account, about: e.target.value })} /></label>
        <p className="muted">Clinical details (allergies, NHIS on the file, emergency contact) stay on <Link to="/profile"><b>My details</b></Link>.</p>
        <button className="primary-btn" disabled={busy === "account"}>{busy === "account" ? "Saving…" : "Save account"}</button>
      </form>

      <form className="card settings-card" onSubmit={savePassword}>
        <div className="card-head">
          <div><span className="eyebrow">Sign-in</span><h3><Shield size={16} /> Password</h3></div>
        </div>
        <label>Current password<input type="password" value={security.currentPassword} onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })} required autoComplete="current-password" /></label>
        <div className="form-grid">
          <label>New password<input type="password" value={security.password} onChange={(e) => setSecurity({ ...security, password: e.target.value })} required minLength={6} autoComplete="new-password" /></label>
          <label>Confirm new password<input type="password" value={security.confirm} onChange={(e) => setSecurity({ ...security, confirm: e.target.value })} required minLength={6} autoComplete="new-password" /></label>
        </div>
        <button className="primary-btn" disabled={busy === "password"}>{busy === "password" ? "Updating…" : "Update password"}</button>
      </form>

      {user.role === "patient" && (
        <form className="card settings-card" onSubmit={savePay}>
          <div className="card-head">
            <div><span className="eyebrow">Accounts</span><h3><Wallet size={16} /> How you pay hospital bills</h3></div>
          </div>
          <p className="muted">Pay bills opens with these defaults. You can still pick another method on each invoice.</p>
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

      <section className="card settings-card">
        <div className="card-head">
          <div><span className="eyebrow">Display</span><h3><PanelTop size={16} /> Toolbar</h3></div>
        </div>
        <p className="muted">The top bar stays hidden until you open it. This switch is stored on this browser and takes effect immediately.</p>
        <label className="check-row">
          <input type="checkbox" checked={topbarOn} onChange={(e) => setTopbarOn(e.target.checked)} />
          Show the top toolbar (search, shortcuts, clock)
        </label>
        <button type="button" className="secondary-btn" onClick={() => setTopbarOn(!topbarOn)}>
          {topbarOn ? "Hide toolbar now" : "Show toolbar now"}
        </button>
      </section>

      <form className="card settings-card" onSubmit={saveAlerts}>
        <div className="card-head">
          <div><span className="eyebrow">Notices</span><h3><Bell size={16} /> Email and in-app alerts</h3></div>
        </div>
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
          <button className="primary-btn" disabled={busy === "alerts"}>{busy === "alerts" ? "Saving…" : "Save alerts"}</button>
          <button type="button" className="secondary-btn" onClick={testEmail}>Send a test notice</button>
        </div>
      </form>
    </div>
  );
}
