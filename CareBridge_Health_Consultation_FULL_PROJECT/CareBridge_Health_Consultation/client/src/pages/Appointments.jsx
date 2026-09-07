import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, CheckCircle2, Clock, MapPin, MessageCircle, Plus, Stethoscope,
  UserRoundCheck, Video, XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { api, socketOptions, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { formatDate, formatTime, isUpcoming, todayISO, ghs, consultQuote } from "../utils";
import { IMAGERY } from "../imagery";
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
    if (user.role !== "patient") api("/patients").then(setPatients).catch(() => {});
    api("/finance/rates").then(setRates);
    const socket = io(socketUrl, socketOptions());
    socket.on("doctor-status", (payload) => setDoctors((list) => list.map((doctor) => doctor.id === payload.id ? { ...doctor, available: payload.available, photo: payload.photo || doctor.photo } : doctor)));
    socket.on("tariff-updated", setRates);
    return () => socket.disconnect();
  }, [user.id, user.role]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.doctorId) return push("Choose a doctor from the list.", "error");
    const picked = doctors.find((doctor) => doctor.id === form.doctorId);
    if (picked?.available === false) return push(`${picked.name} is busy and is not taking new visits. Pick an available doctor.`, "error");
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
    const sorted = appointments.slice().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    if (tab === "upcoming") return sorted.filter(isUpcoming);
    if (tab === "past") return sorted.filter((appointment) => !isUpcoming(appointment));
    return sorted;
  }, [appointments, tab]);

  const upcoming = appointments.filter(isUpcoming);
  const videoCount = upcoming.filter((appointment) => appointment.mode === "video").length;
  const pendingCount = appointments.filter((appointment) => appointment.status === "pending").length;
  const otherId = (appointment) => user.role === "doctor" ? appointment.patientId : appointment.doctorId;
  const selectedDoctor = doctors.find((doctor) => doctor.id === form.doctorId);
  const quote = consultQuote(rates, selectedDoctor?.specialty, form.mode);
  const isPatient = user.role === "patient";
  const isDoctor = user.role === "doctor";

  const openBooking = () => {
    setForm({ doctorId: "", patientId: isPatient ? user.id : "", date: todayISO(), time: "09:00", reason: "", mode: "video" });
    setOpen(true);
  };

  return (
    <div className="appointments-workspace">
      <PageHero
        scene="schedule"
        eyebrow={isDoctor ? "Clinical schedule" : isPatient ? "My visits" : "Hospital appointments"}
        title={isPatient ? "Appointments" : isDoctor ? "Clinical schedule" : "Appointments"}
        lead={isPatient ? "Book, prepare for and join your consultations from one timeline." : "Manage encounter flow, status and patient access from a single operational schedule."}
        actions={<button className="primary-btn" onClick={openBooking}><Plus size={17} /> {isPatient ? "Book appointment" : "Create appointment"}</button>}
      />

      <div className="product-metric-grid appointment-metrics">
        <div className="product-metric-card"><span className="metric-icon tone-blue"><CalendarDays size={18} /></span><div className="metric-copy"><small>Upcoming</small><strong>{upcoming.length}</strong><span>Scheduled encounters</span></div></div>
        <div className="product-metric-card"><span className="metric-icon tone-violet"><Video size={18} /></span><div className="metric-copy"><small>Teleconsults</small><strong>{videoCount}</strong><span>Upcoming video visits</span></div></div>
        <div className="product-metric-card"><span className="metric-icon tone-amber"><Clock size={18} /></span><div className="metric-copy"><small>Pending</small><strong>{pendingCount}</strong><span>Waiting for confirmation</span></div></div>
        <div className="product-metric-card"><span className="metric-icon tone-green"><CheckCircle2 size={18} /></span><div className="metric-copy"><small>Completed</small><strong>{appointments.filter((appointment) => appointment.status === "completed").length}</strong><span>Filed encounters</span></div></div>
      </div>

      {isPatient && upcoming[0] && (
        <section className="product-imagery-strip appointment-visual" style={{ backgroundImage: `url(${upcoming[0].mode === "video" ? IMAGERY.consult : IMAGERY.clinic})` }}>
          <div><span className="eyebrow">Next visit</span><h3>{formatDate(upcoming[0].date)} · {formatTime(upcoming[0].time)}</h3><p>{upcoming[0].doctor?.name} · {upcoming[0].doctor?.specialty} · {upcoming[0].mode === "video" ? "Secure video consultation" : "Ridge Campus clinic"}</p></div>
        </section>
      )}

      <div className="schedule-toolbar">
        <div className="filters" role="tablist" aria-label="Appointment view">
          {["upcoming", "past", "all"].map((value) => <button key={value} type="button" className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{value === "upcoming" ? `Upcoming · ${upcoming.length}` : value[0].toUpperCase() + value.slice(1)}</button>)}
        </div>
        <span className="schedule-caption">{rows.length} encounter{rows.length === 1 ? "" : "s"} in this view</span>
      </div>

      <section className="product-section appointment-schedule-section">
        <div className="product-section-head"><div><span className="eyebrow">Schedule</span><h2>{isDoctor ? "Patient flow" : "Visit timeline"}</h2></div>{isPatient && <Link className="secondary-btn" to="/messages"><MessageCircle size={15} /> Messages</Link>}</div>
        <div className="appointment-product-list">
          {rows.length === 0 && <EmptyPlate scene="schedule" icon={CalendarDays} title="No appointments in this view" hint={isPatient ? "Book a visit when you need care." : "Scheduled encounters will appear here."} />}
          {rows.map((appointment) => {
            const person = isPatient ? appointment.doctor : appointment.patient;
            return (
              <article className={`appointment-product-row ${appointment.status} ${isUpcoming(appointment) ? "upcoming" : ""}`} key={appointment.id}>
                <div className="appointment-date-block"><span>{new Date(`${appointment.date}T00:00`).toLocaleDateString(undefined, { month: "short" })}</span><b>{new Date(`${appointment.date}T00:00`).getDate()}</b><small>{formatTime(appointment.time)}</small></div>
                <div className="appointment-person"><Avatar person={person} /><div><h3>{person?.name || "Patient"}</h3><p>{isPatient ? appointment.doctor?.specialty : appointment.patient?.mrn || "Patient record"}</p></div></div>
                <div className="appointment-detail"><span className="appointment-mode">{appointment.mode === "video" ? <Video size={14} /> : <MapPin size={14} />}{appointment.mode === "video" ? "Teleconsult" : "Ridge Campus"}</span><b>{appointment.reason || "Consultation"}</b><small>{appointment.fee ? `${ghs(appointment.fee)} consultation fee` : "Fee on tariff"}</small></div>
                <div className="appointment-state"><span className={`status ${appointment.status}`}>{appointment.status}</span>{appointment.invoiceStatus === "due" && <small>Payment due</small>}</div>
                <div className="appointment-actions">
                  {isPatient && appointment.invoiceStatus === "due" && appointment.invoiceId && <Link className="ghost-btn" to={`/pay?invoice=${appointment.invoiceId}`}>Pay</Link>}
                  <Link className="ghost-btn" to={`/messages?with=${otherId(appointment)}`}><MessageCircle size={15} /> Message</Link>
                  {appointment.mode === "video" && appointment.status !== "cancelled" && user.role !== "admin" && <Link className="secondary-btn" to={`/video?with=${otherId(appointment)}`}><Video size={15} /> {isPatient ? "Join" : "Open room"}</Link>}
                  {isDoctor && appointment.status === "pending" && <button className="secondary-btn" onClick={() => update(appointment.id, "confirmed")}><UserRoundCheck size={15} /> Confirm</button>}
                  {isDoctor && appointment.status !== "completed" && appointment.status !== "cancelled" && <button className="ghost-btn" onClick={() => update(appointment.id, "completed")}>Complete</button>}
                  {appointment.status !== "cancelled" && appointment.status !== "completed" && !isDoctor && <button className="icon-btn danger" title="Cancel appointment" onClick={() => update(appointment.id, "cancelled")}><XCircle size={17} /></button>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {open && (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <form className="modal-card product-booking-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
            <div className="modal-icon"><Stethoscope /></div>
            <span className="eyebrow">New encounter</span>
            <h2>{isPatient ? "Book a consultation" : "Create an appointment"}</h2>
            <p className="muted">Choose the clinician, time and consultation mode. CareBridge links the visit to the patient record and billing automatically.</p>
            {user.role !== "patient" && <label>Patient<select value={form.patientId} onChange={(event) => setForm({ ...form, patientId: event.target.value })} required><option value="">Select a patient</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label>}
            <p className="eyebrow">Clinician</p>
            <div className="doctor-pick product-doctor-pick">
              {doctors.map((doctor) => (
                <button type="button" key={doctor.id} className={`doctor-chip ${form.doctorId === doctor.id ? "on" : ""} ${user.preferredDoctorId === doctor.id ? "preferred" : ""} ${doctor.available === false ? "busy" : ""}`} onClick={() => setForm({ ...form, doctorId: doctor.id })}>
                  <Avatar person={doctor} /><span><b>{doctor.name}</b><small>{doctor.specialty || "Consultant"} · {doctor.available === false ? "Busy" : "Available"}{rates ? ` · ${ghs(consultQuote(rates, doctor.specialty, form.mode) || 0)}` : ""}</small></span>
                </button>
              ))}
            </div>
            <div className="form-grid"><label>Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label><label>Time<input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} required /></label></div>
            <label>Consultation type<select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })}><option value="video">Video consultation</option><option value="in-person">In-person consultation</option></select></label>
            <label>Reason for visit<textarea rows="3" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Brief clinical reason or patient concern" /></label>
            {quote != null && <div className="booking-quote"><span>Estimated fee</span><strong>{ghs(quote)}</strong><small>{form.mode === "video" ? "Video consultation" : "Campus visit including clinic charge"}</small></div>}
            <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setOpen(false)}>Cancel</button><button className="primary-btn">Confirm appointment</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
