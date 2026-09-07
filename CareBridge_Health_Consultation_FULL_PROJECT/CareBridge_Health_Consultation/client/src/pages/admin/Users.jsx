import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, ShieldCheck, Stethoscope, UserRound, Users, HeartPulse } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useToast } from "../../state";
import { roleLabel } from "../../utils";
import PhotoPicker from "../../components/PhotoPicker";
import Avatar from "../../components/Avatar";
import PageHero from "../../components/PageHero";

const blank = { name: "", email: "", password: "care123", role: "patient", phone: "", city: "", specialty: "", photo: "" };
const roleIcon = { patient: HeartPulse, doctor: Stethoscope, nurse: UserRound, admin: ShieldCheck };

export default function AdminUsers() {
  const { push } = useToast();
  const [params] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState(params.get("q") || "");
  const [role, setRole] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);

  const load = () => api("/admin/users").then(setUsers);
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    all: users.length,
    patient: users.filter((u) => u.role === "patient").length,
    doctor: users.filter((u) => u.role === "doctor").length,
    nurse: users.filter((u) => u.role === "nurse").length,
    admin: users.filter((u) => u.role === "admin").length,
    inactive: users.filter((u) => u.status === "inactive").length,
  }), [users]);

  const visible = useMemo(() => users.filter((u) => {
    if (role !== "all" && u.role !== role) return false;
    return `${u.name} ${u.email} ${u.role} ${u.city || ""} ${u.specialty || ""}`.toLowerCase().includes(query.toLowerCase());
  }), [users, query, role]);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api(`/admin/users/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
        push("Person updated");
      } else {
        await api("/admin/users", { method: "POST", body: JSON.stringify(form) });
        push("Account created");
      }
      setOpen(false); setEditing(null); setForm(blank); load();
    } catch (err) { push(err.message, "error"); }
  };

  const toggle = async (u) => {
    await api(`/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ status: u.status === "inactive" ? "active" : "inactive" }) });
    push(u.status === "inactive" ? "Account reactivated" : "Account deactivated");
    load();
  };

  const openNew = () => { setEditing(null); setForm(blank); setOpen(true); };

  return (
    <div className="people-os">
      <PageHero scene="directory" eyebrow="Identity & access" title="People directory" lead="One operational directory for patients, clinicians, pharmacy staff and hospital administrators." actions={<button className="primary-btn" onClick={openNew}><Plus size={16} /> Add person</button>} />

      <section className="ops-metric-grid people-metrics">
        {[
          [Users, "All identities", counts.all, "Hospital directory"],
          [HeartPulse, "Patients", counts.patient, "Care recipients"],
          [Stethoscope, "Clinicians", counts.doctor, "Medical staff"],
          [UserRound, "Pharmacy / nursing", counts.nurse, "Dispensary staff"],
        ].map(([Icon, label, value, hint]) => <article className="ops-metric" key={label}><span className="ops-metric-icon"><Icon size={17} /></span><div><small>{label}</small><strong>{value}</strong><em>{hint}</em></div></article>)}
      </section>

      <section className="product-section directory-console">
        <div className="directory-toolbar">
          <div className="directory-search"><Search size={16} /><input placeholder="Search name, email, city or specialty" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <div className="directory-role-tabs">
            {["all", "patient", "doctor", "nurse", "admin"].map((id) => <button key={id} className={role === id ? "active" : ""} onClick={() => setRole(id)}>{id === "all" ? `All ${counts.all}` : `${roleLabel(id)} ${counts[id] || 0}`}</button>)}
          </div>
        </div>

        <div className="directory-table-wrap">
          <table className="table product-directory-table">
            <thead><tr><th>Identity</th><th>Role / service</th><th>Contact</th><th>Location</th><th>Access</th><th>Actions</th></tr></thead>
            <tbody>
              {visible.map((u) => {
                const Icon = roleIcon[u.role] || UserRound;
                return <tr key={u.id}>
                  <td><div className="directory-person"><Avatar person={u} /><span><b>{u.name}</b><small>{u.employeeId || u.mrn || u.id}</small></span></div></td>
                  <td><div className="role-cell"><Icon size={14} /><span><b>{roleLabel(u.role)}</b><small>{u.specialty || u.department || "CareBridge member"}</small></span></div></td>
                  <td><span className="directory-contact"><b>{u.email}</b><small>{u.phone || "No phone"}</small></span></td>
                  <td>{u.city || "—"}</td>
                  <td><span className={`status ${u.status || "active"}`}>{u.status || "active"}</span></td>
                  <td><div className="row-actions"><button className="secondary-btn" onClick={() => { setEditing(u); setForm({ ...blank, ...u, password: "" }); setOpen(true); }}>Open profile</button><button className="ghost-btn" onClick={() => toggle(u)}>{u.status === "inactive" ? "Reactivate" : "Deactivate"}</button></div></td>
                </tr>;
              })}
              {visible.length === 0 && <tr><td colSpan={6}><div className="product-empty-inline"><Users size={18} /><span>No people match this view.</span></div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="directory-foot"><ShieldCheck size={14} /><span>{counts.inactive} inactive account{counts.inactive === 1 ? "" : "s"} · deactivated users cannot sign in.</span></div>
      </section>

      {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal-card product-form-modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="modal-title-block"><span className="eyebrow">Identity record</span><h2>{editing ? "Edit person" : "Create person"}</h2><p className="muted">Maintain the account used across clinical, pharmacy and hospital workflows.</p></div>
        <PhotoPicker value={form.photo} name={form.name} onChange={(photo) => setForm({ ...form, photo })} onError={(m) => push(m, "error")} />
        <div className="form-grid"><label>Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="patient">Patient</option><option value="doctor">Doctor</option><option value="nurse">Nurse / pharmacy</option><option value="admin">Administrator</option></select></label></div>
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>Password<input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? "Leave blank to keep current password" : ""} required={!editing} /></label>
        <div className="form-grid"><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label>City<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label></div>
        {form.role !== "patient" && <label>Specialty / title<input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></label>}
        <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setOpen(false)}>Cancel</button><button className="primary-btn">{editing ? "Save changes" : "Create identity"}</button></div>
      </form></div>}
    </div>
  );
}
