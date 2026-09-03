import React, { useState } from "react";
import { Mail } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { push } = useToast();
  const [form, setForm] = useState({
    name: user.name || "",
    phone: user.phone || "",
    city: user.city || "",
    about: user.about || "",
    specialty: user.specialty || "",
    emailAlerts: user.emailAlerts !== false,
    alertPrefs: {
      appointments: user.alertPrefs?.appointments !== false,
      wards: user.alertPrefs?.wards !== false,
      messages: user.alertPrefs?.messages !== false,
      account: user.alertPrefs?.account !== false,
    },
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const next = await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify(form) });
      updateUser({ ...user, ...next });
      push("Profile saved");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const testEmail = async () => {
    try {
      await api("/emails/test", { method: "POST", body: JSON.stringify({ userId: user.id }) });
      push("Test email alert sent. Open Email alerts to read it.");
    } catch (err) {
      push(err.message, "error");
    }
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Account</span>
          <h1>Your profile</h1>
          <p>Keep your details current. Patients can control which email alerts they receive.</p>
        </div>
      </div>
      <form className="card" onSubmit={save} style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="appointment-feature">
          <div className="avatar large">{user.avatar}</div>
          <div className="grow"><strong>{user.name}</strong><span className="muted">{user.email}</span><small className="muted">{user.role}</small></div>
        </div>
        <label>Full name<input value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
        <div className="form-grid">
          <label>Phone<input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
          <label>City<input value={form.city} onChange={(e) => set("city", e.target.value)} /></label>
        </div>
        {(user.role === "doctor" || user.role === "admin") && (
          <label>Specialty / title<input value={form.specialty} onChange={(e) => set("specialty", e.target.value)} /></label>
        )}
        <label>About<textarea rows="3" value={form.about} onChange={(e) => set("about", e.target.value)} /></label>

        {user.role === "patient" && (
          <section>
            <h3>Email alerts</h3>
            <p className="muted">We email you when a consultation is scheduled, a ward is accepted, or your care team writes.</p>
            <label className="check-row"><input type="checkbox" checked={form.emailAlerts} onChange={(e) => set("emailAlerts", e.target.checked)} /> Send email alerts to {user.email}</label>
            {["appointments", "wards", "messages", "account"].map((key) => (
              <label className="check-row" key={key}>
                <input
                  type="checkbox"
                  checked={form.alertPrefs[key]}
                  disabled={!form.emailAlerts}
                  onChange={(e) => setForm((f) => ({ ...f, alertPrefs: { ...f.alertPrefs, [key]: e.target.checked } }))}
                />
                {key === "appointments" && "Consultation scheduled or updated"}
                {key === "wards" && "Ward request received or accepted"}
                {key === "messages" && "New message from a doctor"}
                {key === "account" && "Account and test alerts"}
              </label>
            ))}
            <button type="button" className="secondary-btn" style={{ marginTop: 10 }} onClick={testEmail}><Mail size={16} /> Send a test email alert</button>
          </section>
        )}

        <div className="modal-actions">
          <button className="primary-btn" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}
