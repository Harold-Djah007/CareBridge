import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, CalendarDays, CheckCircle2, Clock3, MapPin, MessageCircle, Plus,
  ShieldCheck, Sparkles, Stethoscope, UserRoundCheck, Video, XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { api, socketOptions, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { consultQuote, formatDate, formatTime, ghs, isUpcoming, todayISO } from "../utils";
import { IMAGERY } from "../imagery";
import Avatar from "../components/Avatar";

function dayParts(date) {
  const d = new Date(`${date}T00:00:00`);
  return {
    month: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: d.getDate(),
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
  };
}

export default function Appointments() {
  const { user } = useAuth();
  const { push } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [view, setView] = useState("upcoming");
  const [open, setOpen] = useState(false);
  const [rates, setRates] = useState(null);
  const [form, setForm] = useState({
    doctorId: "",
    patientId: user.role === "patient" ? user.id : "",
    date: todayISO(),
    time: "09:00",
    reason: "",
    mode: "video",
  });

  const isPatient = user.role === "patient";
  const isDoctor = user.role === "doctor";
  const load = () => api(`/appointments?userId=${user.id}&role=${user.role}`).then(setAppointments);

  useEffect(() => {
    load();
    api("/doctors").then(setDoctors);
    if (!isPatient) api("/patients").then(setPatients).catch(() => {});
    api("/finance/rates").then(setRates).catch(() => {});
    const socket = io(socketUrl, socketOptions());
    socket.on("doctor-status", (payload) => setDoctors((list) => list.map((doctor) => doctor.id === payload.id ? { ...doctor, available: payload.available, photo: payload.photo || doctor.photo } : doctor)));
    socket.on("tariff-updated", setRates);
    return () => socket.disconnect();
  }, [user.id, user.role]);

  const upcoming = useMemo(() => appointments.filter(isUpcoming).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)), [appointments]);
  const next = upcoming[0];
  const rows = useMemo(() => {
    const sorted = appointments.slice().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    if (view === "upcoming") return sorted.filter(isUpcoming);
    if (view === "past") return sorted.filter((row) => !isUpcoming(row));
    return sorted;
  }, [appointments, view]);

  const pending = appointments.filter((row) => row.status === "pending").length;
  const completed = appointments.filter((row) => row.status === "completed").length;
  const tele = upcoming.filter((row) => row.mode === "video").length;
  const selectedDoctor = doctors.find((doctor) => doctor.id === form.doctorId);
  const quote = consultQuote(rates, selectedDoctor?.specialty, form.mode);
  const otherId = (appointment) => isDoctor ? appointment.patientId : appointment.doctorId;

  const openBooking = () => {
    setForm({ doctorId: "", patientId: isPatient ? user.id : "", date: todayISO(), time: "09:00", reason: "", mode: "video" });
    setOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.doctorId) return push("Choose a clinician first.", "error");
    const picked = doctors.find((doctor) => doctor.id === form.doctorId);
    if (picked?.available === false) return push(`${picked.name} is currently busy.`, "error");
    await api("/appointments", { method: "POST", body: JSON.stringify({ ...form, patientId: isPatient ? user.id : form.patientId }) });
    setOpen(false);
    push(isPatient ? "Consultation booked and added to your care plan." : "Appointment added to the clinical schedule.");
    load();
  };

  const update = async (id, status) => {
    await api(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status, actorId: user.id }) });
    push(`Appointment ${status}.`);
    load();
  };

  return (
    <div className="px-page px-appointments">
      <section className="px-appointment-stage">
        <div className="px-stage-copy">
          <span className="px-kicker"><Sparkles size={14} /> {isDoctor ? "Clinical planning" : isPatient ? "My care calendar" : "Hospital scheduling"}</span>
          <h1>{isDoctor ? "Run today’s clinic with clarity." : "Plan care without the friction."}</h1>
          <p>{isDoctor ? "Every encounter, patient context and next action in one calm schedule." : "Book, prepare, join and follow up from one premium care timeline."}</p>
          <div className="px-stage-actions">
            <button className="px-primary" type="button" onClick={openBooking}><Plus size={17} /> {isPatient ? "Book care" : "Create encounter"}</button>
            <Link className="px-secondary" to="/messages"><MessageCircle size={16} /> Messages</Link>
          </div>
        </div>
        <div className="px-stage-next" style={{ backgroundImage: `linear-gradient(135deg, rgba(5,20,30,.9), rgba(5,20,30,.38)), url(${next?.mode === "video" ? IMAGERY.consult : IMAGERY.clinic})` }}>
          <span className="px-stage-live"><i /> {next ? "Next encounter" : "Schedule ready"}</span>
          {next ? <>
            <small>{formatDate(next.date)} · {formatTime(next.time)}</small>
            <h2>{isPatient ? next.doctor?.name : next.patient?.name}</h2>
            <p>{next.reason || "Consultation"}</p>
            <div className="px-stage-tags"><span>{next.mode === "video" ? <Video size={14} /> : <MapPin size={14} />}{next.mode === "video" ? "Teleconsult" : "Ridge Campus"}</span><span className={`status ${next.status}`}>{next.status}</span></div>
          </> : <><h2>No upcoming encounter</h2><p>Your next appointment will appear here.</p></>}
        </div>
      </section>

      <section className="px-signal-grid" aria-label="Appointment summary">
        <article><span><CalendarDays size={17} /></span><div><small>Upcoming</small><strong>{upcoming.length}</strong></div></article>
        <article><span><Video size={17} /></span><div><small>Teleconsults</small><strong>{tele}</strong></div></article>
        <article><span><Clock3 size={17} /></span><div><small>Pending</small><strong>{pending}</strong></div></article>
        <article><span><CheckCircle2 size={17} /></span><div><small>Completed</small><strong>{completed}</strong></div></article>
      </section>

      <section className="px-appointment-board">
        <header className="px-board-head">
          <div><span className="px-kicker">Encounter timeline</span><h2>{isDoctor ? "Clinic flow" : "Your visit plan"}</h2></div>
          <div className="px-segmented" role="tablist" aria-label="Appointment view">
            {["upcoming", "past", "all"].map((tab) => <button type="button" key={tab} className={view === tab ? "active" : ""} onClick={() => setView(tab)}>{tab}</button>)}
          </div>
        </header>

        <div className="px-timeline">
          {rows.length === 0 && <div className="px-empty"><CalendarDays size={28} /><h3>No encounters here yet</h3><p>{isPatient ? "Book a visit when you need care." : "New appointments will appear in this workspace."}</p><button className="px-secondary" type="button" onClick={openBooking}>Create one</button></div>}
          {rows.map((appointment) => {
            const person = isPatient ? appointment.doctor : appointment.patient;
            const parts = dayParts(appointment.date);
            return (
              <article className={`px-encounter ${appointment.status}`} key={appointment.id}>
                <time className="px-encounter-date"><span>{parts.month}</span><strong>{parts.day}</strong><small>{parts.weekday}</small></time>
                <div className="px-encounter-spine"><i /></div>
                <div className="px-encounter-card">
                  <div className="px-encounter-person"><Avatar person={person} /><div><h3>{person?.name || "Patient"}</h3><p>{isPatient ? appointment.doctor?.specialty : appointment.patient?.mrn || "Patient record"}</p></div></div>
                  <div className="px-encounter-main"><span><Clock3 size={14} /> {formatTime(appointment.time)}</span><span>{appointment.mode === "video" ? <Video size={14} /> : <MapPin size={14} />}{appointment.mode === "video" ? "Teleconsult" : "Ridge Campus"}</span><h4>{appointment.reason || "Consultation"}</h4><small>{appointment.fee ? `${ghs(appointment.fee)} consultation fee` : "Tariff-linked encounter"}</small></div>
                  <div className="px-encounter-state"><span className={`status ${appointment.status}`}>{appointment.status}</span>{appointment.invoiceStatus === "due" && <small>Payment due</small>}</div>
                  <div className="px-encounter-actions">
                    {isPatient && appointment.invoiceStatus === "due" && appointment.invoiceId && <Link to={`/pay?invoice=${appointment.invoiceId}`}>Pay</Link>}
                    <Link to={`/messages?with=${otherId(appointment)}`}><MessageCircle size={15} /> Message</Link>
                    {appointment.mode === "video" && appointment.status !== "cancelled" && user.role !== "admin" && <Link className="strong" to={`/video?with=${otherId(appointment)}`}><Video size={15} /> {isPatient ? "Join" : "Open room"}</Link>}
                    {isDoctor && appointment.status === "pending" && <button type="button" onClick={() => update(appointment.id, "confirmed")}><UserRoundCheck size={15} /> Confirm</button>}
                    {isDoctor && !["completed", "cancelled"].includes(appointment.status) && <button type="button" onClick={() => update(appointment.id, "completed")}>Complete</button>}
                    {!isDoctor && !["completed", "cancelled"].includes(appointment.status) && <button className="danger" type="button" title="Cancel appointment" onClick={() => update(appointment.id, "cancelled")}><XCircle size={16} /></button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {open && <div className="px-modal-backdrop" onMouseDown={() => setOpen(false)}>
        <form className="px-booking-sheet" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
          <header><span className="px-sheet-icon"><Stethoscope size={20} /></span><div><span className="px-kicker">New encounter</span><h2>{isPatient ? "Book your consultation" : "Create an encounter"}</h2><p>CareBridge links scheduling, patient context and billing automatically.</p></div><button type="button" onClick={() => setOpen(false)}><XCircle size={20} /></button></header>
          <div className="px-sheet-body">
            {!isPatient && <label>Patient<select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required><option value="">Select a patient</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label>}
            <div className="px-sheet-block"><span className="px-kicker">Choose clinician</span><div className="px-clinician-grid">{doctors.map((doctor) => <button type="button" key={doctor.id} className={`${form.doctorId === doctor.id ? "active" : ""} ${doctor.available === false ? "busy" : ""}`} onClick={() => setForm({ ...form, doctorId: doctor.id })}><Avatar person={doctor} /><span><strong>{doctor.name}</strong><small>{doctor.specialty || "Consultant"}</small><em>{doctor.available === false ? "Busy" : "Available"}</em></span></button>)}</div></div>
            <div className="px-form-grid"><label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label><label>Time<input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required /></label></div>
            <label>Consultation type<select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}><option value="video">Video consultation</option><option value="in-person">In-person consultation</option></select></label>
            <label>Reason for visit<textarea rows="3" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Brief clinical reason or patient concern" /></label>
            {quote != null && <div className="px-quote"><span><ShieldCheck size={16} /> Estimated consultation</span><strong>{ghs(quote)}</strong></div>}
          </div>
          <footer><button className="px-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="px-primary"><span>Confirm appointment</span><ArrowRight size={16} /></button></footer>
        </form>
      </div>}
    </div>
  );
}
