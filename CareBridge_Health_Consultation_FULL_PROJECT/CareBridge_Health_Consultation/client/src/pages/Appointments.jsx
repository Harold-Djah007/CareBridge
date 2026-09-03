import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, XCircle, Plus, Stethoscope, Video, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { formatDate, formatTime, isUpcoming, todayISO } from "../utils";

export default function Appointments() {
  const { user } = useAuth();
  const { push } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [tab, setTab] = useState("upcoming");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ doctorId: "d1", patientId: user.role === "patient" ? user.id : "p1", date: todayISO(), time: "09:00", reason: "", mode: "video" });

  const load = () => api(`/appointments?userId=${user.id}&role=${user.role}`).then(setAppointments);
  useEffect(() => {
    load();
    api("/doctors").then((d) => {
      setDoctors(d);
      if (d[0]) setForm((f) => ({ ...f, doctorId: d[0].id }));
    });
    if (user.role !== "patient") api("/patients").then(setPatients);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    await api("/appointments", { method: "POST", body: JSON.stringify({ ...form, patientId: user.role === "patient" ? user.id : form.patientId }) });
    setOpen(false);
    setForm((f) => ({ ...f, reason: "" }));
    push(user.role === "patient" ? "Consultation booked. An email alert is on the way." : "Appointment created.");
    load();
  };

  const update = async (id, status) => {
    await api(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status, actorId: user.id }) });
    push(`Appointment ${status}. Patient email sent if alerts are on.`);
    load();
  };

  const rows = useMemo(() => {
    if (tab === "upcoming") return appointments.filter(isUpcoming);
    if (tab === "past") return appointments.filter((a) => !isUpcoming(a));
    return appointments;
  }, [appointments, tab]);

  const otherId = (a) => (user.role === "doctor" ? a.patientId : a.doctorId);

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">{user.role === "doctor" ? "Outpatient diary" : "Visits"}</span>
          <h1>{user.role === "patient" ? "Your appointments" : "Clinic schedule"}</h1>
          <p>{user.role === "patient" ? "Book a video or campus visit. We send a confirmation to your email." : "Today’s list, plus upcoming and completed encounters."}</p>
        </div>
        <button className="primary-btn" onClick={() => setOpen(true)}><Plus size={18} /> {user.role === "patient" ? "Request a visit" : "Add slot"}</button>
      </div>
      <div className="filters">
        {["upcoming", "past", "all"].map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>
      {user.role === "doctor" ? (
        <div className="clinic-board">
          {rows.length === 0 ? (
            <div className="empty"><h3>No encounters in this view</h3></div>
          ) : rows.map((a) => (
            <div className="clinic-row" key={a.id}>
              <div className="time">{formatTime(a.time)}<div className="muted" style={{ fontSize: 11 }}>{formatDate(a.date)}</div></div>
              <div>
                <strong>{a.patient?.name}</strong>
                <div className="muted">{a.reason} · {a.mode === "video" ? "Teleconsult" : "Face to face"}</div>
              </div>
              <div className="row-actions">
                <span className={`status ${a.status}`}>{a.status}</span>
                <Link className="ghost-btn" to={`/messages?with=${a.patientId}`}>Note</Link>
                {a.status === "pending" && <button className="secondary-btn" onClick={() => update(a.id, "confirmed")}>Confirm</button>}
                {a.status !== "completed" && a.status !== "cancelled" && <button className="ghost-btn" onClick={() => update(a.id, "completed")}>Done</button>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="list-card">
          {rows.length === 0 ? (
            <div className="empty"><CalendarDays size={38} /><h3>No appointments in this view</h3><p>Book a visit and it will appear here.</p></div>
          ) : rows.map((a) => (
            <div className="appointment-row" key={a.id}>
              <div className="date-box"><span>{new Date(a.date + "T00:00").toLocaleDateString(undefined, { month: "short" })}</span><b>{new Date(a.date + "T00:00").getDate()}</b></div>
              <div className="avatar">{user.role === "patient" ? a.doctor.avatar : a.patient.avatar}</div>
              <div className="grow">
                <strong>{user.role === "patient" ? a.doctor.name : a.patient.name}</strong>
                <span className="muted">{a.reason}</span>
                <small className="muted"><Clock size={14} /> {formatDate(a.date)} · {formatTime(a.time)} · {a.mode === "video" ? "Video" : "In person"}</small>
              </div>
              <span className={`status ${a.status}`}>{a.status}</span>
              <div className="row-actions">
                <Link className="soft-icon" title="Message" to={`/messages?with=${otherId(a)}`}><MessageCircle size={18} /></Link>
                {a.mode === "video" && a.status !== "cancelled" && user.role !== "admin" && (
                  <Link className="soft-icon success" title="Join video" to={`/video?with=${otherId(a)}`}><Video size={18} /></Link>
                )}
                {a.status !== "cancelled" && a.status !== "completed" && (
                  <button className="soft-icon danger" title="Cancel" onClick={() => update(a.id, "cancelled")}><XCircle size={18} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <form className="modal-card" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="modal-icon"><Stethoscope /></div>
            <h2>Book a consultation</h2>
            <p className="muted">The patient receives an email as soon as this is scheduled.</p>
            {user.role !== "patient" && (
              <label>Patient
                <select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
            <label>Doctor
              <select value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>)}
              </select>
            </label>
            <div className="form-grid">
              <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
              <label>Time<input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required /></label>
            </div>
            <label>Consultation type
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option value="video">Video consultation</option>
                <option value="in-person">In-person consultation</option>
              </select>
            </label>
            <label>Reason for visit<textarea rows="3" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Briefly describe what you need help with" /></label>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="primary-btn">Confirm appointment</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
