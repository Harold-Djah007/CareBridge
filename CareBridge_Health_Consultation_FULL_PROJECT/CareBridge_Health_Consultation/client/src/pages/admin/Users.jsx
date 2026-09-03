import React, { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useToast } from "../../state";
import { roleLabel } from "../../utils";

const blank = { name: "", email: "", password: "care123", role: "patient", phone: "", city: "", specialty: "" };

export default function AdminUsers() {
  const { push } = useToast();
  const [params] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState(params.get("q") || "");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);

  const load = () => api("/admin/users").then(setUsers);
  useEffect(() => { load(); }, []);

  const visible = useMemo(
    () => users.filter((u) => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(query.toLowerCase())),
    [users, query]
  );

  const save = async (e) => {
    e.preventDefault();
    if (editing) {
      await api(`/admin/users/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
      push("Person updated");
    } else {
      await api("/admin/users", { method: "POST", body: JSON.stringify(form) });
      push("Account created");
    }
    setOpen(false);
    setEditing(null);
    setForm(blank);
    load();
  };

  const toggle = async (u) => {
    await api(`/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ status: u.status === "inactive" ? "active" : "inactive" }) });
    push(u.status === "inactive" ? "Account reactivated" : "Account deactivated");
    load();
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Directory</span>
          <h1>People</h1>
          <p>Create patients, doctors, and administrators. Deactivating blocks sign-in.</p>
        </div>
        <button className="primary-btn" onClick={() => { setEditing(null); setForm(blank); setOpen(true); }}><Plus size={16} /> Add person</button>
      </div>
      <div className="search-box" style={{ maxWidth: 360, marginBottom: 16 }}><input placeholder="Search people" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      <div className="card" style={{ overflow: "auto" }}>
        <table className="table">
          <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {visible.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b></td>
                <td>{roleLabel(u.role)}</td>
                <td>{u.email}</td>
                <td><span className={`status ${u.status || "active"}`}>{u.status || "active"}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="secondary-btn" onClick={() => { setEditing(u); setForm({ ...blank, ...u, password: "" }); setOpen(true); }}>Edit</button>
                    <button className="ghost-btn" onClick={() => toggle(u)}>{u.status === "inactive" ? "Activate" : "Deactivate"}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <form className="modal-card" onMouseDown={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{editing ? "Edit person" : "Add person"}</h2>
            <label>Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label>Password<input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? "Leave blank to keep" : ""} required={!editing} /></label>
            <label>Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <div className="form-grid">
              <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <label>City<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
            </div>
            {form.role !== "patient" && <label>Specialty / title<input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></label>}
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="primary-btn">{editing ? "Save" : "Create"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
