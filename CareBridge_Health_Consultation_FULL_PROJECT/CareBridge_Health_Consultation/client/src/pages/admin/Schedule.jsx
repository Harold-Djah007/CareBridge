import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Search, Sparkles, Stethoscope, Video, XCircle } from "lucide-react";
import { api } from "../../api";
import { useToast } from "../../state";
import { formatDate, formatTime } from "../../utils";
import Avatar from "../../components/Avatar";

export default function AdminSchedule() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const load = () => api("/appointments").then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const update = async (id, status) => {
    await api(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    toast?.push(`Appointment ${status}. Patient notified.`);
    load();
  };

  const visible = useMemo(() => rows.filter((row) => {
    if (filter !== "all" && row.status !== filter) return false;
    const q = query.trim().toLowerCase();
    return !q || `${row.patient?.name || ""} ${row.doctor?.name || ""} ${row.reason || ""}`.toLowerCase().includes(q);
  }), [rows, filter, query]);

  const pending = rows.filter((row) => row.status === "pending").length;
  const confirmed = rows.filter((row) => row.status === "confirmed").length;
  const completed = rows.filter((row) => row.status === "completed").length;
  const video = rows.filter((row) => row.mode === "video").length;

  return (
    <div className="px-page px-clinic-ops">
      <section className="px-admin-title">
        <div><span className="px-kicker"><Sparkles size={14} /> Clinic operations</span><h1>Run the hospital diary, not just a table.</h1><p>Confirm arrivals, track encounter state and resolve the day’s clinic flow from a live operations board.</p></div>
        <div className="px-admin-title-stat"><span>Encounters</span><strong>{rows.length}</strong><small>{pending} need confirmation</small></div>
      </section>

      <section className="px-signal-grid">
        <article><span><Clock3 size={17} /></span><div><small>Pending</small><strong>{pending}</strong></div></article>
        <article><span><CalendarDays size={17} /></span><div><small>Confirmed</small><strong>{confirmed}</strong></div></article>
        <article><span><CheckCircle2 size={17} /></span><div><small>Completed</small><strong>{completed}</strong></div></article>
        <article><span><Video size={17} /></span><div><small>Video</small><strong>{video}</strong></div></article>
      </section>

      <section className="px-admin-board px-clinic-board">
        <header className="px-admin-toolbar"><div><span className="px-kicker">Encounter queue</span><h2>{visible.length} in view</h2></div><label><Search size={15} /><input aria-label="Search encounters" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search patient, clinician or reason" /></label><div className="px-segmented">{["all","pending","confirmed","completed","cancelled"].map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div></header>
        <div className="px-clinic-columns"><span>Time</span><span>Patient</span><span>Clinician</span><span>Visit</span><span>Status</span><span>Action</span></div>
        <div className="px-clinic-list">
          {visible.map((appointment) => <article className={`px-clinic-row ${appointment.status}`} key={appointment.id}>
            <time><strong>{formatTime(appointment.time)}</strong><small>{formatDate(appointment.date)}</small></time>
            <div className="px-clinic-person"><Avatar person={appointment.patient} /><span><strong>{appointment.patient?.name || "Patient"}</strong><small>{appointment.patient?.mrn || "Patient record"}</small></span></div>
            <div className="px-clinic-person"><Avatar person={appointment.doctor} /><span><strong>{appointment.doctor?.name || "Clinician"}</strong><small>{appointment.doctor?.specialty || "Consultant"}</small></span></div>
            <div><strong>{appointment.reason || "Consultation"}</strong><small>{appointment.mode === "video" ? "Teleconsult" : "Ridge Campus"}</small></div>
            <div><span className={`status ${appointment.status}`}>{appointment.status}</span></div>
            <div className="px-clinic-actions">{appointment.status === "pending" && <button className="approve" type="button" onClick={() => update(appointment.id, "confirmed")}><CheckCircle2 size={14} /> Confirm</button>}{!["completed","cancelled"].includes(appointment.status) && <button type="button" onClick={() => update(appointment.id, "completed")}>Complete</button>}{appointment.status !== "cancelled" && <button className="danger" type="button" aria-label={`Cancel appointment for ${appointment.patient?.name || "patient"}`} onClick={() => update(appointment.id, "cancelled")}><XCircle size={14} /></button>}</div>
          </article>)}
          {visible.length === 0 && <div className="px-empty"><Stethoscope size={28} /><h3>No encounters match this view</h3></div>}
        </div>
      </section>
    </div>
  );
}
