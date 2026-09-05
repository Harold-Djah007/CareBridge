import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, XCircle, Plus, Stethoscope, Video, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { api, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { formatDate, formatTime, isUpcoming, todayISO, ghs, consultQuote } from "../utils";
import Avatar from "../components/Avatar";
import PageHero, { EmptyPlate } from "../components/PageHero";

export default function Appointments() {
  const { user } = useAuth();
  const { push } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [tab, setTab] = useState("upcoming");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ doctorId: "", patientId: user.role === "patient" ? user.id : "", date: todayISO(), time: "09:00", reason: "", mode: "video" });
  const [rates, setRates] = useState(null);

  const load = () => api(`/appointments?userId=${user.id}&role=${user.role}`).then(setAppointments);
  useEffect(() => {
    load();
    api("/doctors").then(setDoctors);
    if (user.role !== "patient") api("/patients").then(setPatients);
    api("/finance/rates").then(setRates);
    const socket = io(socketUrl, { autoConnect: true });
    socket.on("doctor-status", (p) => {
      setDoctors((list) => list.map((d) => (d.id === p.id ? { ...d, available: p.available, photo: p.photo || d.photo } : d)));
    });
    socket.on("tariff-updated", setRates);
    return () => socket.disconnect();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.doctorId) {
      push("Choose a doctor from the list.", "error");
      return;
    }
    const picked = doctors.find((d) => d.id === form.doctorId);
    if (picked?.available === false) {
      push(`${picked.name} is busy and is not taking new visits. Pick an available doctor.`, "error");
      return;
    }
    await api("/appointments", { method: "POST", body: JSON.stringify({ ...form, patientId: user.role === "patient" ? user.id : form.patientId }) });
    setOpen(false);
    setForm({ doctorId: "", patientId: user.role === "patient" ? user.id : "", date: todayISO(), time: "09:00", reason: "", mode: "video" });
    push(user.role === "patient" ? "Consultation booked and billed. Pay from Shop & pay to receive a receipt." : "Appointment created and billed to the patient account.");
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
  const selectedDoctor = doctors.find((d) => d.id === form.doctorId);
  const quote = consultQuote(rates, selectedDoctor?.specialty, form.mode);

  return (
    <div>
      <PageHero
        scene="schedule"
        eyebrow={user.role === "doctor" ? "Outpatient" : "Visits"}
        title={user.role === "patient" ? "Appointments" : "Schedule"}
        lead={user.role === "patient" ? "Book a video or campus visit. Fees go to Shop & pay." : "Upcoming and completed encounters."}
        actions={(
          <button className="primary-btn" onClick={() => { setForm({ doctorId: "", patientId: user.role === "patient" ? user.id : "", date: todayISO(), time: "09:00", reason: "", mode: "video" }); setOpen(true); }}><Plus size={18} /> {user.role === "patient" ? "Request a visit" : "Add slot"}</button>
        )}
      />
      <div className="filters">
        {["upcoming", "past", "all"].map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>
      {user.role === "doctor" ? (
        <div className="clinic-board work-deck">
          {rows.length === 0 ? (
            <EmptyPlate scene="schedule" title="No encounters in this view" />
          ) : rows.map((a) => (
            <div className="clinic-row" key={a.id}>
              <div className="time">{formatTime(a.time)}<div className="muted" style={{ fontSize: 11 }}>{formatDate(a.date)}</div></div>
              <Avatar person={a.patient} />
              <div>
                <strong>{a.patient?.name}</strong>
                <div className="muted">{a.reason} · {a.mode === "video" ? "Teleconsult" : "Face to face"}{a.fee ? ` · ${ghs(a.fee)}` : ""}</div>
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
        <div className="list-card work-deck">
          {rows.length === 0 ? (
            <EmptyPlate scene="schedule" icon={CalendarDays} title="No appointments in this view" hint="Book a visit and it will appear here." />
          ) : rows.map((a) => (
            <div className="appointment-row" key={a.id}>
              <div className="date-box"><span>{new Date(a.date + "T00:00").toLocaleDateString(undefined, { month: "short" })}</span><b>{new Date(a.date + "T00:00").getDate()}</b></div>
              <Avatar person={user.role === "patient" ? a.doctor : a.patient} />
              <div className="grow">
                <strong>{user.role === "patient" ? a.doctor.name : a.patient.name}</strong>
                <span className="muted">{a.reason}</span>
                <small className="muted"><Clock size={14} /> {formatDate(a.date)} · {formatTime(a.time)} · {a.mode === "video" ? "Video" : "In person"}{a.fee ? ` · ${ghs(a.fee)}` : ""}</small>
              </div>
              <span className={`status ${a.status}`}>{a.status}</span>
              <div className="row-actions">
                {user.role === "patient" && a.invoiceStatus === "due" && a.invoiceId && (
                  <Link className="ghost-btn" to={`/pay?invoice=${a.invoiceId}`}>Pay</Link>
                )}
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
            <p className="muted">A confirmation email is sent. The fee below is billed to the patient account.</p>
            {user.role !== "patient" && (
              <label>Patient
                <select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required>
                  <option value="">Select a patient</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
            <p className="eyebrow">Choose a doctor</p>
            <div className="doctor-pick">
              {doctors.map((d) => (
                <button type="button" key={d.id} className={`doctor-chip ${form.doctorId === d.id ? "on" : ""} ${user.preferredDoctorId === d.id ? "preferred" : ""} ${d.available === false ? "busy" : ""}`} onClick={() => setForm({ ...form, doctorId: d.id })}>
                  <Avatar person={d} />
                  <span>
                    <b>{d.name}</b>
                    <small>{d.specialty || "Consultant"} · {d.available === false ? "Busy" : "Available"}{user.preferredDoctorId === d.id ? " · your doctor" : ""}{rates ? ` · ${ghs(consultQuote(rates, d.specialty, form.mode) || 0)}` : ""}</small>
                  </span>
                </button>
              ))}
            </div>
            {!form.doctorId && <p className="muted">Pick the consultant you want. No doctor is selected until you choose one.</p>}
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
            {quote != null && <p><b>Fee due: {ghs(quote)}</b><span className="muted"> — {form.mode === "video" ? "video consult" : "campus visit (includes GHS 80 clinic charge)"}</span></p>}
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
