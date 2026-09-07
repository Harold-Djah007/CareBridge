import React, { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Mail, MapPin, Plus, Search, ShieldCheck, SlidersHorizontal, UserRound, UsersRound, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useToast } from "../../state";
import { roleLabel } from "../../utils";
import PhotoPicker from "../../components/PhotoPicker";
import Avatar from "../../components/Avatar";
import PageHero, { EmptyPlate } from "../../components/PageHero";

const blank = { name: "", email: "", password: "care123", role: "patient", phone: "", city: "", specialty: "", photo: "" };
const ROLE_FILTERS = ["all", "patient", "doctor", "nurse", "admin"];

export default function AdminUsers() {
  const { push } = useToast();
  const [params] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState(params.get("q") || "");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("active");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);

  const load = () => api("/admin/users").then(setUsers);
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => users.filter((person) => {
    const haystack = `${person.name} ${person.email} ${person.role} ${person.specialty || ""} ${person.city || ""}`.toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (role !== "all" && person.role !== role) return false;
    const personStatus = person.status || "active";
    if (status !== "all" && personStatus !== status) return false;
    return true;
  }), [users, query, role, status]);

  const counts = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => (u.status || "active") === "active").length,
    doctors: users.filter((u) => u.role === "doctor").length,
    patients: users.filter((u) => u.role === "patient").length,
  }), [users]);

  const save = async (event) => {
    event.preventDefault();
    try {
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
    } catch (err) { push(err.message, "error"); }
  };

  const toggle = async (person) => {
    await api(`/admin/users/${person.id}`, { method: "PATCH", body: JSON.stringify({ status: person.status === "inactive" ? "active" : "inactive" }) });
    push(person.status === "inactive" ? "Account reactivated" : "Account deactivated");
    load();
  };

  const launch = (person = null) => {
    setEditing(person);
    setForm(person ? { ...blank, ...person, password: "" } : blank);
    setOpen(true);
  };

  return (
    <div className="identity-workspace">
      <PageHero
        scene="directory"
        eyebrow="Identity & access"
        title="People directory"
        lead="Manage the people behind CareBridge — patients, clinicians, pharmacy staff and operations — without leaving the hospital identity workspace."
        actions={<button className="primary-btn" onClick={() => launch()}><Plus size={16} /> Add person</button>}
      />

      <section className="identity-summary-grid">
        <article><span><UsersRound size={18} /></span><div><small>Total identities</small><strong>{counts.total}</strong><em>Registered across CareBridge</em></div></article>
        <article><span><BadgeCheck size={18} /></span><div><small>Active access</small><strong>{counts.active}</strong><em>Can currently sign in</em></div></article>
        <article><span><UserRound size={18} /></span><div><small>Patients</small><strong>{counts.patients}</strong><em>Patient identities</em></div></article>
        <article><span><ShieldCheck size={18} /></span><div><small>Doctors</small><strong>{counts.doctors}</strong><em>Clinical accounts</em></div></article>
      </section>

      <section className="identity-commandbar">
        <label className="identity-search"><Search size={16} /><input placeholder="Search name, email, specialty or city" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="identity-filters"><SlidersHorizontal size={15} />{ROLE_FILTERS.map((item) => <button key={item} type="button" className={role === item ? "active" : ""} onClick={() => setRole(item)}>{item === "all" ? "All roles" : roleLabel(item)}</button>)}</div>
        <div className="identity-state-filter">{["active", "inactive", "all"].map((item) => <button type="button" key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item}</button>)}</div>
      </section>

      <section className="identity-directory-panel">
        <header><div><span className="eyebrow">Directory view</span><h2>{visible.length} people</h2></div><small>{role === "all" ? "All roles" : roleLabel(role)} · {status}</small></header>
        <div className="identity-grid">
          {visible.map((person) => {
            const inactive = person.status === "inactive";
            return (
              <article className={`identity-card ${inactive ? "inactive" : ""}`} key={person.id}>
                <div className="identity-card-top"><Avatar person={person} className="large" /><div className="grow"><span className="identity-role">{roleLabel(person.role)}</span><h3>{person.name}</h3><p>{person.specialty || (person.role === "patient" ? "Patient account" : "CareBridge user")}</p></div><span className={`identity-access ${inactive ? "off" : "on"}`}><i />{inactive ? "Inactive" : "Active"}</span></div>
                <div className="identity-card-meta"><span><Mail size={14} />{person.email}</span><span><MapPin size={14} />{person.city || "Location not set"}</span></div>
                <footer><button className="secondary-btn" type="button" onClick={() => launch(person)}>Edit profile</button><button className={`ghost-btn ${inactive ? "" : "danger"}`} type="button" onClick={() => toggle(person)}>{inactive ? "Reactivate" : "Deactivate"}</button></footer>
              </article>
            );
          })}
          {visible.length === 0 && <EmptyPlate scene="directory" icon={UsersRound} title="No identities match this view" hint="Change the role, status or search filters." />}
        </div>
      </section>

      {open && (
        <div className="px-modal-backdrop" onMouseDown={() => setOpen(false)}>
          <form className="identity-editor-sheet" onMouseDown={(event) => event.stopPropagation()} onSubmit={save}>
            <header><div><span className="px-kicker">Identity profile</span><h2>{editing ? "Edit person" : "Create person"}</h2><p>{editing ? "Update profile, role and access details." : "Create a protected CareBridge identity and assign its hospital role."}</p></div><button type="button" onClick={() => setOpen(false)}><X size={18} /></button></header>
            <div className="identity-editor-body">
              <PhotoPicker value={form.photo} name={form.name} onChange={(photo) => setForm({ ...form, photo })} onError={(message) => push(message, "error")} />
              <label>Full name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
              <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
              <label>Password<input type="text" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={editing ? "Leave blank to keep current password" : ""} required={!editing} /></label>
              <label>CareBridge role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="patient">Patient</option><option value="doctor">Doctor</option><option value="nurse">Nurse / pharmacy</option><option value="admin">Administrator</option></select></label>
              <div className="identity-form-grid"><label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>City<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label></div>
              {form.role !== "patient" && <label>Specialty / title<input value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })} /></label>}
            </div>
            <footer><button type="button" className="px-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="px-primary">{editing ? "Save changes" : "Create identity"}</button></footer>
          </form>
        </div>
      )}
    </div>
  );
}
